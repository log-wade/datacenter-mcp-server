// datacenter-mcp-server/src/services/tier-engine.ts
// Uptime Institute Tier Classification assessment engine

import { TIER_REQUIREMENTS } from "../constants.js";
import type { TierAssessmentInput, TierAssessmentResult, TierGap } from "../types.js";

type TierKey = 1 | 2 | 3 | 4;

function getRedundancyLevel(config: string): number {
  switch (config) {
    case "N": return 0;
    case "N+1": return 1;
    case "2N": return 2;
    case "2N+1": return 3;
    default: return 0;
  }
}

function getMinRedundancyForTier(tier: TierKey): number {
  switch (tier) {
    case 1: return 0; // N
    case 2: return 1; // N+1
    case 3: return 1; // N+1 minimum
    case 4: return 2; // 2N minimum
  }
}

export function assessTierClassification(input: TierAssessmentInput): TierAssessmentResult {
  const {
    target_tier,
    power_redundancy,
    cooling_redundancy,
    distribution_paths,
    concurrently_maintainable,
    fault_tolerant,
    generator_backed,
    ups_runtime_minutes = 10,
    fire_suppression = false,
    monitoring_system = false,
  } = input;

  const target = TIER_REQUIREMENTS[target_tier];
  const gaps: TierGap[] = [];
  let achieved_tier: TierKey = 1;

  // Assess power redundancy
  const power_level = getRedundancyLevel(power_redundancy);
  const required_power_level = getMinRedundancyForTier(target_tier);

  if (power_level < required_power_level) {
    gaps.push({
      requirement: "Power redundancy",
      target_value: target.redundancy_power,
      current_value: power_redundancy,
      severity: "critical",
    });
  }

  // Assess cooling redundancy
  const cooling_level = getRedundancyLevel(cooling_redundancy);
  const required_cooling_level = getMinRedundancyForTier(target_tier);

  if (cooling_level < required_cooling_level) {
    gaps.push({
      requirement: "Cooling redundancy",
      target_value: target.redundancy_cooling,
      current_value: cooling_redundancy,
      severity: "critical",
    });
  }

  // Assess distribution paths
  if (distribution_paths < target.distribution_paths) {
    gaps.push({
      requirement: "Distribution paths",
      target_value: String(target.distribution_paths),
      current_value: String(distribution_paths),
      severity: "critical",
    });
  }

  // Concurrent maintainability (Tier III+)
  if (target_tier >= 3 && !concurrently_maintainable) {
    gaps.push({
      requirement: "Concurrent maintainability",
      target_value: "Required",
      current_value: "Not available",
      severity: "critical",
    });
  }

  // Fault tolerance (Tier IV)
  if (target_tier === 4 && !fault_tolerant) {
    gaps.push({
      requirement: "Fault tolerance",
      target_value: "Required",
      current_value: "Not available",
      severity: "critical",
    });
  }

  // Generator requirement (Tier II+)
  if (target_tier >= 2 && !generator_backed) {
    gaps.push({
      requirement: "Generator backup",
      target_value: "Required",
      current_value: "Not available",
      severity: "critical",
    });
  }

  // UPS runtime
  if (target_tier >= 3 && ups_runtime_minutes < 10) {
    gaps.push({
      requirement: "UPS runtime",
      target_value: "≥10 minutes",
      current_value: `${ups_runtime_minutes} minutes`,
      severity: "major",
    });
  }

  // Fire suppression (recommended for all tiers, required for III+)
  if (target_tier >= 3 && !fire_suppression) {
    gaps.push({
      requirement: "Fire suppression system",
      target_value: "Required for Tier III+",
      current_value: "Not installed",
      severity: "major",
    });
  }

  // Monitoring system
  if (target_tier >= 2 && !monitoring_system) {
    gaps.push({
      requirement: "BMS/DCIM monitoring",
      target_value: "Required for Tier II+",
      current_value: "Not installed",
      severity: "minor",
    });
  }

  // Determine achieved tier based on what's actually met
  const critical_gaps = gaps.filter((g) => g.severity === "critical");

  if (critical_gaps.length === 0) {
    achieved_tier = target_tier;
  } else {
    // Work backwards from target to find achieved tier
    for (let t = target_tier; t >= 1; t--) {
      const tier_key = t as TierKey;
      const tier_req = TIER_REQUIREMENTS[tier_key];
      const meets_power = power_level >= getMinRedundancyForTier(tier_key);
      const meets_cooling = cooling_level >= getMinRedundancyForTier(tier_key);
      const meets_paths = distribution_paths >= tier_req.distribution_paths;
      const meets_cm = tier_key < 3 || concurrently_maintainable;
      const meets_ft = tier_key < 4 || fault_tolerant;
      const meets_gen = tier_key < 2 || generator_backed;

      if (meets_power && meets_cooling && meets_paths && meets_cm && meets_ft && meets_gen) {
        achieved_tier = tier_key;
        break;
      }
    }
  }

  const achieved = TIER_REQUIREMENTS[achieved_tier];
  const recommendations: string[] = [];

  if (achieved_tier < target_tier) {
    recommendations.push(
      `Current infrastructure achieves Tier ${achieved_tier} (${achieved.name}), falling short of Tier ${target_tier} target`
    );
    if (critical_gaps.length > 0) {
      recommendations.push(
        `${critical_gaps.length} critical gap(s) must be addressed: ${critical_gaps.map((g) => g.requirement).join(", ")}`
      );
    }
  }

  if (target_tier >= 3 && distribution_paths < 2) {
    recommendations.push(
      "Dual distribution paths are essential for Tier III+. This typically requires two independent utility feeds and separate electrical paths to each rack"
    );
  }

  if (target_tier === 4 && !fault_tolerant) {
    recommendations.push(
      "Tier IV fault tolerance requires that any single component failure or maintenance event does NOT impact IT operations. This demands 2N or 2(N+1) for all critical systems"
    );
  }

  if (achieved_tier === target_tier) {
    recommendations.push(
      `Infrastructure meets Tier ${target_tier} requirements. Consider Uptime Institute certification for third-party validation`
    );
  }

  return {
    target_tier,
    target_tier_name: target.name,
    achieved_tier,
    achieved_tier_name: achieved.name,
    meets_target: achieved_tier >= target_tier,
    expected_uptime: achieved.uptime,
    expected_annual_downtime_hours: achieved.annual_downtime_hours,
    gaps,
    estimated_cost_per_kw: TIER_REQUIREMENTS[target_tier].cost_per_kw,
    recommendations,
  };
}
