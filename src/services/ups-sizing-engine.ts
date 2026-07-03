// datacenter-mcp-server/src/services/ups-sizing-engine.ts
// UPS & Battery Sizing Calculator for mission-critical facilities

import type {
  UPSSizingInput,
  UPSSizingResult,
  UPSModuleConfiguration,
  BatteryStringConfiguration,
  BatteryRoomFootprint,
  LifecycleCost,
  BatteryType,
  RedundancyLevel,
} from "../types.js";

// UPS module standard sizes (kW)
const STANDARD_MODULE_SIZE = 500; // kW

// Battery specifications
const BATTERY_SPECS = {
  VRLA: {
    cells_per_string: 40,
    nominal_voltage: 480,
    energy_per_cell_wh: 500,
    sq_ft_per_kwh: 2.5,
    weight_per_kwh_lbs: 60,
    initial_cost_per_kwh: 150,
    replacement_interval_years: 4.5,
    annual_maintenance_per_kwh: 50,
  },
  lithium_ion: {
    modules_per_string: 15,
    nominal_voltage: 480,
    energy_per_module_wh: 5000,
    sq_ft_per_kwh: 0.8,
    weight_per_kwh_lbs: 25,
    initial_cost_per_kwh: 350,
    replacement_interval_years: 11,
    annual_maintenance_per_kwh: 15,
  },
};

function getUPSModuleCount(
  design_load_kw: number,
  redundancy: RedundancyLevel
): number {
  const base_modules = Math.ceil(design_load_kw / STANDARD_MODULE_SIZE);

  switch (redundancy) {
    case "N":
      return base_modules;
    case "N+1":
      return base_modules + 1;
    case "2N":
      return base_modules * 2;
    case "2N+1":
      return base_modules * 2 + 1;
  }
}

// ─── Rate derating (fixed 2026-07-03, CODE-AUDIT.md CRITICAL-1/2) ─────────
// Batteries deliver far less than nameplate energy at short constant-power
// discharges. Usable fraction of nameplate (20-hr) stored energy vs runtime:
//
// VRLA curve derived from Power-Sonic PHR-12550 (12V/155Ah high-rate UPS bloc)
// published constant-power table @ 1.67 V/cell end voltage — e.g. 15 min:
// 540.1 W/cell × 6 cells × 0.25 h ÷ 1,860 Wh nameplate = 0.44 usable.
// Source: power-sonic.com/product/phr-12550 (retrieved 2026-07-03).
//
// Li-ion curve is a CONSERVATIVE ESTIMATE (usable DoD + high-rate losses) —
// verify against the selected manufacturer's data before removing beta label.
const RATE_DERATING: Record<BatteryType, ReadonlyArray<readonly [number, number]>> = {
  VRLA: [
    [5, 0.23], [10, 0.34], [15, 0.44], [20, 0.49], [30, 0.56],
    [45, 0.62], [60, 0.66], [90, 0.71], [120, 0.75],
  ],
  lithium_ion: [
    [5, 0.80], [10, 0.83], [15, 0.85], [30, 0.87], [60, 0.88], [120, 0.90],
  ],
};

export const DEFAULT_AGING_FACTOR = 1.25; // IEEE 485 practice: size for end-of-life

function getUsableFraction(battery_type: BatteryType, runtime_minutes: number): number {
  const curve = RATE_DERATING[battery_type];
  if (runtime_minutes <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (runtime_minutes <= curve[i][0]) {
      const [t0, f0] = curve[i - 1];
      const [t1, f1] = curve[i];
      return f0 + ((runtime_minutes - t0) / (t1 - t0)) * (f1 - f0);
    }
  }
  return curve[curve.length - 1][1];
}

function getEnergyPerStringKwh(battery_type: BatteryType): number {
  if (battery_type === "VRLA") {
    return (BATTERY_SPECS.VRLA.cells_per_string * BATTERY_SPECS.VRLA.energy_per_cell_wh) / 1000;
  }
  return (BATTERY_SPECS.lithium_ion.modules_per_string * BATTERY_SPECS.lithium_ion.energy_per_module_wh) / 1000;
}

