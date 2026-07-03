// tests/golden/ups-sizing.golden.test.ts
// GOLDEN TESTS — outputs verified against external engineering references,
// not against the code's own behavior. A golden test failing means the MATH
// is wrong, not the code. Never adjust an expected value to make a test pass;
// adjust it only when the cited source says so.
//
// Battery physics source (CRITICAL-1/2 fix, 2026-07-03):
//   Power-Sonic PHR-12550 (12V/155Ah high-rate UPS VRLA) published
//   constant-power discharge table @ 1.67 V/cell end voltage:
//   15 min → 540.1 W/cell × 6 cells × 0.25 h ÷ 1,860 Wh nameplate = 0.44 usable.
//   URL: power-sonic.com/product/phr-12550 (retrieved 2026-07-03).
//   Aging factor 1.25 per IEEE 485 end-of-life sizing practice.
//   Li-ion curve is a conservative estimate — replace with manufacturer data
//   before de-beta (tracked in CODE-AUDIT.md).

import { calculateUPSSizing } from "../../src/services/ups-sizing-engine.js";
import type { UPSSizingInput } from "../../src/types.js";

describe("GOLDEN: UPS module arithmetic [ACTIVE]", () => {
  // Pure arithmetic — verifiable by hand, no physics involved.

  it("800kW, growth 1.2 → design load exactly 960kW", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 800, redundancy: "N", runtime_minutes: 10,
      battery_type: "VRLA", growth_factor: 1.2,
    });
    expect(r.design_load_kw).toBeCloseTo(960, 1);
  });

  it("960kW design @ 500kW modules, N → 2 modules; N+1 → 3; 2N → 4; 2N+1 → 5", () => {
    const base: UPSSizingInput = {
      critical_load_kw: 800, redundancy: "N", runtime_minutes: 10,
      battery_type: "VRLA", growth_factor: 1.2,
    };
    expect(calculateUPSSizing({ ...base, redundancy: "N" }).ups_configuration.modules_required).toBe(2);
    expect(calculateUPSSizing({ ...base, redundancy: "N+1" }).ups_configuration.modules_required).toBe(3);
    expect(calculateUPSSizing({ ...base, redundancy: "2N" }).ups_configuration.modules_required).toBe(4);
    expect(calculateUPSSizing({ ...base, redundancy: "2N+1" }).ups_configuration.modules_required).toBe(5);
  });

  it("deliverable energy: 500kW design, 15 min, η=0.96 → 130.2 kWh through the UPS", () => {
    // E = 500 × (15/60) / 0.96 = 130.21 kWh — what the load draws; NOT the
    // battery nameplate (see rate-derated tests below).
    const r = calculateUPSSizing({
      critical_load_kw: 500 / 1.2, redundancy: "N", runtime_minutes: 15,
      battery_type: "VRLA", ups_efficiency: 0.96, growth_factor: 1.2,
    });
    expect(r.battery_configuration.deliverable_energy_kwh).toBeCloseTo(130.21, 0);
  });
});

describe("GOLDEN: rate-adjusted battery sizing [ACTIVE — CRITICAL-1/2 fixed 2026-07-03]", () => {
  // 500 kW design, 15-min runtime, VRLA, η = 0.96, aging 1.25:
  //   deliverable:  130.21 kWh
  //   ÷ 0.44 usable @ 15 min (PHR-12550 table) = 295.93 kWh
  //   × 1.25 aging (IEEE 485)                  = 369.9 kWh nameplate
  // The pre-fix engine returned 130.2 kWh — 2.8× undersized.

  it("500kW/15min VRLA → nameplate ≈ 370 kWh (±10%), not 130 kWh", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 500 / 1.2, redundancy: "N", runtime_minutes: 15,
      battery_type: "VRLA", ups_efficiency: 0.96, growth_factor: 1.2,
    });
    const kwh = r.battery_configuration.total_battery_energy_kwh;
    expect(kwh).toBeGreaterThan(369.9 * 0.9);
    expect(kwh).toBeLessThan(369.9 * 1.1);
    expect(r.battery_configuration.rate_derating_factor).toBeCloseTo(0.44, 2);
  });

  it("Li-ion applies DoD/rate + aging (≈191.5 kWh nameplate for same case)", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 500 / 1.2, redundancy: "N", runtime_minutes: 15,
      battery_type: "lithium_ion", ups_efficiency: 0.96, growth_factor: 1.2,
    });
    // 130.21 / 0.85 × 1.25 = 191.5 (conservative Li-ion estimate)
    expect(r.battery_configuration.total_battery_energy_kwh).toBeCloseTo(191.5, 0);
    expect(r.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(130.21);
  });

  it("2N topology → battery plant per bus (2× strings and 2× energy vs N) [MAJOR-1 fixed]", () => {
    const base: UPSSizingInput = {
      critical_load_kw: 800, redundancy: "N", runtime_minutes: 10,
      battery_type: "VRLA", growth_factor: 1.2,
    };
    const n = calculateUPSSizing(base).battery_configuration;
    const twoN = calculateUPSSizing({ ...base, redundancy: "2N" }).battery_configuration;
    expect(twoN.strings_required).toBe(n.strings_required * 2);
    expect(twoN.total_battery_energy_kwh).toBeCloseTo(n.total_battery_energy_kwh * 2, 0);
    expect(twoN.independent_bus_count).toBe(2);
  });

  it("shorter runtime → harsher derating (5 min usable fraction ≈ 0.23 VRLA)", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 500, redundancy: "N", runtime_minutes: 5,
      battery_type: "VRLA",
    });
    expect(r.battery_configuration.rate_derating_factor).toBeCloseTo(0.23, 2);
  });
});

describe("GOLDEN: recommendation logic [ACTIVE — MAJOR-2 fixed 2026-07-03]", () => {
  it("2N design at nominal loading must NOT suggest right-sizing", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 800, redundancy: "2N", runtime_minutes: 10,
      battery_type: "VRLA", growth_factor: 1.2,
    });
    const rightSizing = r.recommendations.filter((x) => x.toLowerCase().includes("right-siz"));
    expect(rightSizing).toHaveLength(0);
  });

  it("methodology note discloses derating, aging, and bus count", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 400, redundancy: "2N", runtime_minutes: 15,
      battery_type: "VRLA",
    });
    const note = r.recommendations.find((x) => x.includes("Sizing methodology"));
    expect(note).toBeDefined();
    expect(note).toContain("44%");
    expect(note).toContain("1.25");
    expect(note).toContain("2 independent");
  });
});
