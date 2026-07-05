import { executeTool, listToolNames, TOOL_DEFINITIONS } from "../src/engines.js";

describe("engines facade", () => {
  it("exports eight tool definitions", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(8);
    expect(listToolNames()).toEqual(TOOL_DEFINITIONS.map((tool) => tool.name));
  });

  it("executeTool runs cooling load with canonical schema", () => {
    const result = executeTool("dc_calculate_cooling_load", {
      it_load_kw: 100,
      pue: 1.4,
    }) as { cooling_load_tons: number };

    expect(result.cooling_load_tons).toBeCloseTo(28.43, 1);
  });

  it("executeTool applies UPS rate derating", () => {
    const result = executeTool("dc_ups_battery_sizing", {
      critical_load_kw: 100,
      redundancy: "N+1",
      runtime_minutes: 15,
      battery_type: "VRLA",
    }) as { rate_derating_factor: number; aging_factor: number };

    expect(result.rate_derating_factor).toBe(0.44);
    expect(result.aging_factor).toBe(1.25);
  });

  it("throws on unknown tool", () => {
    expect(() => executeTool("dc_unknown", {})).toThrow("Unknown tool");
  });
});
