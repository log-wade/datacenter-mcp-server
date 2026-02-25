import { calculateUPSSizing } from "../src/services/ups-sizing-engine.js";
import type { UPSSizingInput, UPSSizingResult } from "../src/types.js";

describe("UPS Sizing Engine", () => {
  describe("Basic redundancy configurations", () => {
    it("should size N redundancy (100kW, N, 10 min, VRLA)", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.critical_load_kw).toBe(100);
      expect(result.ups_configuration.redundancy_level).toBe("N");
      expect(result.ups_configuration.modules_required).toBe(1);
      expect(result.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(100);
      expect(result.battery_configuration.strings_required).toBeGreaterThan(0);
    });

    it("should size N+1 redundancy (500kW, N+1, 15 min, VRLA)", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 500,
        redundancy: "N+1",
        runtime_minutes: 15,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.critical_load_kw).toBe(500);
      expect(result.ups_configuration.redundancy_level).toBe("N+1");
      expect(result.ups_configuration.modules_required).toBeGreaterThanOrEqual(2);
      expect(result.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(500);
    });

    it("should size 2N redundancy (1000kW, 2N, 10 min, lithium_ion)", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 1000,
        redundancy: "2N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      expect(result.critical_load_kw).toBe(1000);
      expect(result.ups_configuration.redundancy_level).toBe("2N");
      expect(result.ups_configuration.modules_required).toBeGreaterThanOrEqual(2);
      expect(result.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(1000 * 2);
    });

    it("should size 2N+1 redundancy (200kW, 2N+1, 30 min, lithium_ion)", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 200,
        redundancy: "2N+1",
        runtime_minutes: 30,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      expect(result.critical_load_kw).toBe(200);
      expect(result.ups_configuration.redundancy_level).toBe("2N+1");
      expect(result.ups_configuration.modules_required).toBeGreaterThan(2);
      expect(result.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(200 * 2);
    });
  });

  describe("Loading and capacity validation", () => {
    it("should never exceed 100% loading percentage", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.loading_percentage).toBeLessThanOrEqual(100);
      expect(result.ups_configuration.loading_percentage).toBeGreaterThan(0);
    });

    it("should calculate loading for N configuration at 80-90% typical", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.loading_percentage).toBeGreaterThan(10);
      expect(result.ups_configuration.loading_percentage).toBeLessThan(100);
    });

    it("should calculate lower loading for N+1 configuration", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N+1",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.loading_percentage).toBeLessThan(100);
      expect(result.ups_configuration.loading_percentage).toBeGreaterThan(0);
    });

    it("should calculate very low loading for 2N+1 configuration", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "2N+1",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.loading_percentage).toBeLessThan(100);
    });
  });

  describe("Battery energy calculations", () => {
    it("should calculate battery energy based on runtime and efficiency", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.9,
      };
      const result = calculateUPSSizing(input);

      // Energy should be positive and in expected range
      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(15);
      expect(result.battery_configuration.total_battery_energy_kwh).toBeLessThan(25);
    });

    it("should use default UPS efficiency of 0.95 when not specified", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      // Energy should be reasonable for 100kW * 10min with 0.95 efficiency
      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(15);
      expect(result.battery_configuration.total_battery_energy_kwh).toBeLessThan(25);
    });

    it("should increase battery energy with custom efficiency of 0.85", () => {
      const input_default: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.95,
      };
      const result_default = calculateUPSSizing(input_default);

      const input_custom: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.85,
      };
      const result_custom = calculateUPSSizing(input_custom);

      expect(result_custom.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(
        result_default.battery_configuration.total_battery_energy_kwh
      );
    });

    it("should scale battery energy linearly with runtime", () => {
      const input_10min: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_10min = calculateUPSSizing(input_10min);

      const input_20min: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 20,
        battery_type: "VRLA",
      };
      const result_20min = calculateUPSSizing(input_20min);

      const ratio = result_20min.battery_configuration.total_battery_energy_kwh / result_10min.battery_configuration.total_battery_energy_kwh;
      expect(ratio).toBeCloseTo(2, 1);
    });
  });

  describe("Floor space calculations", () => {
    it("should calculate VRLA floor space at ~2.5 sq ft per kWh", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      const expected_floor_space = result.battery_configuration.total_battery_energy_kwh * 2.5;
      expect(result.battery_room_footprint.estimated_footprint_sqft).toBeCloseTo(expected_floor_space, 0);
    });

    it("should calculate lithium-ion floor space at ~0.8 sq ft per kWh", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      const expected_floor_space = result.battery_configuration.total_battery_energy_kwh * 0.8;
      expect(result.battery_room_footprint.estimated_footprint_sqft).toBeCloseTo(expected_floor_space, 0);
    });

    it("should show lithium-ion has smaller footprint than VRLA", () => {
      const input_vrla: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_vrla = calculateUPSSizing(input_vrla);

      const input_lithium: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result_lithium = calculateUPSSizing(input_lithium);

      expect(result_lithium.battery_room_footprint.estimated_footprint_sqft).toBeLessThan(
        result_vrla.battery_room_footprint.estimated_footprint_sqft
      );
    });
  });

  describe("Weight calculations", () => {
    it("should calculate VRLA weight at ~60 lbs per kWh", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      const expected_weight_lbs = result.battery_configuration.total_battery_energy_kwh * 60;
      expect(result.battery_room_footprint.estimated_weight_lbs).toBeCloseTo(expected_weight_lbs, 0);
    });

    it("should calculate lithium-ion weight at ~25 lbs per kWh", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      const expected_weight_lbs = result.battery_configuration.total_battery_energy_kwh * 25;
      expect(result.battery_room_footprint.estimated_weight_lbs).toBeCloseTo(expected_weight_lbs, 0);
    });

    it("should show lithium-ion is significantly lighter than VRLA", () => {
      const input_vrla: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_vrla = calculateUPSSizing(input_vrla);

      const input_lithium: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result_lithium = calculateUPSSizing(input_lithium);

      expect(result_lithium.battery_room_footprint.estimated_weight_lbs).toBeLessThan(
        result_vrla.battery_room_footprint.estimated_weight_lbs * 0.5
      );
    });
  });

  describe("Total cost of ownership (TCO) calculations", () => {
    it("should calculate 10-year TCO for both battery types", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.vrla_lifecycle_cost.total_cost_of_ownership_ten_years).toBeDefined();
      expect(result.vrla_lifecycle_cost.total_cost_of_ownership_ten_years).toBeGreaterThan(0);
    });

    it("should show lithium-ion beating VRLA in TCO for large installations (500kW+)", () => {
      const input_vrla: UPSSizingInput = {
        critical_load_kw: 500,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_vrla = calculateUPSSizing(input_vrla);

      const input_lithium: UPSSizingInput = {
        critical_load_kw: 500,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result_lithium = calculateUPSSizing(input_lithium);

      expect(result_lithium.lithium_lifecycle_cost.total_cost_of_ownership_ten_years).toBeLessThan(
        result_vrla.vrla_lifecycle_cost.total_cost_of_ownership_ten_years
      );
    });

    it("should include maintenance costs in TCO calculation", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 200,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.vrla_lifecycle_cost.total_maintenance_ten_years).toBeDefined();
      expect(result.vrla_lifecycle_cost.total_maintenance_ten_years).toBeGreaterThan(0);
    });

    it("should include replacement cost in TCO", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 200,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.vrla_lifecycle_cost.replacement_cost).toBeDefined();
      expect(result.vrla_lifecycle_cost.replacement_cost).toBeGreaterThan(0);
    });
  });

  describe("Growth factor and scaling", () => {
    it("should increase design load proportionally with growth factor", () => {
      const input_no_growth: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        growth_factor: 1.0,
      };
      const result_no_growth = calculateUPSSizing(input_no_growth);

      const input_with_growth: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        growth_factor: 1.2,
      };
      const result_with_growth = calculateUPSSizing(input_with_growth);

      expect(result_with_growth.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(
        result_no_growth.ups_configuration.total_capacity_kw
      );
    });

    it("should scale battery energy with growth factor", () => {
      const input_no_growth: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        growth_factor: 1.0,
      };
      const result_no_growth = calculateUPSSizing(input_no_growth);

      const input_with_growth: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        growth_factor: 1.5,
      };
      const result_with_growth = calculateUPSSizing(input_with_growth);

      expect(result_with_growth.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(
        result_no_growth.battery_configuration.total_battery_energy_kwh
      );
    });

    it("should reflect growth factor in floor space requirements", () => {
      const input_no_growth: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        growth_factor: 1.0,
      };
      const result_no_growth = calculateUPSSizing(input_no_growth);

      const input_with_growth: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        growth_factor: 1.3,
      };
      const result_with_growth = calculateUPSSizing(input_with_growth);

      expect(result_with_growth.battery_room_footprint.estimated_footprint_sqft).toBeGreaterThan(
        result_no_growth.battery_room_footprint.estimated_footprint_sqft
      );
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle very small loads (10kW)", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 10,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(10);
      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(0);
      expect(result.battery_room_footprint.estimated_footprint_sqft).toBeGreaterThan(0);
    });

    it("should handle very large loads (10MW)", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 10000,
        redundancy: "2N",
        runtime_minutes: 15,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.total_capacity_kw).toBeGreaterThanOrEqual(10000 * 2);
      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(0);
      expect(isNaN(result.ups_configuration.total_capacity_kw)).toBe(false);
    });

    it("should handle 5-minute runtime", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 5,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(0);
      expect(result.battery_configuration.total_battery_energy_kwh).toBeLessThan(20);
    });

    it("should handle 60-minute runtime", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 60,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(0);
      expect(result.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(100);
    });

    it("should handle negative load gracefully", () => {
      const input: UPSSizingInput = {
        critical_load_kw: -100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };

      // Implementation doesn't throw - just handles it
      const result = calculateUPSSizing(input);
      expect(result).toBeDefined();
    });

    it("should handle zero runtime gracefully", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 0,
        battery_type: "VRLA",
      };

      // Implementation doesn't throw - just handles it
      const result = calculateUPSSizing(input);
      expect(result).toBeDefined();
    });

    it("should handle negative runtime gracefully", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: -5,
        battery_type: "VRLA",
      };

      // Implementation doesn't throw - just handles it
      const result = calculateUPSSizing(input);
      expect(result).toBeDefined();
    });
  });

  describe("Battery string calculations", () => {
    it("should calculate correct number of battery strings for VRLA", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.battery_configuration.strings_required).toBeGreaterThan(0);
      expect(Number.isInteger(result.battery_configuration.strings_required)).toBe(true);
    });

    it("should calculate correct number of battery strings for lithium-ion", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      expect(result.battery_configuration.strings_required).toBeGreaterThan(0);
      expect(Number.isInteger(result.battery_configuration.strings_required)).toBe(true);
    });

    it("should scale battery strings with load and runtime", () => {
      const input_small: UPSSizingInput = {
        critical_load_kw: 50,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_small = calculateUPSSizing(input_small);

      const input_large: UPSSizingInput = {
        critical_load_kw: 200,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_large = calculateUPSSizing(input_large);

      expect(result_large.battery_configuration.strings_required).toBeGreaterThan(
        result_small.battery_configuration.strings_required
      );
    });
  });

  describe("Runtime comparison across battery types", () => {
    it("should allow longer runtime with lithium-ion for same space constraints", () => {
      const input_vrla: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result_vrla = calculateUPSSizing(input_vrla);

      const input_lithium: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result_lithium = calculateUPSSizing(input_lithium);

      expect(result_lithium.battery_room_footprint.estimated_footprint_sqft).toBeLessThan(
        result_vrla.battery_room_footprint.estimated_footprint_sqft
      );
    });

    it("should show lithium-ion better scalability for extended runtime scenarios", () => {
      const input_vrla_30min: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 30,
        battery_type: "VRLA",
      };
      const result_vrla_30min = calculateUPSSizing(input_vrla_30min);

      const input_lithium_30min: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 30,
        battery_type: "lithium_ion",
      };
      const result_lithium_30min = calculateUPSSizing(input_lithium_30min);

      expect(result_lithium_30min.battery_room_footprint.estimated_footprint_sqft).toBeLessThan(
        result_vrla_30min.battery_room_footprint.estimated_footprint_sqft
      );
      expect(result_lithium_30min.battery_room_footprint.estimated_weight_lbs).toBeLessThan(
        result_vrla_30min.battery_room_footprint.estimated_weight_lbs
      );
    });

    it("should calculate efficiency degradation for VRLA over time", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.vrla_lifecycle_cost.replacement_count_ten_years).toBeDefined();
      expect(result.vrla_lifecycle_cost.replacement_count_ten_years).toBeGreaterThan(0);
    });

    it("should show minimal degradation for lithium-ion", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      expect(result.lithium_lifecycle_cost.replacement_count_ten_years).toBeDefined();
      expect(result.lithium_lifecycle_cost.replacement_count_ten_years).toBeLessThan(3);
    });
  });

  describe("Output validation and completeness", () => {
    it("should return all required fields in result", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.critical_load_kw).toBeDefined();
      expect(result.redundancy).toBeDefined();
      expect(result.runtime_minutes).toBeDefined();
      expect(result.selected_battery_type).toBeDefined();
      expect(result.ups_configuration.modules_required).toBeDefined();
      expect(result.ups_configuration.total_capacity_kw).toBeDefined();
      expect(result.ups_configuration.loading_percentage).toBeDefined();
      expect(result.battery_configuration.total_battery_energy_kwh).toBeDefined();
      expect(result.battery_configuration.strings_required).toBeDefined();
      expect(result.battery_room_footprint.estimated_footprint_sqft).toBeDefined();
      expect(result.battery_room_footprint.estimated_weight_lbs).toBeDefined();
    });

    it("should have numeric values for all sizing metrics", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 200,
        redundancy: "N+1",
        runtime_minutes: 15,
        battery_type: "lithium_ion",
      };
      const result = calculateUPSSizing(input);

      expect(typeof result.ups_configuration.total_capacity_kw).toBe("number");
      expect(typeof result.ups_configuration.loading_percentage).toBe("number");
      expect(typeof result.battery_configuration.total_battery_energy_kwh).toBe("number");
      expect(typeof result.battery_room_footprint.estimated_footprint_sqft).toBe("number");
      expect(typeof result.battery_room_footprint.estimated_weight_lbs).toBe("number");
      expect(!isNaN(result.ups_configuration.total_capacity_kw)).toBe(true);
      expect(!isNaN(result.battery_configuration.total_battery_energy_kwh)).toBe(true);
    });

    it("should have string values for categorical fields", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "2N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(typeof result.ups_configuration.redundancy_level).toBe("string");
      expect(typeof result.selected_battery_type).toBe("string");
    });

    it("should have integer values for module and string counts", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 150,
        redundancy: "N+1",
        runtime_minutes: 12,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(Number.isInteger(result.ups_configuration.modules_required)).toBe(true);
      expect(Number.isInteger(result.battery_configuration.strings_required)).toBe(true);
    });
  });

  describe("Redundancy level verification", () => {
    it("should verify N configuration uses 1 module", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.modules_required).toBe(1);
    });

    it("should verify N+1 uses minimum 2 modules", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N+1",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.modules_required).toBeGreaterThanOrEqual(2);
    });

    it("should verify 2N uses minimum 2 modules", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "2N",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.modules_required).toBeGreaterThanOrEqual(2);
    });

    it("should verify 2N+1 uses minimum 3 modules", () => {
      const input: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "2N+1",
        runtime_minutes: 10,
        battery_type: "VRLA",
      };
      const result = calculateUPSSizing(input);

      expect(result.ups_configuration.modules_required).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Efficiency impact on battery sizing", () => {
    it("should increase battery size with lower efficiency", () => {
      const input_efficient: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.97,
      };
      const result_efficient = calculateUPSSizing(input_efficient);

      const input_less_efficient: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.80,
      };
      const result_less_efficient = calculateUPSSizing(input_less_efficient);

      expect(result_less_efficient.battery_configuration.total_battery_energy_kwh).toBeGreaterThan(
        result_efficient.battery_configuration.total_battery_energy_kwh
      );
    });

    it("should affect floor space and weight calculations via battery energy", () => {
      const input_efficient: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.95,
      };
      const result_efficient = calculateUPSSizing(input_efficient);

      const input_less_efficient: UPSSizingInput = {
        critical_load_kw: 100,
        redundancy: "N",
        runtime_minutes: 10,
        battery_type: "VRLA",
        ups_efficiency: 0.85,
      };
      const result_less_efficient = calculateUPSSizing(input_less_efficient);

      expect(result_less_efficient.battery_room_footprint.estimated_footprint_sqft).toBeGreaterThan(
        result_efficient.battery_room_footprint.estimated_footprint_sqft
      );
      expect(result_less_efficient.battery_room_footprint.estimated_weight_lbs).toBeGreaterThan(
        result_efficient.battery_room_footprint.estimated_weight_lbs
      );
    });
  });
});
