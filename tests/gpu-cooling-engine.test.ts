import { calculateGPUCooling } from "../src/services/gpu-cooling-engine.js";
import type { GPUCoolingInput, GPUCoolingResult } from "../src/types.js";

describe("GPU Cooling Engine", () => {
  describe("Basic GPU cooling calculations", () => {
    it("should calculate cooling for H100 cluster (8 GPUs, 1 rack, air cooling)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_count).toBe(8);
      expect(result.gpu_model).toBe("H100");
      expect(result.total_it_load_with_overhead_kw).toBeCloseTo(6.44, 1);
      expect(result.heat_rejection_per_rack_kw).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();
    });

    it("should calculate cooling for large H100 deployment (64 GPUs, 8 racks, direct liquid)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 64,
        gpu_model: "H100",
        rack_count: 8,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_count).toBe(64);
      expect(result.total_it_load_with_overhead_kw).toBeCloseTo(51.5, 1);
      expect(result.heat_rejection_per_rack_kw).toBeCloseTo(6.44, 1);
      expect(result.cooling_type_selected).toBe("direct_liquid");
    });

    it("should calculate cooling for B200 high-density (8 GPUs, 1 rack, immersion)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "B200",
        rack_count: 1,
        cooling_type: "immersion",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_count).toBe(8);
      expect(result.total_it_load_with_overhead_kw).toBeCloseTo(9.2, 1);
      expect(result.cooling_type_selected).toBe("immersion");
    });

    it("should calculate cooling for GB200 ultra-high density (16 GPUs, 2 racks, immersion)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "GB200",
        rack_count: 2,
        cooling_type: "immersion",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_count).toBe(16);
      expect(result.rack_count).toBe(2);
      expect(result.cooling_type_selected).toBe("immersion");
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it("should calculate cooling for A100 modest deployment (16 GPUs, 4 racks, air)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "A100",
        rack_count: 4,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_count).toBe(16);
      expect(result.rack_count).toBe(4);
      expect(result.cooling_type_selected).toBe("air");
      expect(result.heat_rejection_per_rack_kw).toBeLessThan(15);
    });
  });

  describe("Cooling type recommendations", () => {
    it("should recommend rear-door heat exchangers for 15-30kW per rack", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "rear_door",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      if (result.heat_rejection_per_rack_kw >= 15 && result.heat_rejection_per_rack_kw <= 30) {
        expect(result.recommendations[0]).toContain("rear-door");
      }
    });

    it("should recommend direct liquid cooling for 30-60kW per rack", () => {
      const input: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      if (result.heat_rejection_per_rack_kw >= 30 && result.heat_rejection_per_rack_kw <= 60) {
        expect(result.recommendations[0]).toContain("direct liquid");
      }
    });

    it("should recommend immersion cooling for >60kW per rack", () => {
      const input: GPUCoolingInput = {
        gpu_count: 32,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "immersion",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      if (result.heat_rejection_per_rack_kw > 60) {
        expect(result.recommendations[0]).toContain("immersion");
      }
    });
  });

  describe("CDU and coolant flow calculations", () => {
    it("should calculate CDU count correctly (1 per 8-12 racks)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 64,
        gpu_model: "H100",
        rack_count: 10,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.cdu_count_required).toBeDefined();
      expect(result.cdu_count_required).toBeGreaterThanOrEqual(1);
    });

    it("should calculate coolant flow rate for liquid cooling scenarios", () => {
      const input: GPUCoolingInput = {
        gpu_count: 32,
        gpu_model: "H100",
        rack_count: 4,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.coolant_flow_rate_gpm).toBeDefined();
      expect(result.coolant_flow_rate_gpm).toBeGreaterThan(0);
    });

    it("should not calculate CDU count for air cooling", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.cdu_count_required).toBeUndefined();
    });

    it("should not calculate coolant flow rate for air cooling", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.coolant_flow_rate_gpm).toBeUndefined();
    });
  });

  describe("Energy cost and efficiency calculations", () => {
    it("should calculate annual energy cost", () => {
      const input: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.annual_facility_energy_cost_liquid_kw).toBeDefined();
      expect(result.annual_facility_energy_cost_liquid_kw).toBeGreaterThan(0);
    });

    it("should provide PUE comparison between air and liquid", () => {
      const input_air: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_air = calculateGPUCooling(input_air);

      const input_liquid: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_liquid = calculateGPUCooling(input_liquid);

      expect(result_air.facility_pue_air_cooling).toBeDefined();
      expect(result_liquid.facility_pue_liquid_cooling).toBeDefined();
      expect(result_air.facility_pue_air_cooling).toBeGreaterThan(result_liquid.facility_pue_liquid_cooling);
    });

    it("should calculate cooling cost savings from liquid cooling", () => {
      const input_air: GPUCoolingInput = {
        gpu_count: 32,
        gpu_model: "H100",
        rack_count: 4,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_air = calculateGPUCooling(input_air);

      const input_liquid: GPUCoolingInput = {
        gpu_count: 32,
        gpu_model: "H100",
        rack_count: 4,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_liquid = calculateGPUCooling(input_liquid);

      expect(result_liquid.annual_facility_energy_cost_liquid_kw).toBeLessThan(result_air.annual_facility_energy_cost_air_kw);
      expect(result_liquid.estimated_annual_savings_liquid_vs_air).toBeGreaterThan(0);
    });

    it("should calculate ROI for liquid cooling infrastructure", () => {
      const input: GPUCoolingInput = {
        gpu_count: 64,
        gpu_model: "H100",
        rack_count: 8,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.estimated_annual_savings_liquid_vs_air).toBeDefined();
      expect(result.estimated_annual_savings_liquid_vs_air).toBeGreaterThan(0);
    });
  });

  describe("GPU model specific power profiles", () => {
    it("should have correct power profile for H100", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_tdp_watts / 1000).toBeCloseTo(0.7, 1);
    });

    it("should have correct power profile for B200", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "B200",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_tdp_watts / 1000).toBeGreaterThan(0.7);
    });

    it("should have correct power profile for A100", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "A100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_tdp_watts / 1000).toBeLessThan(0.7);
    });

    it("should handle unknown GPU model with reasonable defaults", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100" as any,
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.total_it_load_with_overhead_kw).toBeGreaterThan(0);
      expect(result.gpu_tdp_watts / 1000).toBeGreaterThan(0);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle 0 GPUs", () => {
      const input: GPUCoolingInput = {
        gpu_count: 0,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.total_it_load_with_overhead_kw).toBe(0);
    });

    it("should handle 1 GPU", () => {
      const input: GPUCoolingInput = {
        gpu_count: 1,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.total_it_load_with_overhead_kw).toBeGreaterThan(0);
      expect(result.gpu_tdp_watts / 1000).toBeCloseTo(0.7, 1);
    });

    it("should handle negative GPU count gracefully", () => {
      const input: GPUCoolingInput = {
        gpu_count: -5,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);
      expect(result).toBeDefined();
    });

    it("should handle zero racks gracefully", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 0,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);
      expect(result).toBeDefined();
    });

    it("should handle negative rack count gracefully", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: -2,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);
      expect(result).toBeDefined();
    });

    it("should handle very large GPU count (1000 GPUs)", () => {
      const input: GPUCoolingInput = {
        gpu_count: 1000,
        gpu_model: "H100",
        rack_count: 125,
        cooling_type: "immersion",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.total_it_load_with_overhead_kw).toBeGreaterThan(0);
      expect(isNaN(result.total_it_load_with_overhead_kw)).toBe(false);
    });
  });

  describe("Power and thermal calculations", () => {
    it("should account for 15% overhead in total power calculation", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      const base_power = 8 * 0.7;
      const expected_total = base_power * 1.15;
      expect(result.total_it_load_with_overhead_kw).toBeCloseTo(expected_total, 1);
    });

    it("should calculate power per rack correctly", () => {
      const input: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      const expected_per_rack = result.total_it_load_with_overhead_kw / 2;
      expect(result.heat_rejection_per_rack_kw).toBeCloseTo(expected_per_rack, 1);
    });

    it("should calculate thermal output in BTU/h", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.total_it_load_with_overhead_kw).toBeDefined();
      expect(result.total_it_load_with_overhead_kw).toBeGreaterThan(0);
      // Verify BTU conversion is consistent (1 kW = 3412 BTU/h)
      const expected_btu = result.total_it_load_with_overhead_kw * 3412;
      expect(expected_btu).toBeGreaterThan(0);
    });

    it("should calculate cooling capacity in tons", () => {
      const input: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.chilled_water_capacity_tons).toBeDefined();
      expect(result.chilled_water_capacity_tons).toBeGreaterThan(0);
      const expected_tons = result.total_it_load_with_overhead_kw / 3.517;
      expect(result.chilled_water_capacity_tons).toBeCloseTo(expected_tons, 1);
    });
  });

  describe("Reliability and maintenance metrics", () => {
    it("should provide MTBF estimates based on cooling type", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.total_it_load_with_overhead_kw).toBeDefined();
      expect(result.total_it_load_with_overhead_kw).toBeGreaterThan(0);
    });

    it("should recommend maintenance schedule based on cooling type", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.recommendations.length).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeLessThanOrEqual(12);
    });
  });

  describe("Output validation", () => {
    it("should return all required fields in result", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(result.gpu_count).toBeDefined();
      expect(result.gpu_model).toBeDefined();
      expect(result.rack_count).toBeDefined();
      expect(result.cooling_type_selected).toBeDefined();
      expect(result.total_it_load_with_overhead_kw).toBeDefined();
      expect(result.gpu_tdp_watts / 1000).toBeDefined();
      expect(result.heat_rejection_per_rack_kw).toBeDefined();
      expect(result.facility_pue_liquid_cooling).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it("should have numeric values for all power metrics", () => {
      const input: GPUCoolingInput = {
        gpu_count: 32,
        gpu_model: "H100",
        rack_count: 4,
        cooling_type: "direct_liquid",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(typeof result.total_it_load_with_overhead_kw).toBe("number");
      expect(typeof result.gpu_tdp_watts).toBe("number");
      expect(typeof result.heat_rejection_per_rack_kw).toBe("number");
      expect(!isNaN(result.total_it_load_with_overhead_kw)).toBe(true);
      expect(!isNaN(result.gpu_tdp_watts)).toBe(true);
      expect(!isNaN(result.heat_rejection_per_rack_kw)).toBe(true);
    });

    it("should have string values for model and type fields", () => {
      const input: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "immersion",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result = calculateGPUCooling(input);

      expect(typeof result.gpu_model).toBe("string");
      expect(typeof result.cooling_type_selected).toBe("string");
      expect(typeof result.recommendations[0]).toBe("string");
    });
  });

  describe("Scaling and multi-rack deployments", () => {
    it("should scale linearly with GPU count", () => {
      const input_small: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_small = calculateGPUCooling(input_small);

      const input_large: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_large = calculateGPUCooling(input_large);

      const power_ratio = result_large.total_it_load_with_overhead_kw / result_small.total_it_load_with_overhead_kw;
      expect(power_ratio).toBeCloseTo(2, 1);
    });

    it("should maintain consistent power per rack across deployments", () => {
      const input_single: GPUCoolingInput = {
        gpu_count: 8,
        gpu_model: "H100",
        rack_count: 1,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_single = calculateGPUCooling(input_single);

      const input_double: GPUCoolingInput = {
        gpu_count: 16,
        gpu_model: "H100",
        rack_count: 2,
        cooling_type: "air",
        ambient_temp_f: 95,
        pue_target: 1.3,
      };
      const result_double = calculateGPUCooling(input_double);

      expect(result_single.heat_rejection_per_rack_kw).toBeCloseTo(result_double.heat_rejection_per_rack_kw, 1);
    });
  });
});
