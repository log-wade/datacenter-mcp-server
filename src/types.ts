// datacenter-mcp-server/src/types.ts
// Type definitions for data center engineering calculations

export interface CoolingLoadInput {
  it_load_kw: number;
  pue: number;
  safety_factor?: number;
  lighting_area_sqft?: number;
  include_humidification?: boolean;
  altitude_ft?: number;
  design_outdoor_temp_f?: number;
}

export interface CoolingLoadResult {
  it_load_kw: number;
  total_facility_load_kw: number;
  cooling_load_kw: number;
  cooling_load_tons: number;
  cooling_load_btu: number;
  estimated_airflow_cfm: number;
  pue: number;
  pue_rating: string;
  safety_factor: number;
  altitude_derating?: number;
  recommendations: string[];
}

export interface PowerRedundancyInput {
  it_load_kw: number;
  redundancy_config: "N" | "N+1" | "2N" | "2N+1";
  ups_module_size_kw?: number;
  generator_size_kw?: number;
  ups_efficiency?: number;
  pdu_efficiency?: number;
  transformer_efficiency?: number;
}

export interface PowerRedundancyResult {
  it_load_kw: number;
  redundancy_config: string;
  total_ups_capacity_kw: number;
  ups_module_count: number;
  ups_module_size_kw: number;
  ups_load_percentage: number;
  generator_count: number;
  generator_size_kw: number;
  total_generator_capacity_kw: number;
  total_electrical_loss_kw: number;
  electrical_efficiency_pct: number;
  pdu_count: number;
  switchgear_feeds: number;
  concurrent_maintainability: boolean;
  fault_tolerant: boolean;
  recommendations: string[];
}

export interface TierAssessmentInput {
  target_tier: 1 | 2 | 3 | 4;
  power_redundancy: "N" | "N+1" | "2N" | "2N+1";
  cooling_redundancy: "N" | "N+1" | "2N" | "2N+1";
  distribution_paths: number;
  concurrently_maintainable: boolean;
  fault_tolerant: boolean;
  generator_backed: boolean;
  ups_runtime_minutes?: number;
  fire_suppression?: boolean;
  monitoring_system?: boolean;
}

export interface TierAssessmentResult {
  target_tier: number;
  target_tier_name: string;
  achieved_tier: number;
  achieved_tier_name: string;
  meets_target: boolean;
  expected_uptime: number;
  expected_annual_downtime_hours: number;
  gaps: TierGap[];
  estimated_cost_per_kw: string;
  recommendations: string[];
}

export interface TierGap {
  requirement: string;
  target_value: string;
  current_value: string;
  severity: "critical" | "major" | "minor";
}

export interface CommissioningPlanInput {
  facility_size_kw: number;
  tier_level: 1 | 2 | 3 | 4;
  include_levels: number[];
  num_systems?: number;
  custom_systems?: string[];
}

export interface CommissioningPlanResult {
  facility_size_kw: number;
  tier_level: number;
  phases: CommissioningPhase[];
  total_duration_weeks: number;
  total_test_procedures: number;
  critical_milestones: Milestone[];
  recommendations: string[];
}

export interface CommissioningPhase {
  id: string;
  name: string;
  duration_weeks: number;
  description: string;
  test_procedures: TestProcedure[];
}

export interface TestProcedure {
  id: string;
  name: string;
  system: string;
  estimated_hours: number;
  prerequisites: string[];
}

export interface Milestone {
  name: string;
  phase: string;
  description: string;
}

export interface RackDensityInput {
  rack_count: number;
  avg_kw_per_rack: number;
  floor_area_sqft?: number;
  cooling_type?: string;
}

export interface RackDensityResult {
  rack_count: number;
  avg_kw_per_rack: number;
  total_it_load_kw: number;
  density_classification: string;
  recommended_cooling: string;
  watts_per_sqft?: number;
  estimated_airflow_per_rack_cfm: number;
  containment_required: boolean;
  liquid_cooling_recommended: boolean;
  recommendations: string[];
}

