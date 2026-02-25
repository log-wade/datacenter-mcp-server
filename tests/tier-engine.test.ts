import { assessTierClassification } from "../src/services/tier-engine.js";
import type { TierAssessmentInput } from "../src/types.js";

describe("Tier Classification Engine", () => {
  describe("Tier I Assessment", () => {
    it("should pass Tier I with N power and basic setup", () => {
      const input: TierAssessmentInput = {
        target_tier: 1,
        power_redundancy: "N",
        cooling_redundancy: "N",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(1);
      expect(result.meets_target).toBe(true);
    });

    it("should have correct uptime for Tier I", () => {
      const input: TierAssessmentInput = {
        target_tier: 1,
        power_redundancy: "N",
        cooling_redundancy: "N",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result = assessTierClassification(input);

      expect(result.expected_uptime).toBeCloseTo(99.671, 2);
      expect(result.expected_annual_downtime_hours).toBeCloseTo(28.8, 1);
    });
  });

  describe("Tier II Assessment", () => {
    it("should pass Tier II with N+1 power, generator, and basic setup", () => {
      const input: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(2);
      expect(result.meets_target).toBe(true);
    });

    it("should fail Tier II without generator backup", () => {
      const input: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result = assessTierClassification(input);

      const generator_gap = result.gaps.find((g) => g.requirement === "Generator backup");
      expect(generator_gap).toBeDefined();
      expect(generator_gap?.severity).toBe("critical");
    });

    it("should have correct uptime for Tier II", () => {
      const input: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.expected_uptime).toBeCloseTo(99.741, 2);
    });
  });

  describe("Tier III Assessment", () => {
    it("should pass Tier III with N+1 power, 2 paths, CM, and generator", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(3);
      expect(result.meets_target).toBe(true);
    });

    it("should fail Tier III without concurrent maintainability", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const cm_gap = result.gaps.find((g) =>
        g.requirement === "Concurrent maintainability"
      );
      expect(cm_gap).toBeDefined();
      expect(cm_gap?.severity).toBe("critical");
    });

    it("should require 2 distribution paths for Tier III", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const path_gap = result.gaps.find((g) => g.requirement === "Distribution paths");
      expect(path_gap).toBeDefined();
    });

    it("should have correct uptime for Tier III", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.expected_uptime).toBeCloseTo(99.982, 2);
      expect(result.expected_annual_downtime_hours).toBeCloseTo(1.6, 1);
    });
  });

  describe("Tier IV Assessment", () => {
    it("should pass Tier IV with 2N power, 2 paths, CM, FT, and generator", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "2N",
        cooling_redundancy: "2N",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: true,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(4);
      expect(result.meets_target).toBe(true);
    });

    it("should fail Tier IV without fault tolerance", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "2N",
        cooling_redundancy: "2N",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const ft_gap = result.gaps.find((g) => g.requirement === "Fault tolerance");
      expect(ft_gap).toBeDefined();
      expect(ft_gap?.severity).toBe("critical");
    });

    it("should have correct uptime for Tier IV", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "2N",
        cooling_redundancy: "2N",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: true,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.expected_uptime).toBeCloseTo(99.995, 3);
      expect(result.expected_annual_downtime_hours).toBeCloseTo(0.4, 1);
    });

    it("should work with 2N+1 power for Tier IV", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "2N+1",
        cooling_redundancy: "2N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: true,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(4);
      expect(result.meets_target).toBe(true);
    });
  });

  describe("Gap Detection", () => {
    it("should detect power redundancy gap", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const power_gap = result.gaps.find((g) => g.requirement === "Power redundancy");
      expect(power_gap).toBeDefined();
      expect(power_gap?.severity).toBe("critical");
    });

    it("should detect cooling redundancy gap", () => {
      const input: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const cooling_gap = result.gaps.find((g) => g.requirement === "Cooling redundancy");
      expect(cooling_gap).toBeDefined();
    });

    it("should provide gap severity levels", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result = assessTierClassification(input);

      for (const gap of result.gaps) {
        expect(["critical", "major", "minor"]).toContain(gap.severity);
      }
    });
  });

  describe("Achieved Tier Calculation", () => {
    it("should downgrade to Tier II without concurrent maintainability when Tier III target", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBeLessThan(3);
    });

    it("should compute achieved tier correctly when below target", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBeLessThan(result.target_tier);
      expect(result.meets_target).toBe(false);
    });

    it("should stay at Tier I when all gaps present", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "N",
        cooling_redundancy: "N",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(1);
    });
  });

  describe("Recommendations", () => {
    it("should recommend dual distribution paths for Tier III+", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const dual_paths_rec = result.recommendations.find((r) =>
        r.includes("Dual distribution paths")
      );
      expect(dual_paths_rec).toBeDefined();
    });

    it("should recommend Tier IV fault tolerance details", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      const ft_rec = result.recommendations.find((r) =>
        r.includes("fault tolerance")
      );
      expect(ft_rec).toBeDefined();
    });

    it("should recommend certification when meeting target", () => {
      const input: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      if (result.meets_target) {
        const cert_rec = result.recommendations.find((r) =>
          r.includes("certification")
        );
        expect(cert_rec).toBeDefined();
      }
    });

    it("should provide gap summary in recommendations", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      if (result.achieved_tier < result.target_tier) {
        const gap_rec = result.recommendations.find((r) =>
          r.includes("critical gap")
        );
        expect(gap_rec).toBeDefined();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle Tier I target with full infrastructure", () => {
      const input: TierAssessmentInput = {
        target_tier: 1,
        power_redundancy: "2N",
        cooling_redundancy: "2N",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: true,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.achieved_tier).toBe(1);
      expect(result.meets_target).toBe(true);
    });

    it("should handle low UPS runtime", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
        ups_runtime_minutes: 5,
      };
      const result = assessTierClassification(input);

      const runtime_gap = result.gaps.find((g) => g.requirement === "UPS runtime");
      expect(runtime_gap).toBeDefined();
    });

    it("should validate fire suppression for Tier III", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
        fire_suppression: false,
      };
      const result = assessTierClassification(input);

      const fire_gap = result.gaps.find((g) =>
        g.requirement === "Fire suppression system"
      );
      expect(fire_gap).toBeDefined();
    });

    it("should validate monitoring for Tier II+", () => {
      const input: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
        monitoring_system: false,
      };
      const result = assessTierClassification(input);

      const monitoring_gap = result.gaps.find((g) =>
        g.requirement === "BMS/DCIM monitoring"
      );
      expect(monitoring_gap).toBeDefined();
    });
  });

  describe("Uptime Values", () => {
    it("should have higher uptime for higher tiers", () => {
      const input_t1: TierAssessmentInput = {
        target_tier: 1,
        power_redundancy: "N",
        cooling_redundancy: "N",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result_t1 = assessTierClassification(input_t1);

      const input_t2: TierAssessmentInput = {
        target_tier: 2,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result_t2 = assessTierClassification(input_t2);

      expect(result_t2.expected_uptime).toBeGreaterThan(result_t1.expected_uptime);
    });

    it("should match tier name in result", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N+1",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      expect(result.target_tier_name).toContain("Tier III");
      expect(result.achieved_tier_name).toContain("Tier");
    });
  });

  describe("Multiple Gaps", () => {
    it("should detect multiple critical gaps", () => {
      const input: TierAssessmentInput = {
        target_tier: 4,
        power_redundancy: "N",
        cooling_redundancy: "N",
        distribution_paths: 1,
        concurrently_maintainable: false,
        fault_tolerant: false,
        generator_backed: false,
      };
      const result = assessTierClassification(input);

      const critical_gaps = result.gaps.filter((g) => g.severity === "critical");
      expect(critical_gaps.length).toBeGreaterThan(1);
    });

    it("should have correct gap current_value fields", () => {
      const input: TierAssessmentInput = {
        target_tier: 3,
        power_redundancy: "N",
        cooling_redundancy: "N+1",
        distribution_paths: 2,
        concurrently_maintainable: true,
        fault_tolerant: false,
        generator_backed: true,
      };
      const result = assessTierClassification(input);

      for (const gap of result.gaps) {
        expect(gap.current_value).toBeDefined();
        expect(gap.target_value).toBeDefined();
      }
    });
  });
});
