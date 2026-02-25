# datacenter-mcp-server

Mission-critical data center engineering tools for AI agents. 8 professional-grade calculation engines covering cooling, power, GPU thermal optimization, UPS/battery sizing, tier classification, and commissioning workflows.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) standard — works with Claude Desktop, Cursor, Windsurf, Cline, and any MCP-compatible client.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datacenter": {
      "command": "npx",
      "args": ["-y", "datacenter-mcp-server"]
    }
  }
}
```

### Cursor / Windsurf

Add to your MCP settings:

```json
{
  "datacenter": {
    "command": "npx",
    "args": ["-y", "datacenter-mcp-server"]
  }
}
```

### HTTP Mode (Remote)

```bash
TRANSPORT=http PORT=3001 API_KEY=your-secret npx datacenter-mcp-server
```

## Tools

### dc_calculate_cooling_load
Calculate ASHRAE-compliant cooling requirements for any data center facility. Inputs include IT load, redundancy level, climate zone, altitude, and humidity targets. Returns tonnage, airflow, chilled water capacity, and energy estimates.

### dc_analyze_power_redundancy
Analyze electrical distribution from utility feed through UPS, PDU, and rack-level power. Supports N, N+1, 2N, and 2N+1 redundancy configurations with efficiency and cost analysis.

### dc_assess_tier_classification
Evaluate facility design against Uptime Institute Tier I-IV standards. Identifies compliance gaps and provides actionable upgrade recommendations.

### dc_generate_commissioning_plan
Generate L1-L5 commissioning workflows with phase sequencing, test procedures, and documentation requirements per ASHRAE Guideline 0.

### dc_analyze_rack_density
Analyze rack power density configurations from 5 kW to 100+ kW per rack. Covers cooling strategy selection, weight loading, and power distribution.

### dc_gpu_cooling_optimizer
Optimize cooling infrastructure for GPU/AI workloads (H100, A100, H200, B200, GB200). Calculates thermal loads, recommends cooling strategies (air, rear-door, direct liquid, immersion), sizes CDUs, and projects energy savings.

### dc_ups_battery_sizing
Size UPS modules and battery systems with N/N+1/2N/2N+1 redundancy. Compares VRLA vs lithium-ion with 10-year TCO analysis, floor space estimates, and weight calculations.

### dc_reference_lookup
Query ASHRAE standards, Uptime Institute tier requirements, and industry best practices for data center design and operations.

## Engineering Standards

All calculations comply with:

- ASHRAE TC 9.9 thermal guidelines
- Uptime Institute Tier Standard topology
- NFPA 70 / NEC electrical code
- ASHRAE Guideline 0 commissioning

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests (264 tests across 7 suites)
npm test

# Start in stdio mode (MCP default)
npm start

# Start in HTTP mode
npm run start:http

# Inspect with MCP Inspector
npm run inspect
```

## Architecture

```
src/
  index.ts          # MCP server entry point, tool registration
  types.ts          # TypeScript interfaces for all tools
  constants.ts      # Engineering constants and reference data
  middleware.ts      # Express middleware (auth, rate limiting, CORS)
  schemas/          # Zod validation schemas per tool
  services/         # Calculation engines per tool
tests/              # Jest test suites (264 tests)
```

## License

MIT - NextGen Mission Critical
