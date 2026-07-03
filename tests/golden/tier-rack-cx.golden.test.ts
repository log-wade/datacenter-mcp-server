// tests/golden/tier-rack-cx.golden.test.ts
// GOLDEN TESTS — see header in ups-sizing.golden.test.ts for the rules.

import { assessTierClassification } from "../../src/services/tier-engine.js";
import { analyzeRackDensity } from "../../src/services/rack-density-engine.js";
import { generateCommissioningPlan } from "../../src/services/commissioning-engine.js";

describe("GOLDEN: tier classification [ACTIVE]", () => {
  // Reference: Uptime Institute published availability figures.

  it("compliant Tier III → achieved 3, 99.982% uptime, 1.6h downtime", () => {
    const r = assessTierClassification({
      target_tier: 3,
      power_redundancy: "N+1",
      cooling_redundancy: "N+1",
      distribution_paths: 2,
      concurrently_maintainable: true,
      fault_tolerant: false,
      generator_backed: true,
      ups_runtime_minutes: 15,
      fire_suppression: true,
      monitoring_system: true,
    });
    expect(r.achieved_tier).toBe(3);
    expect(r.meets_target).toBe(true);
    expect(r.expected_uptime).toBeCloseTo(99.982, 3);
    expect(r.expected_annual_downtime_hours).toBeCloseTo(1.6, 1);
  });

  it("Tier IV target with N+1 power → critical gap, achieved < 4", () => {
    const r = assessTierClassification({
      target_tier: 4,
      power_redundancy: "N+1",
      cooling_redundancy: "2N",
      distribution_paths: 2,
      concurrently_maintainable: true,
      fault_tolerant: true,
      generator_backed: true,
    });
    expect(r.meets_target).toBe(false);
    expect(r.gaps.some((g) => g.requirement === "Power redundancy" && g.severity === "critical")).toBe(true);
    expect(r.achieved_tier).toBeLessThan(4);
  });

  it("Tier II without generator → critical gap, achieved Tier 1", () => {
    const r = assessTierClassification({
      target_tier: 2,
      power_redundancy: "N+1",
      cooling_redundancy: "N+1",
      distribution_paths: 1,
      concurrently_maintainable: false,
      fault_tolerant: false,
      generator_backed: false,
    });
    expect(r.achieved_tier).toBe(1);
    expect(r.gaps.some((g) => g.requirement === "Generator backup")).toBe(true);
  });
});

describe("GOLDEN: rack density [ACTIVE]", () => {
  it("20 racks × 8kW → 160kW total, medium density, containment required", () => {
    const r = analyzeRackDensity({ rack_count: 20, avg_kw_per_rack: 8 });
    expect(r.total_it_load_kw).toBeCloseTo(160, 1);
    expect(r.density_classification).toBe("Medium density");
    expect(r.containment_required).toBe(true);
    expect(r.liquid_cooling_recommended).toBe(false);
  });

  it("45 kW/rack → liquid-cooled class, liquid cooling recommended", () => {
    const r = analyzeRackDensity({ rack_count: 10, avg_kw_per_rack: 45 });
    expect(r.density_classification).toBe("Liquid-cooled");
    expect(r.liquid_cooling_recommended).toBe(true);
  });
});

describe("GOLDEN: rack airflow [PENDING — enable after MAJOR-5 fix]", () => {
  // CFM = 3412 × kW / (1.08 × ΔT°F); at ΔT 20°F → ~158 CFM/kW.
  // 10 kW/rack → ~1,580 CFM/rack (engine currently ~1,137 via 400 CFM/ton).
  it.skip("10 kW/rack @ ΔT 20°F → ~1,580 CFM per rack (±5%)", () => {
    const r = analyzeRackDensity({ rack_count: 10, avg_kw_per_rack: 10 });
    expect(r.estimated_airflow_per_rack_cfm).toBeGreaterThan(1580 * 0.95);
    expect(r.estimated_airflow_per_rack_cfm).toBeLessThan(1580 * 1.05);
  });
});

describe("GOLDEN: commissioning plan [ACTIVE + PENDING]", () => {
  it("[ACTIVE] Tier 4 L4 phase includes fault-injection procedures", () => {
    const r = generateCommissioningPlan({
      facility_size_kw: 3000,
      tier_level: 4,
      include_levels: [4],
    });
    const l4 = r.phases.find((p) => p.id === "L4");
    expect(l4).toBeDefined();
    expect(l4!.test_procedures.some((t) => t.name.toLowerCase().includes("fault injection"))).toBe(true);
  });

  // MAJOR-11: L5 (52 wks) is scaled by size × tier and summed serially.
  // 6MW Tier IV currently yields ~210 weeks total (~4 years) — absurd for a Cx plan.
  it.skip("6MW Tier IV full plan → total duration < 100 weeks (L5 not scaled/summed)", () => {
    const r = generateCommissioningPlan({
      facility_size_kw: 6000,
      tier_level: 4,
      include_levels: [1, 2, 3, 4, 5],
    });
    expect(r.total_duration_weeks).toBeLessThan(100);
  });
});
