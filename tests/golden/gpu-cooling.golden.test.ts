// tests/golden/gpu-cooling.golden.test.ts
// GOLDEN TESTS — see header in ups-sizing.golden.test.ts for the rules.

import { calculateGPUCooling } from "../../src/services/gpu-cooling-engine.js";
import type { GPUCoolingInput } from "../../src/types.js";

const base: GPUCoolingInput = {
  gpu_count: 1024,
  gpu_model: "H100",
  rack_count: 32,
  cooling_type: "direct_liquid",
  ambient_temp_f: 75,
  pue_target: 1.15,
  electricity_cost_per_kwh: 0.08,
};

describe("GOLDEN: GPU load arithmetic [ACTIVE]", () => {
  it("1024 × H100 (700W) → 716.8 kW GPU load; +15% overhead → 824.32 kW", () => {
    const r = calculateGPUCooling(base);
    expect(r.total_gpu_load_kw).toBeCloseTo(716.8, 1);
    expect(r.total_it_load_with_overhead_kw).toBeCloseTo(824.32, 1);
  });

  it("chilled water tons = kW × 3412 / 12000 (824.32 kW → ~234.4 tons)", () => {
    const r = calculateGPUCooling(base);
    expect(r.chilled_water_capacity_tons).toBeCloseTo((824.32 * 3412) / 12000, 0);
  });

  it("annual energy cost = kW × PUE × 8760 × $/kWh (label: full-load assumption, see MAJOR-9)", () => {
    const r = calculateGPUCooling(base);
    const expected = 824.32 * 1.15 * 8760 * 0.08;
    expect(r.annual_facility_energy_cost_liquid_kw).toBeCloseTo(expected, -3);
  });
});

describe("GOLDEN: coolant flow rate [ACTIVE — CRITICAL-3 fixed 2026-07-03]", () => {
  // Water-side sensible heat: Q(BTU/hr) = 500 × GPM × ΔT°F
  //   → GPM = kW × 3412 / (500 × ΔT)
  // At ΔT = 15°F: 0.455 GPM per kW. 824.32 kW → ~375 GPM.
  it("824 kW @ ΔT 15°F → ~375 GPM (±5%), not ~1,319 GPM", () => {
    const r = calculateGPUCooling(base);
    const expected = (824.32 * 3412) / (500 * 15);
    expect(r.coolant_flow_rate_gpm).toBeGreaterThan(expected * 0.95);
    expect(r.coolant_flow_rate_gpm).toBeLessThan(expected * 1.05);
  });
});

describe("GOLDEN: input honesty [PENDING — enable after MAJOR-8 fix]", () => {
  it.skip("pue_target must influence the output (currently required-but-ignored)", () => {
    const a = calculateGPUCooling({ ...base, pue_target: 1.1 });
    const b = calculateGPUCooling({ ...base, pue_target: 2.0 });
    // After fix: some field (warning, comparison, or cost) must differ.
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
