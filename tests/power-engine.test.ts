import { calculatePowerRedundancy } from "../src/services/power-engine.js";
import type { PowerRedundancyInput } from "../src/types.js";

describe("Power Redundancy Engine", () => {
  describe("Configuration: N (No Redundancy)", () => {
    it("should calculate N configuration with no extra UPS modules", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.redundancy_config).toBe("N");
      expect(result.ups_module_count).toBe(2); // ceil(1000/500) = 2
      expect(result.switchgear_feeds).toBe(1);
      expect(result.concurrent_maintainability).toBe(false);
    });

    it("should not provide redundancy for N config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 750,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.concurrent_maintainability).toBe(false);
      expect(result.fault_tolerant).toBe(false);
    });

    it("should generate no-redundancy recommendation for N config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 500,
        redundancy_config: "N",
      };
      const result = calculatePowerRedundancy(input);

      const no_redundancy_rec = result.recommendations.find((r) =>
        r.includes("no redundancy")
      );
      expect(no_redundancy_rec).toBeDefined();
    });
  });

  describe("Configuration: N+1 (Single Redundancy)", () => {
    it("should add one extra UPS module for N+1", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N+1",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.redundancy_config).toBe("N+1");
      expect(result.ups_module_count).toBe(3); // ceil(1000/500) + 1 = 3
      expect(result.switchgear_feeds).toBe(1);
    });

    it("should calculate UPS loading for N+1 config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N+1",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      const total_capacity = 3 * 500; // 1500
      const expected_loading = (1000 / total_capacity) * 100;
      expect(result.ups_load_percentage).toBeCloseTo(expected_loading, 2);
    });
  });

  describe("Configuration: 2N (Full Redundancy)", () => {
    it("should double UPS modules for 2N config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.redundancy_config).toBe("2N");
      expect(result.ups_module_count).toBe(4); // ceil(1000/500) * 2 = 4
      expect(result.switchgear_feeds).toBe(2);
    });

    it("should enable concurrent maintainability for 2N config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.concurrent_maintainability).toBe(true);
      expect(result.fault_tolerant).toBe(true);
    });

    it("should create 2 switchgear feeds for 2N config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 2000,
        redundancy_config: "2N",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.switchgear_feeds).toBe(2);
    });
  });

  describe("Configuration: 2N+1", () => {
    it("should calculate 2N+1 with extra module", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N+1",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.redundancy_config).toBe("2N+1");
      expect(result.ups_module_count).toBe(5); // ceil(1000/500) * 2 + 1 = 5
    });

    it("should support fault tolerance for 2N+1", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N+1",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.concurrent_maintainability).toBe(true);
      expect(result.fault_tolerant).toBe(true);
    });
  });

  describe("UPS Loading Percentage", () => {
    it("should calculate UPS loading percentage correctly", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 800,
        redundancy_config: "N+1",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      const total_capacity = 3 * 500; // 1500
      const expected = (800 / total_capacity) * 100;
      expect(result.ups_load_percentage).toBeCloseTo(expected, 1);
    });

    it("should generate recommendation when UPS loading > 80%", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1250,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.ups_load_percentage).toBeGreaterThan(80);
      const loading_rec = result.recommendations.find((r) =>
        r.includes("exceeds recommended 80%")
      );
      expect(loading_rec).toBeDefined();
    });

    it("should generate recommendation when UPS loading < 40%", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 300,
        redundancy_config: "2N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.ups_load_percentage).toBeLessThan(40);
      const low_loading_rec = result.recommendations.find((r) =>
        r.includes("is low")
      );
      expect(low_loading_rec).toBeDefined();
    });
  });

  describe("Electrical Efficiency Chain", () => {
    it("should calculate electrical efficiency as UPS * PDU * Transformer", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        ups_efficiency: 0.95,
        pdu_efficiency: 0.98,
        transformer_efficiency: 0.985,
      };
      const result = calculatePowerRedundancy(input);

      const expected_chain = 0.95 * 0.98 * 0.985; // ~0.921
      const expected_efficiency_pct = expected_chain * 100;
      expect(result.electrical_efficiency_pct).toBeCloseTo(expected_efficiency_pct, 1);
    });

    it("should calculate total electrical input correctly", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        ups_efficiency: 0.95,
        pdu_efficiency: 0.98,
        transformer_efficiency: 0.985,
      };
      const result = calculatePowerRedundancy(input);

      const chain_efficiency = 0.95 * 0.98 * 0.985;
      const expected_input = 1000 / chain_efficiency;
      expect(result.total_electrical_loss_kw).toBeCloseTo(expected_input - 1000, 1);
    });

    it("should have positive electrical losses", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 500,
        redundancy_config: "N+1",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.total_electrical_loss_kw).toBeGreaterThan(0);
    });
  });

  describe("Generator Sizing", () => {
    it("should calculate generator count for N configuration", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        generator_size_kw: 2000,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.generator_count).toBeGreaterThan(0);
      expect(result.total_generator_capacity_kw).toBeGreaterThanOrEqual(1000 * 1.25); // Generator sizing factor
    });

    it("should have one extra generator for N+1", () => {
      const input_n: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        generator_size_kw: 2000,
      };
      const result_n = calculatePowerRedundancy(input_n);

      const input_n1: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N+1",
        generator_size_kw: 2000,
      };
      const result_n1 = calculatePowerRedundancy(input_n1);

      expect(result_n1.generator_count).toBe(result_n.generator_count + 1);
    });

    it("should double generators for 2N configuration", () => {
      const input_n: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        generator_size_kw: 2000,
      };
      const result_n = calculatePowerRedundancy(input_n);

      const input_2n: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N",
        generator_size_kw: 2000,
      };
      const result_2n = calculatePowerRedundancy(input_2n);

      expect(result_2n.generator_count).toBe(result_n.generator_count * 2);
    });
  });

  describe("Recommendations", () => {
    it("should recommend larger modules for high UPS loading", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1400,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      const rec = result.recommendations.find((r) =>
        r.includes("Consider larger modules")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend N+1 minimum for production workloads", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 500,
        redundancy_config: "N",
      };
      const result = calculatePowerRedundancy(input);

      const rec = result.recommendations.find((r) =>
        r.includes("N+1 minimum for production")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend 2N for large loads above 1000 kW with N+1", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1200,
        redundancy_config: "N+1",
      };
      const result = calculatePowerRedundancy(input);

      const rec = result.recommendations.find((r) =>
        r.includes("2N configuration")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend ATS testing for 2N/2N+1 configs", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N",
      };
      const result = calculatePowerRedundancy(input);

      const rec = result.recommendations.find((r) =>
        r.includes("automatic transfer switches")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend STS for 2N/2N+1 configs", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N",
      };
      const result = calculatePowerRedundancy(input);

      const rec = result.recommendations.find((r) =>
        r.includes("static transfer switches")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend high-efficiency equipment when losses are high", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        ups_efficiency: 0.85,
        pdu_efficiency: 0.90,
        transformer_efficiency: 0.95,
      };
      const result = calculatePowerRedundancy(input);

      if (result.total_electrical_loss_kw > result.it_load_kw * 0.15) {
        const rec = result.recommendations.find((r) =>
          r.includes("high-efficiency")
        );
        expect(rec).toBeDefined();
      }
    });
  });

  describe("Module count calculations", () => {
    it("should handle non-integer load division", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 750,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.ups_module_count).toBe(2); // ceil(750/500) = 2
      expect(result.total_ups_capacity_kw).toBe(1000);
    });

    it("should have equal PDU count to UPS modules for N config", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.pdu_count).toBe(result.ups_module_count);
    });

    it("should scale all counts proportionally with load", () => {
      const input_small: PowerRedundancyInput = {
        it_load_kw: 500,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result_small = calculatePowerRedundancy(input_small);

      const input_large: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result_large = calculatePowerRedundancy(input_large);

      expect(result_large.ups_module_count).toBeGreaterThanOrEqual(result_small.ups_module_count);
    });
  });

  describe("Edge cases", () => {
    it("should handle very large load (10000 kW)", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 10000,
        redundancy_config: "2N",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.ups_module_count).toBeGreaterThan(0);
      expect(result.total_ups_capacity_kw).toBeGreaterThanOrEqual(result.it_load_kw);
    });

    it("should handle small load (10 kW)", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 10,
        redundancy_config: "N+1",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.ups_module_count).toBeGreaterThan(0);
      expect(result.ups_load_percentage).toBeLessThan(100);
    });

    it("should handle load equal to module size", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 500,
        redundancy_config: "N",
        ups_module_size_kw: 500,
      };
      const result = calculatePowerRedundancy(input);

      expect(result.ups_module_count).toBe(1);
      expect(result.ups_load_percentage).toBeCloseTo(100, 1);
    });
  });

  describe("Output completeness", () => {
    it("should include all required fields in result", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "2N",
      };
      const result = calculatePowerRedundancy(input);

      expect(result.it_load_kw).toBeDefined();
      expect(result.redundancy_config).toBeDefined();
      expect(result.total_ups_capacity_kw).toBeDefined();
      expect(result.ups_module_count).toBeDefined();
      expect(result.ups_load_percentage).toBeDefined();
      expect(result.generator_count).toBeDefined();
      expect(result.concurrent_maintainability).toBeDefined();
      expect(result.fault_tolerant).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it("should have recommendations array", () => {
      const input: PowerRedundancyInput = {
        it_load_kw: 1000,
        redundancy_config: "N",
      };
      const result = calculatePowerRedundancy(input);

      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
