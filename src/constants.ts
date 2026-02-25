// datacenter-mcp-server/src/constants.ts
// Engineering constants for mission-critical data center calculations

// ─── Thermal & Cooling Constants ───────────────────────────────────────
export const BTU_PER_WATT = 3.412;
export const BTU_PER_KW = 3412;
export const TONS_PER_KW = 0.2843; // 1 ton = 3.517 kW
export const KW_PER_TON = 3.517;
export const CFM_PER_TON = 400; // typical airflow per ton of cooling
export const WATTS_PER_SQ_FT_LIGHTING = 1.2;
export const WATTS_PER_SQ_FT_MISC = 0.5;

// ─── Power Constants ───────────────────────────────────────────────────
export const POWER_FACTOR_DEFAULT = 0.9;
export const UPS_EFFICIENCY_DEFAULT = 0.95;
export const PDU_EFFICIENCY_DEFAULT = 0.98;
export const TRANSFORMER_EFFICIENCY_DEFAULT = 0.985;
export const GENERATOR_SIZING_FACTOR = 1.25; // 25% oversizing

// ─── PUE Reference Values ──────────────────────────────────────────────
export const PUE_REFERENCE = {
  excellent: { min: 1.0, max: 1.2, label: "Best-in-class / hyperscale" },
  good: { min: 1.2, max: 1.4, label: "Well-designed colocation" },
  average: { min: 1.4, max: 1.6, label: "Industry average" },
  poor: { min: 1.6, max: 2.0, label: "Older / poorly optimized facility" },
  critical: { min: 2.0, max: 3.0, label: "Significant efficiency issues" },
} as const;

// ─── Tier Classification (per Uptime Institute) ────────────────────────
export const TIER_REQUIREMENTS = {
  1: {
    name: "Tier I — Basic Site Infrastructure",
    uptime: 99.671,
    annual_downtime_hours: 28.8,
    redundancy_power: "N (no redundancy)",
    redundancy_cooling: "N (no redundancy)",
    distribution_paths: 1,
    concurrently_maintainable: false,
    fault_tolerant: false,
    typical_construction_months: "3-6",
    cost_per_kw: "$7,000-$10,000",
  },
  2: {
    name: "Tier II — Redundant Site Infrastructure Components",
    uptime: 99.741,
    annual_downtime_hours: 22.7,
    redundancy_power: "N+1",
    redundancy_cooling: "N+1",
    distribution_paths: 1,
    concurrently_maintainable: false,
    fault_tolerant: false,
    typical_construction_months: "6-10",
    cost_per_kw: "$10,000-$15,000",
  },
  3: {
    name: "Tier III — Concurrently Maintainable",
    uptime: 99.982,
    annual_downtime_hours: 1.6,
    redundancy_power: "N+1 (min)",
    redundancy_cooling: "N+1 (min)",
    distribution_paths: 2,
    concurrently_maintainable: true,
    fault_tolerant: false,
    typical_construction_months: "10-18",
    cost_per_kw: "$15,000-$22,000",
  },
  4: {
    name: "Tier IV — Fault Tolerant",
    uptime: 99.995,
    annual_downtime_hours: 0.4,
    redundancy_power: "2N or 2(N+1)",
    redundancy_cooling: "2N or 2(N+1)",
    distribution_paths: 2,
    concurrently_maintainable: true,
    fault_tolerant: true,
    typical_construction_months: "18-24",
    cost_per_kw: "$22,000-$35,000",
  },
} as const;

// ─── Rack Density Classifications ──────────────────────────────────────
export const RACK_DENSITY = {
  low: { min: 1, max: 5, label: "Low density", cooling: "Standard CRAH/CRAC" },
  medium: { min: 5, max: 10, label: "Medium density", cooling: "Hot/cold aisle containment" },
  high: { min: 10, max: 20, label: "High density", cooling: "In-row cooling + containment" },
  ultra_high: { min: 20, max: 40, label: "Ultra-high density", cooling: "Rear-door heat exchangers / DLC" },
  liquid_cooled: { min: 40, max: 200, label: "Liquid-cooled", cooling: "Direct-to-chip liquid cooling" },
} as const;

// ─── Commissioning Phases (ASHRAE) ─────────────────────────────────────
export const CX_PHASES = [
  { id: "L1", name: "Level 1 — Factory Witness Testing", typical_duration_weeks: 2, description: "Witness testing at manufacturer's facility" },
  { id: "L2", name: "Level 2 — Component Verification", typical_duration_weeks: 4, description: "Verify individual component installation and startup" },
  { id: "L3", name: "Level 3 — System Verification", typical_duration_weeks: 6, description: "System-level functional performance testing" },
  { id: "L4", name: "Level 4 — Integrated Systems Testing", typical_duration_weeks: 8, description: "Multi-system integrated testing under simulated load" },
  { id: "L5", name: "Level 5 — Operational Sustainability", typical_duration_weeks: 52, description: "Ongoing monitoring and seasonal performance verification" },
] as const;

// ─── Server Limits ─────────────────────────────────────────────────────
export const CHARACTER_LIMIT = 50000;
