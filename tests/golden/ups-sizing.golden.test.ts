// tests/golden/ups-sizing.golden.test.ts
// GOLDEN TESTS — outputs verified against external engineering references,
// not against the code's own behavior. A golden test failing means the MATH
// is wrong, not the code. Never adjust an expected value to make a test pass;
// adjust it only when the cited source says so.
//
// Status legend:
//   [ACTIVE]  — verifiable arithmetic/logic; must pass today
//   [PENDING] — encodes corrected physics per CODE-AUDIT.md; `it.skip` until
//               CRITICAL-1/2 and MAJOR-1 are fixed, then enable. DO NOT DELETE.
//
// Sources to attach per case before de-beta (see Engineering QA Protocol):
//   - IEEE 485 (lead-acid sizing methodology: rate-adjusted capacity, 1.25 aging factor)
//   - Manufacturer constant-power tables at 10/15-min rates (Eaton/Vertiv published data)
//   - Logan's verified past project calcs (anonymized)

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

  it("ideal energy math sanity: 500kW design, 15 min, η=0.96 → 130.2 kWh ideal", () => {
    // E = 500 × (15/60) / 0.96 = 130.21 kWh. This verifies the CURRENT formula's
    // arithmetic only — the formula itself is flagged CRITICAL-1 (no rate derating).
    const r = calculateUPSSizing({
      critical_load_kw: 500 / 1.2, redundancy: "N", runtime_minutes: 15,
      battery_type: "VRLA", ups_efficiency: 0.96, growth_factor: 1.2,
    });
    expect(r.battery_configuration.total_battery_energy_kwh).toBeCloseTo(130.21, 0);
  });
});

describe("GOLDEN: rate-adjusted battery sizing [PENDING — enable after CRITICAL-1/2 fix]", () => {
  // Reference case (verify against IEEE 485 worked example + one manufacturer
  // constant-power table before enabling; record source in this comment):
  //
  // 500 kW design load, 15-minute runtime, VRLA, η = 0.96
  //   Ideal energy:        130.2 kWh
  //   Rate derating @15min: ~0.55 usable fraction (VRLA, typical high-rate bloc)  [VERIFY vs mfr table]
  //   Aging factor:         1.25 (IEEE 485)
  //   Required nameplate:   130.2 / 0.55 × 1.25 ≈ 296 kWh  → ~2.3× the ideal figure
  //
  // The current engine returns ~130 kWh — roughly HALF the defensible nameplate.

  it.skip("500kW/15min VRLA → nameplate energy ≈ 296 kWh (±10%), not 130 kWh", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 500 / 1.2, redundancy: "N", runtime_minutes: 15,
      battery_type: "VRLA", ups_efficiency: 0.96, growth_factor: 1.2,
    });
    const kwh = r.battery_configuration.total_battery_energy_kwh;
    expect(kwh).toBeGreaterThan(296 * 0.9);
    expect(kwh).toBeLessThan(296 * 1.1);
  });

  it.skip("Li-ion applies usable-DoD factor (nameplate > ideal energy)", () => {
    const r = calculateUPSSizing({
      critical_load_kw: 500 / 1.2, redundancy: "N", runtime_minutes: 15,
      battery_type: "lithium_ion", ups_efficiency: 0.96, growth_factor: 1.2,
    });
    // With 90% usable DoD + aging, nameplate must exceed the 130.2 kWh ideal figure.
    expect(r.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(130.21);
  });

  it.skip("2N topology → battery plant per bus (2× strings vs N) [MAJOR-1]", () => {
    const base: UPSSizingInput = {
      critical_load_kw: 800, redundancy: "N", runtime_minutes: 10,
      battery_type: "VRLA", growth_factor: 1.2,
    };
    const n = calculateUPSSizing(base).battery_configuration.strings_required;
    const twoN = calculateUPSSizing({ ...base, redundancy: "2N" }).battery_configuration.strings_required;
    expect(twoN).toBe(n * 2);
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
});
