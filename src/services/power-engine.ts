// datacenter-mcp-server/src/services/power-engine.ts
// Power redundancy analysis engine for mission-critical facilities

import {
  UPS_EFFICIENCY_DEFAULT,
  PDU_EFFICIENCY_DEFAULT,
  TRANSFORMER_EFFICIENCY_DEFAULT,
  GENERATOR_SIZING_FACTOR,
} from "../constants.js";
import type { PowerRedundancyInput, PowerRedundancyResult } from "../types.js";

export function calculatePowerRedundancy(input: PowerRedundancyInput): PowerRedundancyResult {
  const {
    it_load_kw,
    redundancy_config,
    ups_module_size_kw = 500,
    generator_size_kw = 2000,
    ups_efficiency = UPS_EFFICIENCY_DEFAULT,
    pdu_efficiency = PDU_EFFICIENCY_DEFAULT,
    transformer_efficiency = TRANSFORMER_EFFICIENCY_DEFAULT,
  } = input;

  // Calculate base number of UPS modules needed (N)
  const n_ups = Math.ceil(it_load_kw / ups_module_size_kw);

  let ups_module_count: number;
  let generator_count: number;
  let pdu_count: number;
  let switchgear_feeds: number;
  let concurrent_maintainability: boolean;
  let fault_tolerant: boolean;

  switch (redundancy_config) {
    case "N":
      ups_module_count = n_ups;
      generator_count = Math.ceil((it_load_kw * GENERATOR_SIZING_FACTOR) / generator_size_kw);
      pdu_count = n_ups;
      switchgear_feeds = 1;
      concurrent_maintainability = false;
      fault_tolerant = false;
      break;

    case "N+1":
      ups_module_count = n_ups + 1;
      generator_count = Math.ceil((it_load_kw * GENERATOR_SIZING_FACTOR) / generator_size_kw) + 1;
      pdu_count = n_ups + 1;
      switchgear_feeds = 1;
      concurrent_maintainability = false;
      fault_tolerant = false;
      break;

    case "2N":
      ups_module_count = n_ups * 2;
      generator_count = Math.ceil((it_load_kw * GENERATOR_SIZING_FACTOR) / generator_size_kw) * 2;
      pdu_count = n_ups * 2;
      switchgear_feeds = 2;
      concurrent_maintainability = true;
      fault_tolerant = true;
      break;

    case "2N+1":
      ups_module_count = n_ups * 2 + 1;
      generator_count = Math.ceil((it_load_kw * GENERATOR_SIZING_FACTOR) / generator_size_kw) * 2 + 1;
      pdu_count = n_ups * 2 + 1;
      switchgear_feeds = 2;
      concurrent_maintainability = true;
      fault_tolerant = true;
      break;
  }

  const total_ups_capacity_kw = ups_module_count * ups_module_size_kw;
  const total_generator_capacity_kw = generator_count * generator_size_kw;
  const ups_load_percentage = (it_load_kw / total_ups_capacity_kw) * 100;

  // Electrical efficiency chain
  const chain_efficiency = ups_efficiency * pdu_efficiency * transformer_efficiency;
  const total_electrical_input_kw = it_load_kw / chain_efficiency;
  const total_electrical_loss_kw = total_electrical_input_kw - it_load_kw;
  const electrical_efficiency_pct = chain_efficiency * 100;

  // Recommendations
  const recommendations: string[] = [];

  if (ups_load_percentage > 80) {
    recommendations.push(
      `UPS loading at ${ups_load_percentage.toFixed(1)}% exceeds recommended 80% threshold. Consider larger modules or additional capacity`
    );
  }
  if (ups_load_percentage < 40) {
    recommendations.push(
      `UPS loading at ${ups_load_percentage.toFixed(1)}% is low. Consider smaller modules for better efficiency (UPS efficiency drops below ~40% load)`
    );
  }
  if (redundancy_config === "N") {
    recommendations.push(
      "N configuration provides no redundancy. Any single failure causes downtime. Consider N+1 minimum for production workloads"
    );
  }
  if (redundancy_config === "N+1" && it_load_kw > 1000) {
    recommendations.push(
      "For critical loads above 1 MW, consider 2N configuration for concurrent maintainability"
    );
  }
  if (redundancy_config === "2N" || redundancy_config === "2N+1") {
    recommendations.push(
      "2N configuration supports concurrent maintenance and fault tolerance. Ensure automatic transfer switches (ATS) are tested quarterly"
    );
    recommendations.push(
      "Consider static transfer switches (STS) at rack level for sub-cycle transfer between power paths"
    );
  }
  if (total_electrical_loss_kw > it_load_kw * 0.15) {
    recommendations.push(
      `Electrical losses of ${total_electrical_loss_kw.toFixed(1)} kW (${((total_electrical_loss_kw / it_load_kw) * 100).toFixed(1)}% of IT load) are high. Evaluate high-efficiency UPS and transformers`
    );
  }

  return {
    it_load_kw,
    redundancy_config,
    total_ups_capacity_kw,
    ups_module_count,
    ups_module_size_kw,
    ups_load_percentage: Math.round(ups_load_percentage * 100) / 100,
    generator_count,
    generator_size_kw,
    total_generator_capacity_kw,
    total_electrical_loss_kw: Math.round(total_electrical_loss_kw * 100) / 100,
    electrical_efficiency_pct: Math.round(electrical_efficiency_pct * 100) / 100,
    pdu_count,
    switchgear_feeds,
    concurrent_maintainability,
    fault_tolerant,
    recommendations,
  };
}
