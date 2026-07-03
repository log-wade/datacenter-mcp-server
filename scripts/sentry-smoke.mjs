#!/usr/bin/env node
// SENTRY smoke test — datacenter-mcp-server production health + math verification.
// Runs the four layers: /health, MCP initialize, tools/list (all 8), and two
// golden calculations (cooling exact-match + GPU coolant version fingerprint).
//
// Usage:
//   node scripts/sentry-smoke.mjs                 # test production
//   BASE_URL=https://preview-url node scripts/sentry-smoke.mjs
//   NTFY_URL=https://ntfy.sh/your-topic node ...  # push alert on failure
//
// GX10 cron (daily 06:00, alert on failure):
//   0 6 * * * cd /path/to/datacenter-mcp-server && NTFY_URL=https://ntfy.sh/YOUR-TOPIC node scripts/sentry-smoke.mjs >> /var/log/sentry-smoke.log 2>&1
//
// Exit code 0 = all green. Non-zero = something a paying customer would hit.

const BASE = process.env.BASE_URL ?? "https://datacenter-mcp-server.vercel.app";
const MCP = `${BASE}/api/server`;
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

const failures = [];
const note = (ok, name, detail = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`) ||
  (!ok && failures.push(`${name}${detail ? `: ${detail}` : ""}`));

async function rpc(id, method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`RPC error: ${JSON.stringify(body.error)}`);
  return body.result;
}

function parseToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  return text ? JSON.parse(text) : undefined;
}

// Layer 1 — health
try {
  const res = await fetch(`${BASE}/health`);
  const body = await res.json();
  note(res.ok && body.status === "ok", "L1 /health", `HTTP ${res.status}`);
} catch (e) {
  note(false, "L1 /health", String(e));
}

// Layer 2 — MCP handshake
try {
  const init = await rpc(1, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "sentry-smoke", version: "1.0" },
  });
  note(Boolean(init?.serverInfo?.name), "L2 initialize", init?.serverInfo?.version);
} catch (e) {
  note(false, "L2 initialize", String(e));
}

// Layer 3 — all 8 tools registered
const EXPECTED_TOOLS = [
  "dc_calculate_cooling_load",
  "dc_analyze_power_redundancy",
  "dc_assess_tier_classification",
  "dc_generate_commissioning_plan",
  "dc_analyze_rack_density",
  "dc_gpu_cooling_optimizer",
  "dc_ups_battery_sizing",
  "dc_reference_lookup",
];
try {
  const list = await rpc(2, "tools/list");
  const names = (list?.tools ?? []).map((t) => t.name);
  const missing = EXPECTED_TOOLS.filter((t) => !names.includes(t));
  note(missing.length === 0, "L3 tools/list", missing.length ? `missing: ${missing.join(", ")}` : `${names.length} tools`);
} catch (e) {
  note(false, "L3 tools/list", String(e));
}

// Layer 4a — golden calculation: cooling load exact-match
try {
  const r = parseToolResult(
    await rpc(3, "tools/call", {
      name: "dc_calculate_cooling_load",
      arguments: { it_load_kw: 100, pue: 1.0, safety_factor: 1.0 },
    })
  );
  const okKw = Math.abs(r.cooling_load_kw - 100) < 0.5;
  const okTons = Math.abs(r.cooling_load_tons - 28.43) < 0.1;
  note(okKw && okTons, "L4a golden cooling", `kw=${r.cooling_load_kw} tons=${r.cooling_load_tons}`);
} catch (e) {
  note(false, "L4a golden cooling", String(e));
}

// Layer 4b — GPU coolant flow: version fingerprint + correctness
// Corrected math (CODE-AUDIT.md CRITICAL-3): 824.32 kW @ ΔT15 → ~375 GPM.
// Old broken math returns ~1,319 GPM. Failure here = wrong code deployed.
try {
  const r = parseToolResult(
    await rpc(4, "tools/call", {
      name: "dc_gpu_cooling_optimizer",
      arguments: {
        gpu_count: 1024, gpu_model: "H100", rack_count: 32,
        cooling_type: "direct_liquid", ambient_temp_f: 75, pue_target: 1.15,
      },
    })
  );
  const gpm = r.coolant_flow_rate_gpm;
  const ok = gpm > 355 && gpm < 395;
  note(ok, "L4b coolant fingerprint", `${gpm} GPM ${ok ? "(fixed math)" : gpm > 1200 ? "(OLD BROKEN MATH DEPLOYED)" : "(unexpected)"}`);
} catch (e) {
  note(false, "L4b coolant fingerprint", String(e));
}

// Summary + optional push alert
if (failures.length) {
  console.error(`\nSENTRY: ${failures.length} failure(s) @ ${new Date().toISOString()}`);
  if (process.env.NTFY_URL) {
    await fetch(process.env.NTFY_URL, {
      method: "POST",
      headers: { Title: "SENTRY: datacenter-mcp-server FAILING", Priority: "high" },
      body: failures.join("\n"),
    }).catch(() => {});
  }
  process.exit(1);
} else {
  console.log(`\nSENTRY: all green @ ${new Date().toISOString()}`);
}