function buildUPSModuleConfiguration(
  design_load_kw: number,
  redundancy: RedundancyLevel
): UPSModuleConfiguration {
  const modules_required = getUPSModuleCount(design_load_kw, redundancy);
  const total_capacity_kw = modules_required * STANDARD_MODULE_SIZE;
  const loading_percentage = (design_load_kw / total_capacity_kw) * 100;

  return {
    redundancy_level: redundancy,
    modules_required,
    module_size_kw: STANDARD_MODULE_SIZE,
    total_capacity_kw,
    loading_percentage: Math.round(loading_percentage * 10) / 10,
  };
}

function buildBatteryStringConfiguration(
  design_load_kw: number,
  runtime_minutes: number,
  ups_efficiency: number,
  battery_type: BatteryType,
  aging_factor: number,
  independent_bus_count: number
): BatteryStringConfiguration {
  // Energy the load draws through the UPS during the runtime window.
  const deliverable_energy_kwh =
    (design_load_kw * (runtime_minutes / 60)) / ups_efficiency;

  // Required NAMEPLATE energy per bus: rate derating + end-of-life aging.
  const rate_derating_factor = getUsableFraction(battery_type, runtime_minutes);
  const nameplate_per_bus_kwh =
    (deliverable_energy_kwh / rate_derating_factor) * aging_factor;

  const energy_per_string_kwh = getEnergyPerStringKwh(battery_type);
  const strings_per_bus = Math.ceil(nameplate_per_bus_kwh / energy_per_string_kwh);

  // Fixed 2026-07-03 (CODE-AUDIT.md MAJOR-1): dual-bus topologies (2N/2N+1)
  // require a full battery plant per bus.
  const total_nameplate_kwh = nameplate_per_bus_kwh * independent_bus_count;

  const specs = BATTERY_SPECS[battery_type];
  return {
    battery_type,
    cells_or_modules_per_string:
      battery_type === "VRLA"
        ? BATTERY_SPECS.VRLA.cells_per_string
        : BATTERY_SPECS.lithium_ion.modules_per_string,
    nominal_voltage: specs.nominal_voltage,
    energy_per_unit_wh:
      battery_type === "VRLA"
        ? BATTERY_SPECS.VRLA.energy_per_cell_wh
        : BATTERY_SPECS.lithium_ion.energy_per_module_wh,
    strings_required: strings_per_bus * independent_bus_count,
    total_battery_energy_kwh: Math.round(total_nameplate_kwh * 100) / 100,
    deliverable_energy_kwh: Math.round(deliverable_energy_kwh * 100) / 100,
    rate_derating_factor: Math.round(rate_derating_factor * 1000) / 1000,
    aging_factor,
    independent_bus_count,
    strings_per_bus,
  };
}

function buildBatteryRoomFootprint(
  total_energy_kwh: number,
  battery_type: BatteryType
): BatteryRoomFootprint {
  const specs = BATTERY_SPECS[battery_type];
  const estimated_footprint_sqft =
    total_energy_kwh * specs.sq_ft_per_kwh;
  const estimated_weight_lbs = total_energy_kwh * specs.weight_per_kwh_lbs;

  return {
    battery_type,
    total_energy_kwh: Math.round(total_energy_kwh * 100) / 100,
    sq_ft_per_kwh: specs.sq_ft_per_kwh,
    estimated_footprint_sqft: Math.round(estimated_footprint_sqft * 10) / 10,
    weight_per_kwh_lbs: specs.weight_per_kwh_lbs,
    estimated_weight_lbs: Math.round(estimated_weight_lbs),
  };
}

