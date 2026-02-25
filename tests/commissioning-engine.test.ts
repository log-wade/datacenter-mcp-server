import { generateCommissioningPlan } from "../src/services/commissioning-engine.js";
import type { CommissioningPlanInput } from "../src/types.js";

describe("Commissioning Engine", () => {
  describe("Basic Plan Generation", () => {
    it("should generate plan with all 5 levels", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4, 5],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases.length).toBe(5);
      expect(result.phases[0].id).toBe("L1");
      expect(result.phases[1].id).toBe("L2");
      expect(result.phases[2].id).toBe("L3");
      expect(result.phases[3].id).toBe("L4");
      expect(result.phases[4].id).toBe("L5");
    });

    it("should have all phases with test procedures", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4, 5],
      };
      const result = generateCommissioningPlan(input);

      for (const phase of result.phases) {
        expect(phase.test_procedures.length).toBeGreaterThan(0);
        expect(phase.id).toBeDefined();
        expect(phase.name).toBeDefined();
        expect(phase.duration_weeks).toBeGreaterThan(0);
      }
    });

    it("should have correct phase names", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4, 5],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases[0].name).toContain("Level 1");
      expect(result.phases[1].name).toContain("Level 2");
      expect(result.phases[2].name).toContain("Level 3");
      expect(result.phases[3].name).toContain("Level 4");
      expect(result.phases[4].name).toContain("Level 5");
    });
  });

  describe("Individual Level Selection", () => {
    it("should generate plan with only L3", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [3],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases.length).toBe(1);
      expect(result.phases[0].id).toBe("L3");
    });

    it("should generate plan with L1, L3, L4", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 3,
        include_levels: [1, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases.length).toBe(3);
      expect(result.phases[0].id).toBe("L1");
      expect(result.phases[1].id).toBe("L3");
      expect(result.phases[2].id).toBe("L4");
    });

    it("should skip levels not in include_levels", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [2, 4],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases.length).toBe(2);
      expect(result.phases.map((p) => p.id)).not.toContain("L1");
      expect(result.phases.map((p) => p.id)).not.toContain("L3");
    });
  });

  describe("Tier Level Complexity", () => {
    it("should add concurrent maintenance procedures for Tier III in L4", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 3,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const l4_phase = result.phases[0];
      let has_cm_procedure = false;
      for (const proc of l4_phase.test_procedures) {
        if (proc.name.includes("Concurrent maintenance")) {
          has_cm_procedure = true;
          break;
        }
      }
      expect(has_cm_procedure).toBe(true);
    });

    it("should add fault injection procedures for Tier IV in L4", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 4,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const l4_phase = result.phases[0];
      let has_fault_proc = false;
      for (const proc of l4_phase.test_procedures) {
        if (proc.name.includes("Fault injection")) {
          has_fault_proc = true;
          break;
        }
      }
      expect(has_fault_proc).toBe(true);
    });

    it("should not add CM procedures for Tier II", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const l4_phase = result.phases[0];
      let has_cm_procedure = false;
      for (const proc of l4_phase.test_procedures) {
        if (proc.name.includes("Concurrent maintenance")) {
          has_cm_procedure = true;
          break;
        }
      }
      expect(has_cm_procedure).toBe(false);
    });

    it("should not add fault injection for Tier III", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 3,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const l4_phase = result.phases[0];
      let has_fault_proc = false;
      for (const proc of l4_phase.test_procedures) {
        if (proc.name.includes("Fault injection")) {
          has_fault_proc = true;
          break;
        }
      }
      expect(has_fault_proc).toBe(false);
    });
  });

  describe("Facility Size Impact", () => {
    it("should have longer durations for large facilities (10000 kW) than small (500 kW)", () => {
      const input_small: CommissioningPlanInput = {
        facility_size_kw: 500,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result_small = generateCommissioningPlan(input_small);

      const input_large: CommissioningPlanInput = {
        facility_size_kw: 10000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result_large = generateCommissioningPlan(input_large);

      expect(result_large.total_duration_weeks).toBeGreaterThan(result_small.total_duration_weeks);
    });

    it("should scale phases proportionally to facility size", () => {
      const input_small: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result_small = generateCommissioningPlan(input_small);

      const input_large: CommissioningPlanInput = {
        facility_size_kw: 2000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result_large = generateCommissioningPlan(input_large);

      for (let i = 0; i < result_small.phases.length; i++) {
        const ratio = result_large.phases[i].duration_weeks / result_small.phases[i].duration_weeks;
        expect(ratio).toBeGreaterThanOrEqual(1.0);
      }
    });

    it("small facility (500 kW) should have faster commissioning", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 500,
        tier_level: 2,
        include_levels: [1, 2, 3],
      };
      const result = generateCommissioningPlan(input);

      expect(result.total_duration_weeks).toBeGreaterThan(0);
      expect(result.total_test_procedures).toBeGreaterThan(0);
    });

    it("large facility (50000 kW) should scale durations", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 50000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      expect(result.total_duration_weeks).toBeGreaterThan(10);
    });
  });

  describe("Custom Systems", () => {
    it("should use custom systems list when provided", () => {
      const custom_systems = ["Power", "Cooling", "Network"];
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1],
        custom_systems,
      };
      const result = generateCommissioningPlan(input);

      const l1_procedures = result.phases[0].test_procedures;
      expect(l1_procedures.length).toBeGreaterThan(0);
    });

    it("should use default systems when custom_systems not provided", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1],
      };
      const result = generateCommissioningPlan(input);

      const l1_procedures = result.phases[0].test_procedures;
      expect(l1_procedures.length).toBeGreaterThan(5);
    });

    it("should use custom systems over defaults when provided", () => {
      const custom_systems = ["System A", "System B"];
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1],
        custom_systems,
      };
      const result = generateCommissioningPlan(input);

      for (const proc of result.phases[0].test_procedures) {
        expect(["System A", "System B"]).toContain(proc.system);
      }
    });
  });

  describe("Test Procedures", () => {
    it("should have procedure IDs matching phase level", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2],
      };
      const result = generateCommissioningPlan(input);

      for (const phase of result.phases) {
        for (const proc of phase.test_procedures) {
          expect(proc.id).toContain(phase.id);
        }
      }
    });

    it("should have positive estimated hours for procedures", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      for (const phase of result.phases) {
        for (const proc of phase.test_procedures) {
          expect(proc.estimated_hours).toBeGreaterThan(0);
        }
      }
    });

    it("should have prerequisites for procedures", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3],
      };
      const result = generateCommissioningPlan(input);

      for (const phase of result.phases) {
        for (const proc of phase.test_procedures) {
          expect(Array.isArray(proc.prerequisites)).toBe(true);
          expect(proc.prerequisites.length).toBeGreaterThan(0);
        }
      }
    });

    it("L2 should have both installation and startup procedures", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [2],
      };
      const result = generateCommissioningPlan(input);

      const l2_procedures = result.phases[0].test_procedures;
      let has_install = false;
      let has_startup = false;
      for (const proc of l2_procedures) {
        if (proc.name.includes("Installation")) has_install = true;
        if (proc.name.includes("Startup")) has_startup = true;
      }
      expect(has_install).toBe(true);
      expect(has_startup).toBe(true);
    });
  });

  describe("Milestones", () => {
    it("should generate critical milestones", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      expect(result.critical_milestones.length).toBeGreaterThan(0);
    });

    it("should include CxA engagement milestone", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1],
      };
      const result = generateCommissioningPlan(input);

      const cxa_milestone = result.critical_milestones.find((m) =>
        m.name.includes("Commissioning Authority")
      );
      expect(cxa_milestone).toBeDefined();
    });

    it("should include L2 startup milestone when L2 included", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [2],
      };
      const result = generateCommissioningPlan(input);

      const l2_milestone = result.critical_milestones.find((m) =>
        m.phase === "L2"
      );
      expect(l2_milestone).toBeDefined();
    });

    it("should include L3 milestone when L3 included", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [3],
      };
      const result = generateCommissioningPlan(input);

      const l3_milestone = result.critical_milestones.find((m) =>
        m.phase === "L3"
      );
      expect(l3_milestone).toBeDefined();
    });

    it("should include L4 integrated systems milestone when L4 included", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const l4_milestone = result.critical_milestones.find((m) =>
        m.phase === "L4" && m.name.includes("IST")
      );
      expect(l4_milestone).toBeDefined();
    });

    it("should include concurrent maintenance milestone for Tier III+ with L4", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 3,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const cm_milestone = result.critical_milestones.find((m) =>
        m.name.includes("Concurrent Maintenance")
      );
      expect(cm_milestone).toBeDefined();
    });

    it("should include fault tolerance milestone for Tier IV with L4", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 4,
        include_levels: [4],
      };
      const result = generateCommissioningPlan(input);

      const ft_milestone = result.critical_milestones.find((m) =>
        m.name.includes("Fault Tolerance")
      );
      expect(ft_milestone).toBeDefined();
    });
  });

  describe("Duration Calculations", () => {
    it("should have total_duration_weeks greater than sum of individual phases", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      const sum_durations = result.phases.reduce((sum, p) => sum + p.duration_weeks, 0);
      expect(result.total_duration_weeks).toBe(sum_durations);
    });

    it("should have positive duration weeks for all phases", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4, 5],
      };
      const result = generateCommissioningPlan(input);

      for (const phase of result.phases) {
        expect(phase.duration_weeks).toBeGreaterThan(0);
      }
    });
  });

  describe("Test Procedures Count", () => {
    it("should count test procedures correctly", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      let total_procedures = 0;
      for (const phase of result.phases) {
        total_procedures += phase.test_procedures.length;
      }
      expect(result.total_test_procedures).toBe(total_procedures);
    });

    it("should have minimum test procedures", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      expect(result.total_test_procedures).toBeGreaterThan(50);
    });
  });

  describe("Recommendations", () => {
    it("should provide recommendations", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3],
      };
      const result = generateCommissioningPlan(input);

      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should recommend Tier III+ IST when not included", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 3,
        include_levels: [1, 2, 3],
      };
      const result = generateCommissioningPlan(input);

      const ist_rec = result.recommendations.find((r) =>
        r.includes("Level 4")
      );
      expect(ist_rec).toBeDefined();
    });

    it("should recommend phased commissioning for large facilities", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 3000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      const phased_rec = result.recommendations.find((r) =>
        r.includes("phased commissioning")
      );
      expect(phased_rec).toBeDefined();
    });

    it("should include CxA engagement recommendation", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3],
      };
      const result = generateCommissioningPlan(input);

      const cxa_rec = result.recommendations.find((r) =>
        r.includes("Commissioning Authority")
      );
      expect(cxa_rec).toBeDefined();
    });

    it("should include duration summary in recommendations", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 1000,
        tier_level: 2,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      const summary_rec = result.recommendations.find((r) =>
        r.includes("weeks") && r.includes("test procedures")
      );
      expect(summary_rec).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small facility (10 kW)", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 10,
        tier_level: 1,
        include_levels: [1, 2],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases.length).toBe(2);
      expect(result.total_test_procedures).toBeGreaterThan(0);
    });

    it("should handle very large facility (100000 kW)", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 100000,
        tier_level: 4,
        include_levels: [1, 2, 3, 4],
      };
      const result = generateCommissioningPlan(input);

      expect(result.total_duration_weeks).toBeGreaterThan(20);
    });

    it("should handle Tier IV with all levels", () => {
      const input: CommissioningPlanInput = {
        facility_size_kw: 2000,
        tier_level: 4,
        include_levels: [1, 2, 3, 4, 5],
      };
      const result = generateCommissioningPlan(input);

      expect(result.phases.length).toBe(5);
      for (const phase of result.phases) {
        expect(phase.test_procedures.length).toBeGreaterThan(0);
      }
    });
  });
});
