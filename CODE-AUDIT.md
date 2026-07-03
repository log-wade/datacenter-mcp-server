# Code Audit — datacenter-mcp-server
**Date:** 2026-07-03 · **Scope:** UPS sizing + cooling engines (deep), constants, schemas, test suite (structural) · **Auditor:** Claude, with Logan
**Verdict: the code is clean; some of the math is not yet trustworthy. Do not remove "beta" labels from UPS Sizing or Cooling Load until CRITICAL and MAJOR items are fixed.**

---

## What's good

- Clean separation: engines / schemas / MCP surface. Easy to test, easy to fix.
- Zod schemas with realistic ranges and `.strict()` — input validation exists and refuses garbage.
- Tier classification constants match published Uptime Institute figures (99.671/99.741/99.982/99.995, downtime hours correct).
- 178 tests run green.

## The core problem with the test suite

**Zero tests check outputs against external reference values.** Every test asserts structural properties: results are positive, monotonic, echo the inputs, have the right shape. A grep for `IEEE|ASHRAE|reference|manufacturer` across all 7 test files returns nothing. **The suite would pass if every calculation were 2× wrong.** These are useful regression tests, but they are not verification. Golden tests (see `tests/golden/`) are the fix.

---

## UPS Sizing Engine — findings

### CRITICAL-1: Battery sizing ignores discharge-rate derating
`calculateBatteryStringCount` uses ideal energy math: `E = P × t / η`. Batteries are not ideal energy buckets — at short discharge durations (5–15 min, exactly this tool's typical use), VRLA delivers roughly **half** of nameplate energy due to rate effects (Peukert). Real UPS battery sizing uses constant-power-per-cell discharge tables at the specified runtime (IEEE 485 methodology; manufacturer kW/bloc tables at 10-min/15-min rates).
**Consequence: the tool undersizes VRLA strings by roughly 1.5–2× at short runtimes.** This is the single most dangerous defect in the product — the output looks plausible and is wrong in the unsafe direction.
**Fix:** replace energy-bucket math with rate-adjusted capacity: either embed a conservative rate-derating curve (e.g., usable fraction vs runtime for VRLA and Li-ion), or require a `kw_per_string_at_runtime` input sourced from manufacturer data. Show the derating in the output.

### CRITICAL-2: No aging factor, no temperature correction, no DoD limit
IEEE 485 applies a 1.25 aging factor (batteries are sized to meet load at end of life) and temperature correction. Li-ion systems limit usable depth-of-discharge (~80–90%). None are present. Compounds CRITICAL-1 — combined undersizing is worse.
**Fix:** aging factor 1.25 default (exposed as input), usable-DoD factor for Li-ion, note temperature assumption (25°C) in output.

### MAJOR-1: Battery plant not scaled by redundancy topology
`getUPSModuleCount` correctly doubles modules for 2N — but battery strings are sized once, against design load. In a 2N system, **each bus needs its own full battery plant**; the battery configuration, footprint, weight, and lifecycle costs are all understated ~2× for 2N/2N+1 topologies.
**Fix:** multiply string count/energy/footprint/cost by the number of independent buses.

### MAJOR-2: 2N designs get actively wrong advice
Loading percentage is computed against total capacity including redundant modules, so a 2N system always shows <50% loading — which always triggers "consider right-sizing to reduce capital cost." A 2N system at 50% is *correct by design*. An engineer reading this loses trust immediately.
**Fix:** compute loading against N-capacity (single-bus) for the health check; suppress right-sizing advice when topology explains the margin. Also: warning threshold says "above recommended 80% max" but fires at >85% — align.

### MINOR: credibility details
- `cells_per_string: 40` at 480V nominal — those are 12V **blocs/jars**, not cells (a 480V string is 240 cells). Any electrical engineer will catch this label.
- Cost constants ($150/kWh VRLA, $350/kWh Li-ion, maintenance figures) are plausible ROM values but unsourced — cite or label "typical 2026 US market, ROM only."
- `lithium_payback_years` can divide by near-zero and produce nonsense; `Math.max(0, …)` masks negative payback instead of reporting "no payback."

## Cooling Load Engine — findings

### MAJOR-3: PUE-derived room load double-counts the cooling plant
Room cooling load is built as `IT + lighting + 0.6 × (PUE−1) × IT`. PUE overhead *includes the cooling plant's own power* — mostly rejected outdoors, not heat the CRAHs must remove. The 0.6 factor is unsourced. Standard method: room sensible load = IT load + in-room electrical losses (UPS/PDU efficiency curves) + lighting + envelope/people.
**Fix:** compute in-room electrical losses from UPS/PDU efficiencies (constants already exist in `constants.ts`), drop the PUE-share heuristic, keep PUE only for the facility-level rating/recommendations.

### MAJOR-4: Altitude adjustment conflates load with capacity
`cooling_load_kw /= derating` inflates the reported *load*. The heat load does not change with altitude — **equipment capacity** derates (thinner air). Output should show: load (unchanged) and required nameplate capacity (inflated), separately labeled.

### MAJOR-5: Airflow constant is comfort-HVAC, not data center
`CFM_PER_TON = 400` is the comfort-cooling rule of thumb. Data center airflow follows sensible heat: `CFM = 3412 × kW / (1.08 × ΔT°F)`. At ΔT = 20°F that's ~158 CFM/kW ≈ **555 CFM/ton** — the current estimate is ~30% low, and ΔT should be an input (containment changes it).

### MINOR
- `design_outdoor_temp_f` is accepted as an input but never used in any calculation (only triggers one recommendation) — either use it or remove it; unused inputs erode trust.
- `getPUERating` returns "Unknown" for PUE ≥ 3.0 and boundary values sit in the lower band — fine, but document.
- Humidification as flat ×1.07 — acceptable ROM, label it as such in output.

## Power Redundancy Engine — findings (added 2026-07-03, round 2)

### MAJOR-6: Generators sized for IT load only — ignores mechanical load
`generator_count` = `IT × 1.25 / generator_size`. Standby generators must carry the **whole facility**: IT + cooling + house loads, plus motor-starting inrush when chillers/CRAHs restart after transfer. At PUE 1.4, sizing gensets against IT alone under-provides by ~40% before starting kVA is even considered. A facility built to this output drops load on its first real outage.
**Fix:** size against `IT × PUE × margin`, with PUE as an input, and add a note about motor-starting/step-load analysis being out of scope.

### MAJOR-7: Marketing promises features the engine doesn't have
The ai-tools page sells "SPOF detection and reliability scoring." A repo-wide grep finds neither. The result struct has boolean `fault_tolerant`/`concurrent_maintainability` flags derived from the config enum — that's labeling, not analysis. Either build a minimal version (bus-level SPOF list per topology) or remove the claim from the site. **Same class as MAJOR-8 below — a design partner comparing site copy to output will notice in the first session.**

### MINOR (power)
- Same 2N loading-advice bug as UPS engine (MAJOR-2): every 2N config shows <50% loading and triggers "consider smaller modules" — wrong advice for an intentional topology.
- Default UPS efficiency here is 0.95 (`constants.ts`) but 0.96 in the UPS sizing engine — two tools, two answers to the same question. Unify constants.
- N+1 with `switchgear_feeds: 1` is fine, but `2N → fault_tolerant: true` deserves a caveat: 2N is fault-tolerant only with genuinely independent paths — a footnote in output, or engineers will (rightly) quibble.

## GPU Cooling Engine — findings (added 2026-07-03, round 2)

### CRITICAL-3: Coolant flow rate math is wrong by ~3.5×
`calculateCoolantFlowRate` computes `GPM = kW / (500/12000 × ΔT)` → 1.6 GPM/kW at ΔT 15°F. The correct water-side relation is `Q(BTU/hr) = 500 × GPM × ΔT°F`, i.e. `GPM = kW × 3412 / (500 × ΔT)` ≈ **0.455 GPM/kW** at ΔT 15°F. The engine overstates required flow ~3.5× (the stray `/12000` mixes tons into a GPM formula; the code comment even mislabels 500 as "BTU/min per GPM per °F" — it's per *hour*). Oversizing direction, so not unsafe — but any mechanical engineer checks this exact number first, and it's wrong by 250%.

### MAJOR-8: Required input `pue_target` is never used
The schema *requires* `pue_target` (no default); the engine destructures it and never touches it. PUE comparisons use hard-coded "typical" values per cooling type instead. A required input that does nothing is worse than a missing feature — it implies the calculation responds to it. Fix: use it (compare target vs achievable-for-type, warn if unrealistic) or remove it.

### MAJOR-9: "TCO comparison" is energy-only, at 100% utilization
The site sells "air vs. liquid analysis and TCO comparison." The engine computes energy cost delta only — no CAPEX (CDUs, piping, plant mods), no utilization factor (assumes 8760 hrs at full TDP; real AI clusters average well below that). For the neocloud buyer this tool targets, energy-only-at-full-load systematically overstates liquid-cooling savings. Rename the output ("annual energy cost delta at full load") or add CAPEX + utilization inputs.

### MINOR (GPU)
- Site copy lists MI300X support; the enum has no MI300X (750W). Add it or fix the copy.
- GB200 at 1200W is ambiguous: the GB200 superchip (Grace + 2× B200) is ~2700W. If 1200W means "per Blackwell die," label it — a buyer planning racks off this number could be ~2× off per package.
- 15% networking/CPU overhead: plausible, unsourced — cite or label ROM.
- Strategy thresholds overlap at boundaries (15 kW/rack matches both air and rear-door; first match wins silently).
- CDU count = racks/10 regardless of kW — CDUs are sized by heat load, not rack count; label as rough estimate.

## API / Billing Surface (`api/server.ts`) — findings (added 2026-07-03, round 3)

### CRITICAL-4: The paid cloud product does not exist as a gated service
The pricing page sells "Cloud API, API key authentication, 1,000 calls/month" ($149/mo). The actual Vercel endpoint has **no authentication, no rate limiting, no metering, and no Stripe linkage of any kind**. `middleware.ts` contains an auth middleware — imported only by `src/index.ts` (the *free local* entry point), never by `api/server.ts` (the *paid cloud* one). Even the unused middleware validates against a single shared `API_KEY` env var — one key for all customers, no per-customer provisioning, and "allow all if unset." A Stripe purchase today delivers a receipt and nothing else.
**Fix (minimum viable):** per-customer keys in a KV store (Vercel KV/Upstash), Stripe webhook → key provisioning email, key check + usage counter in `api/server.ts`. Note: the in-memory rate-limit Map in middleware.ts is useless on serverless (state dies per instance) — the counter must live in KV.

### CRITICAL-4a: The deployed endpoint is dead, and CI is structurally blind to it
`api/server.ts` imports `ENGINEERING_CONSTANTS` from `constants.ts` — **that export does not exist**. Typecheck passes anyway because `tsconfig.json` has `include: ["src/**/*"]` — the deployed entry point is excluded from compilation. Live check (2026-07-03): `GET /health` and `GET /api/server` on datacenter-mcp-server.vercel.app both return **empty responses**. The cloud endpoint appears to be crashing in production, undetected — the same silent-failure pattern as the main site's entitlements.
**Fix:** `tsconfig.ci.json` (added by this audit) typechecks `api/` + `tests/`; CI now fails until the phantom import is fixed — that red build is correct and intentional. Then add the endpoint to the SENTRY daily smoke test.

### MAJOR-10: `dc_reference_lookup` is a stub
Marketed as "Query ASHRAE guidelines, tier requirements, PUE benchmarks on demand." Implementation ignores both `query` and `category` and dumps the entire constants file (via the phantom import, so currently it crashes instead). Implement a real lookup or pull the marketing bullet.

### CRITICAL-4b (confirmed by CI typecheck): all 7 tool registrations are type-invalid
`server.tool()` is called with full `ZodObject`s where the MCP SDK expects a raw shape (`schema.shape`). `npx tsc -p tsconfig.ci.json` reports TS2769 on every registration in `api/server.ts`. Combined with the phantom import (4a), the cloud entry point could never have worked as written — it was simply never compiled. Fix: pass `CoolingLoadSchema.shape` (etc.) or migrate to `registerTool` with `inputSchema`.

### MINOR (API)
- Engine calls have no try/catch — a thrown error becomes an unhandled transport failure.
- CORS `*` is fine for a free API; revisit when keys are real.

## Rack Density Engine — findings (round 3)

- Same wrong airflow constant as cooling engine (MAJOR-5 recurrence): 400 CFM/ton.
- **Internal contradiction:** this engine's recommendation text says "~0.5 GPM per kW" for liquid cooling (approximately correct), while the GPU engine *computes* 1.6 GPM/kW (CRITICAL-3). The product disagrees with itself by 3× — a design partner running both tools will catch it.
- W/sqft warning conflates power density with structural loading (W/sqft vs lbs/sqft) in one message — split them.
- Otherwise sound: classification boundaries, containment thresholds, and recommendations are defensible practice.

## Tier Engine — findings (round 3)

**Closest to de-beta.** Gap logic and walk-down are sound; uptime constants match published Uptime Institute figures. Caveats to add before removing the beta label:
- The assessment is partly **circular**: `concurrently_maintainable` and `fault_tolerant` are self-declared boolean inputs, not derived. Output must say "self-assessment aid — actual Tier certification is issued by Uptime Institute."
- UPS runtime ≥10 min and fire suppression are **not** Uptime tier requirements — they're good-practice heuristics. Label them as such in gap output, or engineers will cite the standard back at you.
- `cost_per_kw` figures ($7k–$35k/kW) are unsourced and pre-2026 vintage — label ROM with a date or update.
- "Tier" is Uptime Institute's trademark — keep marketing copy on the right side of "assesses against Uptime Institute's published criteria."

## Commissioning Engine — findings (round 3)

### MAJOR-11: Duration math produces absurd totals
Phase durations are summed serially and L5 (52 weeks, "operational sustainability") is scaled by size and tier factors like a test phase. A 6MW Tier IV plan: L5 alone = ceil(52 × 1.6 × 1.8) = **150 weeks**; total = **210 weeks (~4 years)**. Any commissioning professional stops reading at that number. Fix: L5 is calendar-based post-occupancy monitoring — exclude it from "commissioning duration," never scale it; note that L1–L4 phases overlap in practice (sum is worst-case serial).
- Template quality otherwise reasonable (L2 point-to-point, tier-gated concurrent-maintenance/fault-injection procedures are the right instinct). Factory witness tests generated for systems that don't get them (CCTV, access control) — filter L1 to major equipment.
- `size_factor`/`tier_factor` heuristics unsourced — fine for planning ROM, label them.

## Audit complete — all 8 tools + API surface covered
Remaining out of scope: `src/index.ts` transport wiring (low risk), npm package publish flow, and the main site's portal/entitlement code (separate repo — audit alongside the Stripe purchase test).

---

## Priority order (final — status as of 2026-07-03 evening)

1. ~~**CRITICAL-4a/4b**~~ **FIXED** — `api/server.ts` rewritten: phantom import removed, `registerTool` + `.shape` + explicit zod parse, real `dc_reference_lookup`, error wrapper so engine failures return structured MCP errors. **Still required: commit, push, redeploy, then confirm `/health` responds in production; add to SENTRY.**
2. **CRITICAL-4 — OPEN** — minimum-viable billing: Stripe webhook → per-customer key in KV → key check + counter in `api/server.ts`. Until then, pause the paid Stripe links (leave Free + "Contact" up).
3. ~~**CRITICAL-1 + CRITICAL-2**~~ **FIXED 2026-07-03** — rate derating implemented from Power-Sonic PHR-12550 published constant-power table (@1.67 V/cell: 0.23 usable @ 5 min → 0.75 @ 120 min; 15 min = 0.44) plus 1.25 IEEE 485 aging factor (exposed as `aging_factor` input). MAJOR-1 fixed in the same change: 2N/2N+1 get a full battery plant per bus, and footprint/lifecycle costs now scale from total nameplate. Output includes a methodology disclosure line. The pre-fix engine was **2.8× undersized at 15 min and up to ~5.4× at 5 min**. Note: the Li-ion curve (0.80–0.90) is a conservative estimate — replace with manufacturer LFP data before removing the UPS tool's beta label.
4. ~~**CRITICAL-3**~~ **FIXED** — coolant flow now `kW × 3412 / (500 × ΔT)`; golden test active and green; rack-density contradiction resolved.
5. **MAJOR-6 — OPEN** (generator sizing ignores mechanical load) — unsafe direction.
6. ~~**MAJOR-2**~~ **FIXED** (both engines) — dual-bus topologies no longer get right-sizing advice; threshold aligned to 80%. One legacy test updated (it had encoded the bug — see note in `tests/power-engine.test.ts`).
7. **Marketing ↔ product mismatches — MOSTLY OPEN** — MAJOR-10 (reference lookup) fixed in code; SPOF claim, MI300X, and TCO wording are site-copy edits still to do.
8. **MAJOR-5 + MAJOR-4 — OPEN** (airflow, altitude labeling).
9. **MAJOR-1 + MAJOR-3 + MAJOR-11 — OPEN** (2N battery plant, room-load method, Cx duration).
10. Tier-engine caveats → first tool to drop its beta label.
11. ~~Golden tests + CI~~ **DONE** — 293 tests: 284 green, 9 pending goldens = the remaining fix roadmap.

**Housekeeping:** `package-lock.json` was rewritten by a fresh `npm install` in the audit sandbox — recommend `git checkout -- package-lock.json` before committing unless a dependency refresh is intended.

**Interim step (today):** every affected output gets a caveat line — "Beta: energy-based estimate; does not yet include discharge-rate derating or aging factor; not for construction decisions." Honest labels buy time to fix the math properly.
