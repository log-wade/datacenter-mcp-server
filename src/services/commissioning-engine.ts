// datacenter-mcp-server/src/services/commissioning-engine.ts
// Data center commissioning plan generator

import { CX_PHASES, TIER_REQUIREMENTS } from "../constants.js";
import type {
  CommissioningPlanInput,
  CommissioningPlanResult,
  CommissioningPhase,
  TestProcedure,
  Milestone,
} from "../types.js";

const DEFAULT_SYSTEMS = [
  "Electrical — Switchgear & Distribution",
  "Electrical — UPS Systems",
  "Electrical — Generator Systems",
  "Electrical — Automatic Transfer Switches",
  "Mechanical — Chilled Water Plant",
  "Mechanical — CRAH/CRAC Units",
  "Mechanical — Pumps & Piping",
  "Controls — Building Management System (BMS)",
  "Controls — Electrical Power Monitoring (EPMS)",
  "Fire Protection — Detection & Suppression",
  "Security — Access Control & CCTV",
];

function generateTestProcedures(
  phase_id: string,
  systems: string[],
  tier_level: number
): TestProcedure[] {
  const procedures: TestProcedure[] = [];
  let proc_counter = 1;

  for (const system of systems) {
    const base_id = `${phase_id}-${String(proc_counter).padStart(3, "0")}`;

    switch (phase_id) {
      case "L1":
        procedures.push({
          id: base_id,
          name: `Factory witness test — ${system}`,
          system,
          estimated_hours: 8,
          prerequisites: ["Equipment order confirmed", "Test plan approved"],
        });
        break;

      case "L2":
        procedures.push({
          id: base_id,
          name: `Installation verification — ${system}`,
          system,
          estimated_hours: 4,
          prerequisites: ["Equipment installed", "Power available"],
        });
        procedures.push({
          id: `${base_id}a`,
          name: `Startup & point-to-point — ${system}`,
          system,
          estimated_hours: 6,
          prerequisites: [`${base_id} complete`],
        });
        break;

      case "L3":
        procedures.push({
          id: base_id,
          name: `Functional performance test — ${system}`,
          system,
          estimated_hours: 8,
          prerequisites: ["L2 complete for this system", "Test instruments calibrated"],
        });
        break;

      case "L4":
        procedures.push({
          id: base_id,
          name: `Integrated systems test — ${system}`,
          system,
          estimated_hours: 12,
          prerequisites: ["All L3 tests complete", "Load bank available"],
        });
        if (tier_level >= 3) {
          procedures.push({
            id: `${base_id}b`,
            name: `Concurrent maintenance simulation — ${system}`,
            system,
            estimated_hours: 8,
            prerequisites: [`${base_id} complete`],
          });
        }
        if (tier_level >= 4) {
          procedures.push({
            id: `${base_id}c`,
            name: `Fault injection test — ${system}`,
            system,
            estimated_hours: 10,
            prerequisites: [`${base_id}b complete`],
          });
        }
        break;

      case "L5":
        procedures.push({
          id: base_id,
          name: `Seasonal performance verification — ${system}`,
          system,
          estimated_hours: 4,
          prerequisites: ["Facility operational for 3+ months"],
        });
        break;
    }

    proc_counter++;
  }

  return procedures;
}

export function generateCommissioningPlan(input: CommissioningPlanInput): CommissioningPlanResult {
  const {
    facility_size_kw,
    tier_level,
    include_levels,
    custom_systems,
  } = input;

  const systems = custom_systems && custom_systems.length > 0 ? custom_systems : DEFAULT_SYSTEMS;

  // Scale durations based on facility size
  const size_factor = facility_size_kw <= 500 ? 0.7 : facility_size_kw <= 2000 ? 1.0 : facility_size_kw <= 5000 ? 1.3 : 1.6;

  // Tier complexity multiplier
  const tier_factor = tier_level <= 2 ? 1.0 : tier_level === 3 ? 1.4 : 1.8;

  const phases: CommissioningPhase[] = [];
  let total_test_procedures = 0;

  for (const cx_phase of CX_PHASES) {
    const level_num = parseInt(cx_phase.id.replace("L", ""));
    if (!include_levels.includes(level_num)) continue;

    const test_procedures = generateTestProcedures(cx_phase.id, systems, tier_level);
    const duration_weeks = Math.ceil(cx_phase.typical_duration_weeks * size_factor * tier_factor);

    phases.push({
      id: cx_phase.id,
      name: cx_phase.name,
      duration_weeks,
      description: cx_phase.description,
      test_procedures,
    });

    total_test_procedures += test_procedures.length;
  }

  const total_duration_weeks = phases.reduce((sum, p) => sum + p.duration_weeks, 0);

  // Generate critical milestones
  const critical_milestones: Milestone[] = [
    {
      name: "Commissioning Authority Engagement",
      phase: "Pre-L1",
      description: "CxA engaged and commissioning plan approved by owner",
    },
  ];

  if (include_levels.includes(2)) {
    critical_milestones.push({
      name: "All Systems Startup Complete",
      phase: "L2",
      description: "All major systems started and point-to-point verified",
    });
  }
  if (include_levels.includes(3)) {
    critical_milestones.push({
      name: "Functional Performance Complete",
      phase: "L3",
      description: "All individual systems pass functional performance testing",
    });
  }
  if (include_levels.includes(4)) {
    critical_milestones.push({
      name: "IST Complete — Load Bank Test",
      phase: "L4",
      description: "Full load bank test at design capacity with all systems integrated",
    });
    if (tier_level >= 3) {
      critical_milestones.push({
        name: "Concurrent Maintenance Demo",
        phase: "L4",
        description: "Successful demonstration of maintenance on any component without IT impact",
      });
    }
    if (tier_level >= 4) {
      critical_milestones.push({
        name: "Fault Tolerance Verification",
        phase: "L4",
        description: "Verified that any single fault does not impact IT operations",
      });
    }
    critical_milestones.push({
      name: "Beneficial Occupancy / IT Load Migration",
      phase: "Post-L4",
      description: "Facility cleared for IT equipment installation and load migration",
    });
  }

  // Recommendations
  const recommendations: string[] = [];

  if (tier_level >= 3 && !include_levels.includes(4)) {
    recommendations.push(
      "For Tier III+ facilities, Level 4 (Integrated Systems Testing) is strongly recommended to verify concurrent maintainability under load"
    );
  }
  if (facility_size_kw > 2000) {
    recommendations.push(
      "For facilities above 2 MW, consider phased commissioning aligned with construction sequence to avoid schedule delays"
    );
  }
  if (tier_level >= 4) {
    recommendations.push(
      "Tier IV commissioning should include fault injection testing for every single point of failure identified in the FMEA"
    );
  }
  recommendations.push(
    `Estimated commissioning duration: ${total_duration_weeks} weeks with ${total_test_procedures} test procedures across ${systems.length} systems`
  );
  recommendations.push(
    "Engage an independent Commissioning Authority (CxA) early in design phase for best results"
  );

  return {
    facility_size_kw,
    tier_level,
    phases,
    total_duration_weeks,
    total_test_procedures,
    critical_milestones,
    recommendations,
  };
}