function buildLifecycleCost(
  total_energy_kwh: number,
  battery_type: BatteryType
): LifecycleCost {
  const specs = BATTERY_SPECS[battery_type];
  const initial_cost = total_energy_kwh * specs.initial_cost_per_kwh;

  let replacement_count = 0;
  const replacement_cycles: number[] = [];

  // Over 10 years
  for (
    let year = specs.replacement_interval_years;
    year < 10;
    year += specs.replacement_interval_years
  ) {
    replacement_count++;
    replacement_cycles.push(year);
  }

  const replacement_cost = replacement_count * initial_cost;
  const annual_maintenance = total_energy_kwh * specs.annual_maintenance_per_kwh;
  const total_maintenance_ten_years = annual_maintenance * 10;

  const total_cost_of_ownership =
    initial_cost + replacement_cost + total_maintenance_ten_years;

  return {
    battery_type,
    initial_cost_per_kwh: specs.initial_cost_per_kwh,
    total_initial_cost: Math.round(initial_cost),
    replacement_count_ten_years: replacement_count,
    replacement_cycles,
    replacement_cost: Math.round(replacement_cost),
    annual_maintenance_per_kwh: specs.annual_maintenance_per_kwh,
    total_maintenance_ten_years: Math.round(total_maintenance_ten_years),
    total_cost_of_ownership_ten_years: Math.round(total_cost_of_ownership),
  };
}

