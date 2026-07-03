// tests/golden/power.golden.test.ts
// GOLDEN TESTS — see header in ups-sizing.golden.test.ts for the rules.

import { calculatePowerRedundancy } from "../../src/services/power-engine.js";

describe("GOLDEN: power topology arithmetic [ACTIVE]", () => {
  it("800kW @ 500kW modules: N→2, N+1→3, 2N→4, 2N+1→5 UPS modules", () => {
    const base = { it_load_kw: 800, redundancy_config: "N" as const };
    expect(calculatePowerRedundancy({ ...base, redundancy_config: "N" }).ups_module_count).toBe(2);
    expect(calculatePowerRedundancy({ ...base, redundancy_config: "N+1" }).ups_module_count).toBe(3);
    expect(calculatePowerRedundancy({ ...base, redundancy_config: "2N" }).ups_module_count).toBe(4);
    expect(calculatePowerRedundancy({ ...base, redundancy_config: "2N+1" }).ups_module_count).toBe(5);
  });

  it("efficiency chain: 0.95 × 0.98 × 0.985 → 91.7% overall, losses ≈ 72.6kW @ 800kW IT", () => {
    const r = calculatePowerRedundancy({ it_load_kw: 800, redundancy_config: "N" });
    expect(r.electrical_efficiency_pct).toBeCloseTo(91.7, 0);
    expect(r.total_electrical_loss_kw).toBeCloseTo(800 / (0.95 * 0.98 * 0.985) - 800, 0);
  });
});

describe("GOLDEN: generator sizing [PENDING — enable after MAJOR-6 fix]", () => {
  // Generators must carry facility load (IT × PUE), not IT alone.
  // 3000 kW IT, PUE 1.4, margin 1.25, 2000 kW gensets:
  //   current (wrong):  3000 × 1.25 / 2000 = 1.875 → 2 generators
  //   corrected:        3000 × 1.4 × 1.25 / 2000 = 2.625 → 3 generators (N)
  it.skip("3000kW IT, N config → ≥3 gensets of 2000kW (facility load, not IT load)", () => {
    const r = calculatePowerRedundancy({ it_load_kw: 3000, redundancy_config: "N" });
    expect(r.generator_count).toBeGreaterThanOrEqual(3);
  });
});

describe("GOLDEN: recommendation logic [ACTIVE — MAJOR-2 fixed 2026-07-03]", () => {
  it("2N at nominal loading must NOT suggest smaller modules", () => {
    const r = calculatePowerRedundancy({ it_load_kw: 1000, redundancy_config: "2N" });
    const bad = r.recommendations.filter((x) => x.toLowerCase().includes("smaller modules"));
    expect(bad).toHaveLength(0);
  });
});