// ──────── GPU Cooling Engine Types ────────────────────────────────────────

export type GPUModel = "H100" | "A100" | "H200" | "B200" | "GB200";
export type CoolingType = "air" | "direct_liquid" | "rear_door" | "immersion";

export interface GPUCoolingInput {
  gpu_count: number;
  gpu_model: GPUModel;
  rack_count: number;
  cooling_type: CoolingType;
  ambient_temp_f: number;
  pue_target: number;
  electricity_cost_per_kwh?: number;
}

export interface CoolingStrategyRecommendation {
  kw_per_rack: number;
  recommended_type: CoolingType;
  description: string;
  min_threshold: number;
  max_threshold: number;
}

export interface GPUCoolingResult {
  gpu_count: number;
  gpu_model: GPUModel;
  gpu_tdp_watts: number;
  total_gpu_load_kw: number;
  total_it_load_with_overhead_kw: number;
  rack_count: number;
  heat_rejection_per_rack_kw: number;
  cooling_type_selected: CoolingType;
  cooling_strategy_analysis: CoolingStrategyRecommendation[];
  coolant_flow_rate_gpm?: number;
  cdu_count_required?: number;
  chilled_water_capacity_tons?: number;
  facility_pue_liquid_cooling: number;
  facility_pue_air_cooling: number;
  annual_facility_energy_cost_liquid_kw: number;
  annual_facility_energy_cost_air_kw: number;
  estimated_annual_savings_liquid_vs_air: number;
  recommendations: string[];
  warnings: string[];
}

// ──────── UPS Sizing Engine Types ──────────────────────────────────────────

export type BatteryType = "VRLA" | "lithium_ion";
export type RedundancyLevel = "N" | "N+1" | "2N" | "2N+1";

export interface UPSSizingInput {
  critical_load_kw: number;
  redundancy: RedundancyLevel;
  runtime_minutes: number;
  battery_type: BatteryType;
  ups_efficiency?: number;
  growth_factor?: number;
}

export interface UPSModuleConfiguration {
  redundancy_level: RedundancyLevel;
  modules_required: number;
  module_size_kw: number;
  total_capacity_kw: number;
  loading_percentage: number;
}

export interface BatteryStringConfiguration {
  battery_type: BatteryType;
  cells_or_modules_per_string: number;
  nominal_voltage: number;
  energy_per_unit_wh: number;
  strings_required: number;
  total_battery_energy_kwh: number;
}

export interface BatteryRoomFootprint {
  battery_type: BatteryType;
  total_energy_kwh: number;
  sq_ft_per_kwh: number;
  estimated_footprint_sqft: number;
  weight_per_kwh_lbs: number;
  estimated_weight_lbs: number;
}

export interface LifecycleCost {
  battery_type: BatteryType;
  initial_cost_per_kwh: number;
  total_initial_cost: number;
  replacement_count_ten_years: number;
  replacement_cycles: number[];
  replacement_cost: number;
  annual_maintenance_per_kwh: number;
  total_maintenance_ten_years: number;
  total_cost_of_ownership_ten_years: number;
}

export interface UPSSizingResult {
  critical_load_kw: number;
  design_load_kw: number;
  growth_factor: number;
  redundancy: RedundancyLevel;
  runtime_minutes: number;
  ups_efficiency: number;
  ups_configuration: UPSModuleConfiguration;
  battery_configuration: BatteryStringConfiguration;
  battery_room_footprint: BatteryRoomFootprint;
  vrla_lifecycle_cost: LifecycleCost;
  lithium_lifecycle_cost: LifecycleCost;
  selected_battery_type: BatteryType;
  cost_comparison_analysis: {
    vrla_cost_per_kwh_ten_years: number;
    lithium_cost_per_kwh_ten_years: number;
    lithium_savings_ten_years: number;
    lithium_payback_period_years: number;
  };
  recommendations: string[];
  warnings: string[];
}
