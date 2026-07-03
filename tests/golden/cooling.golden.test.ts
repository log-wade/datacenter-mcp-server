// tests/golden/cooling.golden.test.ts
// GOLDEN TESTS — see header in ups-sizing.golden.test.ts for the rules.

import { calculateCoolingLoad } from "../../src/services/cooling-engine.js";

describe("GOLDEN: unit conversions [ACTIVE]", () => {
  // Physical constants — verifiable against any engineering handbook.

  it("1000 kW → 3,412,000 BTU/hr (3412 BTU/hr per kW)", () => {
    const r = calculateCoolingLoad({ it_load_kw: 1000, pue: 1.0, safety_factor: 1.0 });
    expect(r.cooling_load_btu).toBeCloseTo(r.cooling_load_kw * 3412, -2);
  });

  it("tons = kW / 3.517", () => {
    const r = calculateCoolingLoad({ it_load_kw: 351.7, pue: 1.0, safety_factor: 1.0 });
    expect(r.cooling_load_tons).toBeCloseTo(r.cooling_load_kw / 3.517, 1);
  });

  it("PUE 1.0, safety 1.0, no extras → cooling load equals IT load exactly", () => {
    const r = calculateCoolingLoad({ it_load_kw: 500, pue: 1.0, safety_factor: 1.0 });
    expect(r.cooling_load_kw).toBeCloseTo(500, 1);
  });
});

describe("GOLDEN: data center airflow [PENDING — enable after MAJOR-5 fix]", () => {
  // Sensible heat: CFM = 3412 × kW / (1.08 × ΔT°F)
  // At ΔT = 20°F: 158 CFM/kW ≈ 555 CFM/ton (NOT the comfort-HVAC 400 CFM/ton).
  // ΔT should become an input; 20°F is a reasonable containment-era default.

  it.skip("100 kW load @ ΔT 20°F → ~15,800 CFM (±5%)", () => {
    const r = calculateCoolingLoad({ it_load_kw: 100, pue: 1.0, safety_factor: 1.0 });
    expect(r.estimated_airflow_cfm).toBeGreaterThan(15800 * 0.95);
    expect(r.estimated_airflow_cfm).toBeLessThan(15800 * 1.05);
  });
});

describe("GOLDEN: altitude semantics [PENDING — enable after MAJOR-4 fix]", () => {
  it.skip("altitude changes required CAPACITY, not the heat LOAD", () => {
    const sea = calculateCoolingLoad({ it_load_kw: 500, pue: 1.4, safety_factor: 1.0, altitude_ft: 0 });
    const denver = calculateCoolingLoad({ it_load_kw: 500, pue: 1.4, safety_factor: 1.0, altitude_ft: 5280 });
    // After fix: load identical; a separate required_capacity field is inflated.
    expect(denver.cooling_load_kw).toBeCloseTo(sea.cooling_load_kw, 1);
    // expect(denver.required_capacity_kw).toBeGreaterThan(sea.required_capacity_kw);
  });
});