export function calculateUPSSizing(input: UPSSizingInput): UPSSizingResult {
  const {
    critical_load_kw,
    redundancy,
    runtime_minutes,
    battery_type,
    ups_efficiency = 0.96,
    growth_factor = 1.2,
    aging_factor = DEFAULT_AGING_FACTOR,
  } = input;

  // Step 1: Calculate design load with growth factor
  const design_load_kw = critical_load_kw * growth_factor;

  // Step 2: Build UPS module configuration
  const ups_configuration = buildUPSModuleConfiguration(
    design_load_kw,
    redundancy
  );

  // Step 3: Build battery string configuration (rate-derated, aged, per bus)
  const independent_bus_count =
    redundancy === "2N" || redundancy === "2N+1" ? 2 : 1;
  const battery_configuration = buildBatteryStringConfiguration(
    design_load_kw,
    runtime_minutes,
    ups_efficiency,
    battery_type,
    aging_factor,
    independent_bus_count
  );

  // Step 4: Build battery room footprint
  const battery_room_footprint = buildBatteryRoomFootprint(
    battery_configuration.total_battery_energy_kwh,
    battery_type
  );

  // Step 5: Calculate lifecycle costs for both battery types
  const vrla_lifecycle_cost = buildLifecycleCost(
    battery_configuration.total_battery_energy_kwh,
    "VRLA"
  );
  const lithium_lifecycle_cost = buildLifecycleCost(
    battery_configuration.total_battery_energy_kwh,
    "lithium_ion"
  );

  // Step 6: Build cost comparison analysis
  const vrla_cost_per_kwh_ten_years =
    vrla_lifecycle_cost.total_cost_of_ownership_ten_years /
    battery_configuration.total_battery_energy_kwh;
  const lithium_cost_per_kwh_ten_years =
    lithium_lifecycle_cost.total_cost_of_ownership_ten_years /
    battery_configuration.total_battery_energy_kwh;
  const lithium_savings_ten_years =
    vrla_lifecycle_cost.total_cost_of_ownership_ten_years -
    lithium_lifecycle_cost.total_cost_of_ownership_ten_years;
  const lithium_payback_years =
    (lithium_lifecycle_cost.total_initial_cost -
      vrla_lifecycle_cost.total_initial_cost) /
    ((vrla_lifecycle_cost.total_initial_cost +
      vrla_lifecycle_cost.total_maintenance_ten_years) /
      10 -
      (lithium_lifecycle_cost.total_initial_cost +
        lithium_lifecycle_cost.total_maintenance_ten_years) /
        10);

  // Step 7: Generate recommendations
  const recommendations: string[] = [];
  const warnings: string[] = [];

  recommendations.push(
    `Sizing methodology: constant-power rate derating applied — ${((battery_configuration.rate_derating_factor ?? 1) * 100).toFixed(0)}% of nameplate energy usable at ${runtime_minutes}-min rate (VRLA curve from Power-Sonic PHR-12550 published discharge data; Li-ion curve is a conservative estimate) × ${aging_factor} end-of-life aging factor (IEEE 485 practice) × ${independent_bus_count} independent battery bus(es). Verify final sizing against the selected manufacturer's discharge tables — this is a planning estimate, not a construction document.`
  );

  // Fixed 2026-07-03 (CODE-AUDIT.md MAJOR-2): threshold aligned with message (80%),
  // and low-loading "right-size" advice suppressed for dual-bus topologies —
  // a 2N system at ~50% loading is correct by design, not oversized.
  const dual_bus = redundancy === "2N" || redundancy === "2N+1";
  if (ups_configuration.loading_percentage > 80) {
    warnings.push(
      `UPS loading is ${ups_configuration.loading_percentage.toFixed(1)}%, above recommended 80% max. Consider adding modules or splitting load across multiple UPS systems.`
    );
  }
  if (ups_configuration.loading_percentage < 50 && !dual_bus) {
    recommendations.push(
      `UPS loading is only ${ups_configuration.loading_percentage.toFixed(1)}%. Growth margin is healthy but consider right-sizing to improve efficiency and reduce capital cost.`
    );
  }

  if (redundancy === "2N" || redundancy === "2N+1") {
    recommendations.push(
      "Dual-bus topology selected. Implement static transfer switches (STS) for seamless redundancy switching. Ensure independent maintenance feeds for fault tolerance."
    );
  }

  if (battery_type === "VRLA") {
    recommendations.push(
      `VRLA batteries selected. Plan for replacement at ${BATTERY_SPECS.VRLA.replacement_interval_years}-year intervals. Battery room footprint: ${battery_room_footprint.estimated_footprint_sqft.toFixed(1)} sq ft.`
    );
    if (battery_room_footprint.estimated_weight_lbs > 10000) {
      warnings.push(
        `Total VRLA battery weight: ${(battery_room_footprint.estimated_weight_lbs / 1000).toFixed(1)} tons. Verify floor structural capacity and plan rack loading accordingly.`
      );
    }
  } else {
    recommendations.push(
      `Lithium-ion batteries selected. Estimated 10-year cost savings vs VRLA: $${lithium_savings_ten_years.toLocaleString("en-US", { maximumFractionDigits: 0 })}. Payback period: ${Math.round(lithium_payback_years)} years.`
    );
    recommendations.push(
      `Lithium battery room footprint: ${battery_room_footprint.estimated_footprint_sqft.toFixed(1)} sq ft (${((battery_room_footprint.estimated_footprint_sqft / (BATTERY_SPECS.VRLA.sq_ft_per_kwh * battery_configuration.total_battery_energy_kwh)) * 100).toFixed(0)}% reduction vs VRLA). No scheduled replacements required during 10-year lifecycle.`
    );
  }

  if (runtime_minutes < 10) {
    recommendations.push(
      "Runtime is less than 10 minutes. Ensure generator auto-start circuit and fuel supply are sized for extended outage duration. Consider automatic load shedding."
    );
  }
  if (runtime_minutes >= 30) {
    recommendations.push(
      `Extended runtime (${runtime_minutes} min) selected. Verify fuel tank capacity and supply contract for sustained operation. Implement battery temperature monitoring and cooling for extended cycles.`
    );
  }

  if (design_load_kw > 5000) {
    recommendations.push(
      "Large-scale UPS deployment (>5 MW). Implement distributed battery banks across facility zones. Use modular architecture with independent DC feeders for scalability and fault isolation."
    );
  }

  return {
    critical_load_kw,
    design_load_kw: Math.round(design_load_kw * 100) / 100,
    growth_factor,
    redundancy,
    runtime_minutes,
    ups_efficiency,
    ups_configuration,
    battery_configuration,
    battery_room_footprint,
    vrla_lifecycle_cost,
    lithium_lifecycle_cost,
    selected_battery_type: battery_type,
    cost_comparison_analysis: {
      vrla_cost_per_kwh_ten_years: Math.round(
        vrla_cost_per_kwh_ten_years * 100
      ) / 100,
      lithium_cost_per_kwh_ten_years: Math.round(
        lithium_cost_per_kwh_ten_years * 100
      ) / 100,
      lithium_savings_ten_years: Math.round(lithium_savings_ten_years),
      lithium_payback_period_years: Math.round(
        Math.max(0, lithium_payback_years) * 10
      ) / 10,
    },
    recommendations,
    warnings,
  };
}
