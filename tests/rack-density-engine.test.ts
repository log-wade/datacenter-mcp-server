import { analyzeRackDensity } from "../src/services/rack-density-engine.js";
import type { RackDensityInput } from "../src/types.js";

describe("Rack Density Engine", () => {
  describe("Density Classification", () => {
    it("should classify 5 kW/rack as Medium density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 5,
      };
      const result = analyzeRackDensity(input);

      expect(result.density_classification).toContain("Medium");
    });

    it("should classify 15 kW/rack as High density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 15,
      };
      const result = analyzeRackDensity(input);

      expect(result.density_classification).toContain("High");
    });

    it("should classify 25 kW/rack as Ultra-high density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 25,
      };
      const result = analyzeRackDensity(input);

      expect(result.density_classification).toContain("Ultra-high");
    });

    it("should classify 50 kW/rack as Liquid-cooled", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 50,
      };
      const result = analyzeRackDensity(input);

      expect(result.density_classification).toContain("Liquid-cooled");
    });

    it("should classify 3 kW/rack as Low density", () => {
      const input: RackDensityInput = {
        rack_count: 20,
        avg_kw_per_rack: 3,
      };
      const result = analyzeRackDensity(input);

      expect(result.density_classification).toContain("Low");
    });
  });

  describe("Recommended Cooling Type", () => {
    it("should recommend standard CRAH/CRAC for low density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 2,
      };
      const result = analyzeRackDensity(input);

      expect(result.recommended_cooling).toContain("CRAH");
    });

    it("should recommend containment for medium density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 7,
      };
      const result = analyzeRackDensity(input);

      expect(result.recommended_cooling).toContain("containment");
    });

    it("should recommend in-row cooling for high density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 15,
      };
      const result = analyzeRackDensity(input);

      expect(result.recommended_cooling).toContain("In-row");
    });

    it("should recommend rear-door heat exchangers for ultra-high density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 30,
      };
      const result = analyzeRackDensity(input);

      expect(result.recommended_cooling.toLowerCase()).toMatch(/heat exchanger|dlc/);
    });

    it("should recommend direct-to-chip liquid cooling for liquid-cooled", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 60,
      };
      const result = analyzeRackDensity(input);

      expect(result.recommended_cooling).toContain("liquid");
    });
  });

  describe("Containment Requirement", () => {
    it("should not require containment for low density (< 5 kW)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 3,
      };
      const result = analyzeRackDensity(input);

      expect(result.containment_required).toBe(false);
    });

    it("should require containment for medium density (>= 5 kW)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 5,
      };
      const result = analyzeRackDensity(input);

      expect(result.containment_required).toBe(true);
    });

    it("should require containment for high density (>= 10 kW)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 12,
      };
      const result = analyzeRackDensity(input);

      expect(result.containment_required).toBe(true);
    });

    it("should require containment for ultra-high density (>= 20 kW)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 25,
      };
      const result = analyzeRackDensity(input);

      expect(result.containment_required).toBe(true);
    });
  });

  describe("Liquid Cooling Recommendation", () => {
    it("should not recommend liquid cooling for < 30 kW/rack", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 20,
      };
      const result = analyzeRackDensity(input);

      expect(result.liquid_cooling_recommended).toBe(false);
    });

    it("should recommend liquid cooling for >= 30 kW/rack", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 30,
      };
      const result = analyzeRackDensity(input);

      expect(result.liquid_cooling_recommended).toBe(true);
    });

    it("should recommend liquid cooling for high density (40+ kW/rack)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 45,
      };
      const result = analyzeRackDensity(input);

      expect(result.liquid_cooling_recommended).toBe(true);
    });

    it("should recommend liquid cooling for extreme density (60+ kW/rack)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 75,
      };
      const result = analyzeRackDensity(input);

      expect(result.liquid_cooling_recommended).toBe(true);
    });
  });

  describe("Power Calculations", () => {
    it("should calculate total IT load correctly", () => {
      const input: RackDensityInput = {
        rack_count: 50,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      expect(result.total_it_load_kw).toBe(500);
    });

    it("should calculate watts_per_sqft when floor_area provided", () => {
      const input: RackDensityInput = {
        rack_count: 50,
        avg_kw_per_rack: 10,
        floor_area_sqft: 5000,
      };
      const result = analyzeRackDensity(input);

      const expected_watts_per_sqft = (500 * 1000) / 5000;
      expect(result.watts_per_sqft).toBeCloseTo(expected_watts_per_sqft, 1);
    });

    it("should not calculate watts_per_sqft when floor_area not provided", () => {
      const input: RackDensityInput = {
        rack_count: 50,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      expect(result.watts_per_sqft).toBeUndefined();
    });

    it("should calculate high watts_per_sqft correctly", () => {
      const input: RackDensityInput = {
        rack_count: 100,
        avg_kw_per_rack: 30,
        floor_area_sqft: 1000,
      };
      const result = analyzeRackDensity(input);

      const expected_watts_per_sqft = (3000 * 1000) / 1000;
      expect(result.watts_per_sqft).toBeCloseTo(expected_watts_per_sqft, 0);
    });
  });

  describe("Airflow Calculations", () => {
    it("should calculate positive airflow for cooling", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      expect(result.estimated_airflow_per_rack_cfm).toBeGreaterThan(0);
    });

    it("should have airflow proportional to density", () => {
      const input_low: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 5,
      };
      const result_low = analyzeRackDensity(input_low);

      const input_high: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 15,
      };
      const result_high = analyzeRackDensity(input_high);

      expect(result_high.estimated_airflow_per_rack_cfm).toBeGreaterThan(
        result_low.estimated_airflow_per_rack_cfm
      );
    });

    it("should calculate correct airflow based on kW/TON constant", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      const tons_per_rack = 10 / 3.517;
      const expected_cfm = Math.round(tons_per_rack * 400);
      expect(result.estimated_airflow_per_rack_cfm).toBeCloseTo(expected_cfm, 0);
    });
  });

  describe("Recommendations", () => {
    it("should recommend blanking panels for low density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 2,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) => r.includes("blanking panels"));
      expect(rec).toBeDefined();
    });

    it("should recommend containment for medium density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 7,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) =>
        r.includes("Hot aisle") || r.includes("containment")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend in-row cooling for high density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 15,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) => r.includes("In-row cooling"));
      expect(rec).toBeDefined();
    });

    it("should recommend RDHx or DLC for ultra-high density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 25,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) =>
        r.includes("Rear-door") || r.includes("liquid")
      );
      expect(rec).toBeDefined();
    });

    it("should recommend direct-to-chip liquid cooling for extreme density", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 50,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) =>
        r.includes("Direct-to-chip") || r.includes("liquid cooling")
      );
      expect(rec).toBeDefined();
    });

    it("should warn about high floor loading", () => {
      const input: RackDensityInput = {
        rack_count: 100,
        avg_kw_per_rack: 30,
        floor_area_sqft: 1000,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) =>
        r.includes("Floor loading") || r.includes("very high")
      );
      expect(rec).toBeDefined();
    });

    it("should warn about air cooling limitations at high density with air type", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 20,
        cooling_type: "Air",
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) =>
        r.includes("overprovisioning") || r.includes("hybrid")
      );
      expect(rec).toBeDefined();
    });

    it("should include water supply info for liquid-cooled facilities", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 50,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) => r.includes("water supply"));
      expect(rec).toBeDefined();
    });

    it("should include structural loading advice for liquid-cooled", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 60,
      };
      const result = analyzeRackDensity(input);

      const rec = result.recommendations.find((r) =>
        r.includes("structural") || r.includes("weight")
      );
      expect(rec).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle single rack", () => {
      const input: RackDensityInput = {
        rack_count: 1,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      expect(result.total_it_load_kw).toBe(10);
      expect(result.estimated_airflow_per_rack_cfm).toBeGreaterThan(0);
    });

    it("should handle very small load per rack (1 kW)", () => {
      const input: RackDensityInput = {
        rack_count: 100,
        avg_kw_per_rack: 1,
      };
      const result = analyzeRackDensity(input);

      expect(result.total_it_load_kw).toBe(100);
      expect(result.density_classification).toContain("Low");
    });

    it("should handle very large load per rack (100 kW)", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 100,
      };
      const result = analyzeRackDensity(input);

      expect(result.total_it_load_kw).toBe(1000);
      expect(result.density_classification).toContain("Liquid-cooled");
    });

    it("should handle many racks (1000)", () => {
      const input: RackDensityInput = {
        rack_count: 1000,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      expect(result.total_it_load_kw).toBe(10000);
      expect(result.rack_count).toBe(1000);
    });

    it("should handle very small floor area with high density", () => {
      const input: RackDensityInput = {
        rack_count: 50,
        avg_kw_per_rack: 20,
        floor_area_sqft: 500,
      };
      const result = analyzeRackDensity(input);

      expect(result.watts_per_sqft).toBeGreaterThan(200);
    });
  });

  describe("Output Completeness", () => {
    it("should include all required fields in result", () => {
      const input: RackDensityInput = {
        rack_count: 50,
        avg_kw_per_rack: 10,
        floor_area_sqft: 5000,
      };
      const result = analyzeRackDensity(input);

      expect(result.rack_count).toBeDefined();
      expect(result.avg_kw_per_rack).toBeDefined();
      expect(result.total_it_load_kw).toBeDefined();
      expect(result.density_classification).toBeDefined();
      expect(result.recommended_cooling).toBeDefined();
      expect(result.containment_required).toBeDefined();
      expect(result.liquid_cooling_recommended).toBeDefined();
      expect(result.estimated_airflow_per_rack_cfm).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it("should have recommendations array", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 10,
      };
      const result = analyzeRackDensity(input);

      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should have properly typed booleans", () => {
      const input: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 15,
      };
      const result = analyzeRackDensity(input);

      expect(typeof result.containment_required).toBe("boolean");
      expect(typeof result.liquid_cooling_recommended).toBe("boolean");
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle boundary at 5 kW/rack (containment threshold)", () => {
      const input_below: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 4.9,
      };
      const result_below = analyzeRackDensity(input_below);

      const input_at: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 5.0,
      };
      const result_at = analyzeRackDensity(input_at);

      expect(result_below.containment_required).toBe(false);
      expect(result_at.containment_required).toBe(true);
    });

    it("should handle boundary at 30 kW/rack (liquid cooling threshold)", () => {
      const input_below: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 29.9,
      };
      const result_below = analyzeRackDensity(input_below);

      const input_at: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 30.0,
      };
      const result_at = analyzeRackDensity(input_at);

      expect(result_below.liquid_cooling_recommended).toBe(false);
      expect(result_at.liquid_cooling_recommended).toBe(true);
    });

    it("should handle boundary at 40 kW/rack (liquid-cooled classification)", () => {
      const input_below: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 39,
      };
      const result_below = analyzeRackDensity(input_below);

      const input_at: RackDensityInput = {
        rack_count: 10,
        avg_kw_per_rack: 40,
      };
      const result_at = analyzeRackDensity(input_at);

      expect(result_below.density_classification).not.toContain("Liquid-cooled");
      expect(result_at.density_classification).toContain("Liquid-cooled");
    });
  });
});
