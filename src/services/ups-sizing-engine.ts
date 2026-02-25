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

function calculateBatteryStringCount(
  design_load_kw: number,
  runtime_minutes: number,
  ups_efficiency: number,
  battery_type: BatteryType
): number {
  // Total energy needed (kWh) = design_load * (runtime_minutes / 60) / ups_efficiency
  const total_energy_needed_kwh =
    (design_load_kw * (runtime_minutes / 60)) / ups_efficiency;

  if (battery_type === "VRLA") {
    const energy_per_string_kwh =
      (BATTERY_SPECS.VRLA.cells_per_string *
        BATTERY_SPECS.VRLA.energy_per_cell_wh) /
      1000;
    return Math.ceil(total_energy_needed_kwh / energy_per_string_kwh);
  } else {
    const energy_per_string_kwh =
      (BATTERY_SPECS.lithium_ion.modules_per_string *
        BATTERY_SPECS.lithium_ion.energy_per_module_wh) /
      1000;
    return Math.ceil(total_energy_needed_kwh / energy_per_string_kwh);
  }
}

function calculateTotalBatteryEnergy(
  design_load_kw: number,
  runtime_minutes: number,
  ups_efficiency: number
): number {
  // Total energy needed (kWh) = design_load * (runtime_minutes / 60) / ups_efficiency
  return (design_load_kw * (runtime_minutes / 60)) / ups_efficiency;
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
  battery_type: BatteryType
): BatteryStringConfiguration {
  const strings_required = calculateBatteryStringCount(
    design_load_kw,
    runtime_minutes,
    ups_efficiency,
    battery_type
  );
  const total_energy_kwh = calculateTotalBatteryEnergy(
    design_load_kw,
    runtime_minutes,
    ups_efficiency
  );

  if (battery_type === "VRLA") {
    const energy_per_string_kwh =
      (BATTERY_SPECS.VRLA.cells_per_string *
        BATTERY_SPECS.VRLA.energy_per_cell_wh) /
      1000;

    return {
      battery_type: "VRLA",
      cells_or_modules_per_string: BATTERY_SPECS.VRLA.cells_per_string,
      nominal_voltage: BATTERY_SPECS.VRLA.nominal_voltage,
      energy_per_unit_wh: BATTERY_SPECS.VRLA.energy_per_cell_wh,
      strings_required,
      total_battery_energy_kwh: Math.round(total_energy_kwh * 100) / 100,
    };
  } else {
    const energy_per_string_kwh =
      (BATTERY_SPECS.lithium_ion.modules_per_string *
        BATTERY_SPECS.lithium_ion.energy_per_module_wh) /
      1000;

    return {
      battery_type: "lithium_ion",
      cells_or_modules_per_string: BATTERY_SPECS.lithium_ion.modules_per_string,
      nominal_voltage: BATTERY_SPECS.lithium_ion.nominal_voltage,
      energy_per_unit_wh: BATTERY_SPECS.lithium_ion.energy_per_module_wh,
      strings_required,
      total_battery_energy_kwh: Math.round(total_energy_kwh * 100) / 100,
    };
  }
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
  } = input;

  // Step 1: Calculate design load with growth factor
  const design_load_kw = critical_load_kw * growth_factor;

  // Step 2: Build UPS module configuration
  const ups_configuration = buildUPSModuleConfiguration(
    design_load_kw,
    redundancy
  );

  // Step 3: Build battery string configuration
  const battery_configuration = buildBatteryStringConfiguration(
    design_load_kw,
    runtime_minutes,
    ups_efficiency,
    battery_type
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

  if (ups_configuration.loading_percentage > 85) {
    warnings.push(
      `UPS loading is ${ups_configuration.loading_percentage.toFixed(1)}%, above recommended 80% max. Consider adding modules or splitting load across multiple UPS systems.`
    );
  }
  if (ups_configuration.loading_percentage < 50) {
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
