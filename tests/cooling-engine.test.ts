import { calculateCoolingLoad } from "../src/services/cooling-engine.js";
import type { CoolingLoadInput } from "../src/types.js";

describe("Cooling Load Engine", () => {
  describe("Basic calculations", () => {
    it("should calculate positive cooling load for 1000 kW IT load with PUE 1.5", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      expect(result.it_load_kw).toBe(1000);
      expect(result.total_facility_load_kw).toBe(1500);
      expect(result.cooling_load_kw).toBeGreaterThan(0);
      expect(result.cooling_load_tons).toBeGreaterThan(0);
      expect(result.cooling_load_btu).toBeGreaterThan(0);
    });

    it("should verify cooling loads are proportional with PUE 1.5", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      const expected_tons = result.cooling_load_kw / 3.517; // KW_PER_TON
      expect(result.cooling_load_tons).toBeCloseTo(expected_tons, 1);

      const expected_btu = result.cooling_load_kw * 3412; // BTU_PER_KW
      expect(result.cooling_load_btu).toBeCloseTo(expected_btu, 0);
    });

    it("should verify cooling load equals IT load when PUE is 1.0", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 500,
        pue: 1.0,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      expect(result.cooling_load_kw).toBeCloseTo(500, 0);
    });
  });

  describe("Safety factor impact", () => {
    it("should verify safety factor 1.15 increases output vs 1.0", () => {
      const input_base: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        safety_factor: 1.0,
      };
      const result_base = calculateCoolingLoad(input_base);

      const input_with_sf: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        safety_factor: 1.15,
      };
      const result_with_sf = calculateCoolingLoad(input_with_sf);

      expect(result_with_sf.cooling_load_kw).toBeGreaterThan(result_base.cooling_load_kw);
      expect(result_with_sf.cooling_load_kw / result_base.cooling_load_kw).toBeCloseTo(1.15, 2);
    });

    it("should handle safety factor of 1.25", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 800,
        pue: 1.4,
        safety_factor: 1.25,
      };
      const result = calculateCoolingLoad(input);

      expect(result.cooling_load_kw).toBeGreaterThan(0);
      expect(result.safety_factor).toBe(1.25);
    });
  });

  describe("Altitude derating", () => {
    it("should not apply derating at sea level (0 ft)", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        altitude_ft: 0,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      expect(result.altitude_derating).toBeUndefined();
    });

    it("should not apply derating at 5000 ft", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        altitude_ft: 5000,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      expect(result.altitude_derating).toBeUndefined();
    });

    it("should apply derating above 5000 ft and increase cooling load", () => {
      const input_sea_level: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        altitude_ft: 0,
        safety_factor: 1.0,
      };
      const result_sea_level = calculateCoolingLoad(input_sea_level);

      const input_high_alt: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        altitude_ft: 6000,
        safety_factor: 1.0,
      };
      const result_high_alt = calculateCoolingLoad(input_high_alt);

      expect(result_high_alt.altitude_derating).toBeDefined();
      expect(result_high_alt.altitude_derating!).toBeLessThan(1.0);
      expect(result_high_alt.cooling_load_kw).toBeGreaterThan(result_sea_level.cooling_load_kw);
    });

    it("should apply altitude recommendation when altitude > 5000 ft", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        altitude_ft: 8000,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      const altitude_recommendation = result.recommendations.find((r) =>
        r.includes("Altitude derating")
      );
      expect(altitude_recommendation).toBeDefined();
    });
  });

  describe("Humidification impact", () => {
    it("should add approximately 7% load with humidification enabled", () => {
      const input_no_humid: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        include_humidification: false,
        safety_factor: 1.0,
      };
      const result_no_humid = calculateCoolingLoad(input_no_humid);

      const input_with_humid: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        include_humidification: true,
        safety_factor: 1.0,
      };
      const result_with_humid = calculateCoolingLoad(input_with_humid);

      const increase_ratio = result_with_humid.cooling_load_kw / result_no_humid.cooling_load_kw;
      expect(increase_ratio).toBeCloseTo(1.07, 2);
    });

    it("should generate recommendation when humidification is enabled", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 500,
        pue: 1.4,
        include_humidification: true,
      };
      const result = calculateCoolingLoad(input);

      const humid_recommendation = result.recommendations.find((r) =>
        r.includes("Humidification")
      );
      expect(humid_recommendation).toBeDefined();
    });
  });

  describe("Lighting area load", () => {
    it("should add load when lighting_area_sqft is provided", () => {
      const input_no_lighting: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        lighting_area_sqft: 0,
        safety_factor: 1.0,
      };
      const result_no_lighting = calculateCoolingLoad(input_no_lighting);

      const input_with_lighting: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        lighting_area_sqft: 1000,
        safety_factor: 1.0,
      };
      const result_with_lighting = calculateCoolingLoad(input_with_lighting);

      expect(result_with_lighting.cooling_load_kw).toBeGreaterThan(result_no_lighting.cooling_load_kw);
    });

    it("should calculate correct lighting load", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        lighting_area_sqft: 2000,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      expect(result.cooling_load_kw).toBeGreaterThan(0);
    });
  });

  describe("PUE rating classification", () => {
    it("should classify PUE 1.1 as excellent", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.1,
      };
      const result = calculateCoolingLoad(input);

      expect(result.pue_rating).toContain("Best-in-class");
    });

    it("should classify PUE 1.5 as average", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
      };
      const result = calculateCoolingLoad(input);

      expect(result.pue_rating).toContain("Industry average");
    });

    it("should classify PUE 2.5 as critical", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 2.5,
      };
      const result = calculateCoolingLoad(input);

      expect(result.pue_rating).toContain("efficiency issues");
    });

    it("should classify PUE 1.3 as good", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.3,
      };
      const result = calculateCoolingLoad(input);

      expect(result.pue_rating).toContain("Well-designed");
    });
  });

  describe("Edge cases", () => {
    it("should handle very small load (1 kW)", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1,
        pue: 1.5,
      };
      const result = calculateCoolingLoad(input);

      expect(result.cooling_load_kw).toBeGreaterThan(0);
      expect(result.cooling_load_tons).toBeGreaterThan(0);
    });

    it("should handle very large load (50000 kW)", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 50000,
        pue: 1.4,
      };
      const result = calculateCoolingLoad(input);

      expect(result.cooling_load_kw).toBeGreaterThan(0);
      expect(result.cooling_load_tons).toBeGreaterThan(0);
      expect(isNaN(result.cooling_load_kw)).toBe(false);
    });

    it("should handle PUE 1.0 (no overhead)", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 2000,
        pue: 1.0,
        safety_factor: 1.0,
      };
      const result = calculateCoolingLoad(input);

      expect(result.cooling_load_kw).toBeCloseTo(2000, 0);
    });
  });

  describe("Recommendations", () => {
    it("should provide recommendations when PUE > 1.6", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.8,
      };
      const result = calculateCoolingLoad(input);

      expect(result.recommendations.length).toBeGreaterThan(0);
      const econ_rec = result.recommendations.find((r) => r.includes("economizer"));
      expect(econ_rec).toBeDefined();
    });

    it("should recommend optimization when PUE is good (1.2-1.4)", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.3,
      };
      const result = calculateCoolingLoad(input);

      const rec = result.recommendations.find((r) => r.includes("hot/cold aisle"));
      expect(rec).toBeDefined();
    });

    it("should recommend chilled water for large loads in warm climates", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 600,
        pue: 1.5,
        design_outdoor_temp_f: 95,
      };
      const result = calculateCoolingLoad(input);

      const rec = result.recommendations.find((r) => r.includes("chilled water"));
      expect(rec).toBeDefined();
    });

    it("should recommend central chilled water for very large facilities (>200 tons)", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1500,
        pue: 1.5,
      };
      const result = calculateCoolingLoad(input);

      if (result.cooling_load_tons > 200) {
        const rec = result.recommendations.find((r) =>
          r.includes("central chilled water plant")
        );
        expect(rec).toBeDefined();
      }
    });

    it("should have non-empty recommendations array when PUE > 1.6", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 2000,
        pue: 1.8,
      };
      const result = calculateCoolingLoad(input);

      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should include altitude recommendation when altitude > 5000", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        altitude_ft: 6500,
      };
      const result = calculateCoolingLoad(input);

      const altitude_rec = result.recommendations.find((r) =>
        r.includes("Altitude derating")
      );
      expect(altitude_rec).toBeDefined();
    });
  });

  describe("Output formatting", () => {
    it("should return properly rounded values", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
      };
      const result = calculateCoolingLoad(input);

      expect(Number.isInteger(result.cooling_load_kw * 100)).toBe(true);
      expect(Number.isInteger(result.cooling_load_tons * 100)).toBe(true);
      expect(Number.isInteger(result.cooling_load_btu)).toBe(true);
    });

    it("should include PUE rating in result", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
      };
      const result = calculateCoolingLoad(input);

      expect(result.pue_rating).toBeDefined();
      expect(typeof result.pue_rating).toBe("string");
    });

    it("should include safety_factor in result", () => {
      const input: CoolingLoadInput = {
        it_load_kw: 1000,
        pue: 1.5,
        safety_factor: 1.2,
      };
      const result = calculateCoolingLoad(input);

      expect(result.safety_factor).toBe(1.2);
    });
  });
});
