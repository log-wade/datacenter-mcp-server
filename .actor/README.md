# Data Center Engineering MCP Server

![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen)
![MCP](https://img.shields.io/badge/MCP-1.12-orange)

Mission-critical data center design & engineering tools exposed via the Model Context Protocol (MCP). Built for AI agents that need to perform real-world infrastructure calculations, tier assessments, and commissioning planning with engineering rigor.

## What It Does

This MCP server provides **six powerful tools** for data center infrastructure analysis:

### 1. **Cooling Load Calculator** (`dc_calculate_cooling_load`)
Calculate total cooling capacity requirements with precision:
- Computes cooling load in **kW, tons, BTU/hr, and CFM**
- Accounts for IT heat rejection, electrical overhead, lighting, and humidification
- **Altitude derating** for sites above 5,000 ft
- **PUE rating** analysis and efficiency assessment
- Engineering recommendations based on ASHRAE TC 9.9 guidelines

### 2. **Power Redundancy Analyzer** (`dc_analyze_power_redundancy`)
Size power infrastructure for mission-critical facilities:
- Supports **N, N+1, 2N, and 2N+1** redundancy configurations
- Calculates UPS modules, generator count, and total capacity
- PDU requirements and switchgear feed analysis
- **Electrical efficiency chain** losses (UPS → PDU → transformer)
- Concurrent maintainability and fault tolerance assessment

### 3. **Tier Classification Assessor** (`dc_assess_tier_classification`)
Gap analysis against Uptime Institute standards:
- Evaluates against **Tier I, II, III, and IV** requirements
- Identifies compliance gaps and remediation path
- Detailed requirements checklist
- Facility classification recommendations
- Based on official Uptime Institute Tier Standard

### 4. **Commissioning Plan Generator** (`dc_generate_commissioning_plan`)
Generate ASHRAE-based commissioning strategies:
- Structured **commissioning phases** (Preliminary, Design, Construction, Acceptance, Ongoing)
- Test procedures with success criteria
- Milestone tracking and sign-off requirements
- Quality assurance checklist
- Per ASHRAE Guideline 0 standards

### 5. **Rack Density Analyzer** (`dc_analyze_rack_density`)
Classify and recommend cooling strategies:
- Identifies **low, medium, high, and very-high** density racks
- Recommends appropriate cooling method (air, hot/cold containment, liquid)
- Provides density classification ratios
- Heat output per rack estimates
- Space utilization metrics

### 6. **Reference Lookup Tool** (`dc_reference_lookup`)
Access comprehensive engineering reference data:
- Tier requirements and specifications
- PUE benchmarks by data center type
- Rack density classifications
- Commissioning phase requirements
- Quick lookup without calculations

## Use Cases

### Infrastructure Planning
- **Capacity modeling**: Calculate cooling and power requirements for new facilities
- **Expansion analysis**: Determine additional cooling/power needed for growth
- **Site assessment**: Evaluate facility tier classification and gaps

### Operations & Engineering
- **Tier gap analysis**: Identify compliance gaps against Uptime Institute standards
- **Cooling strategy**: Determine optimal cooling approach for rack densities
- **Power redundancy**: Size UPS and generator infrastructure correctly
- **Commissioning oversight**: Plan and track facility commissioning activities

### AI Agent Integration
- Embed data center expertise into Claude, LLMs, and AI agents
- Automate infrastructure calculations for automated planning tools
- Enable agents to reason about facility design requirements
- Support decision-making with engineering-backed analysis

## Quick Start

### Prerequisites
- Node.js 20+ or Docker
- npm or yarn package manager

### Installation & Deployment

**Using Docker (Recommended for Apify):**
```bash
# Build the Docker image
docker build -t datacenter-mcp-server .actor/

# Run the container
docker run -p 3000:3000 \
  -e RATE_LIMIT_RPM=100 \
  -e PORT=3000 \
  datacenter-mcp-server
```

**Local Development:**
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in HTTP mode
npm run start:http

# Server runs on http://localhost:3000
```

### Verify Installation
```bash
# Health check
curl http://localhost:3000/health

# Call a tool
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dc_calculate_cooling_load",
    "params": {
      "it_load_kw": 500,
      "pue": 1.5,
      "safety_factor": 1.15,
      "lighting_area_sqft": 10000
    }
  }'
```

## Configuration

Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_RPM` | 100 | Max requests per minute |
| `PORT` | 3000 | HTTP server port |
| `REQUEST_TIMEOUT_MS` | 30000 | Request timeout in milliseconds |
| `ENABLE_METRICS` | true | Enable performance metrics |
| `API_KEY` | (optional) | API key for authentication |

### Example Configuration
```bash
export RATE_LIMIT_RPM=500
export PORT=8080
export REQUEST_TIMEOUT_MS=60000
npm run start:http
```

## Pricing & Monetization

This server is designed for marketplace deployment with flexible pricing models:

### Apify Actor
- **Standard Tier**: $0.15 - $0.25 per calculation
- **Enterprise Tier**: $0.50 - $1.25 per calculation
- Ideal for embedded usage in automation workflows
- Billed per tool invocation with Apify's built-in billing

### Per-Use Pricing Model
- **Simple calculations** (reference lookups): $0.15
- **Standard calculations** (cooling, power): $0.35
- **Complex analysis** (tier assessment, commissioning): $0.75
- **Batch operations**: Volume discounts available

### Self-Hosted Option
- Deploy behind your own authentication
- Implement custom billing with Nevermined SDK
- Full control over pricing and monetization

## Example API Calls

### 1. Calculate Cooling Load
```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dc_calculate_cooling_load",
    "params": {
      "it_load_kw": 2000,
      "pue": 1.4,
      "safety_factor": 1.15,
      "lighting_area_sqft": 20000,
      "include_humidification": true,
      "altitude_ft": 5000,
      "design_outdoor_temp_f": 95
    }
  }'
```

Response:
```json
{
  "cooling_load_kw": 3152.5,
  "cooling_load_tons": 265,
  "cooling_load_btu": 10751050,
  "estimated_airflow_cfm": 52630,
  "pue_rating": "1.4 (AVERAGE)",
  "recommendations": [
    "Consider implementing hot/cold aisle containment",
    "At 2000 kW, you likely need multiple CRAC/CRAH units",
    "Monitor PUE closely - 1.4 is reasonable but optimization may yield 1.2-1.3"
  ]
}
```

### 2. Analyze Power Redundancy
```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dc_analyze_power_redundancy",
    "params": {
      "it_load_kw": 500,
      "redundancy_config": "2N+1",
      "ups_efficiency": 0.94,
      "generator_efficiency": 0.85
    }
  }'
```

Response:
```json
{
  "redundancy_config": "2N+1",
  "ups_modules_count": 3,
  "ups_module_size_kw": 250,
  "generator_count": 2,
  "generator_total_capacity_kw": 1200,
  "estimated_efficiency": 0.80,
  "fuel_autonomy_hours": 4,
  "fault_tolerance": "Can sustain complete loss of entire 50% infrastructure while maintaining operations"
}
```

### 3. Assess Tier Classification
```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dc_assess_tier_classification",
    "params": {
      "facility_tier": "Tier_III",
      "has_redundant_components": true,
      "has_redundant_site": false,
      "has_concurrent_maintainability": true,
      "availability_target_percent": 99.67
    }
  }'
```

### 4. Generate Commissioning Plan
```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dc_generate_commissioning_plan",
    "params": {
      "facility_tier": "Tier_IV",
      "commissioning_level": "FULL",
      "total_capacity_kw": 5000,
      "cooling_tons": 1500
    }
  }'
```

## API Documentation

Each tool provides:
- **Tool name** for invocation
- **Input schema** with validation
- **Structured output** in JSON format
- **Error handling** with detailed messages
- **Rate limiting** per configuration

All responses include engineering context and recommendations based on industry standards.

## Technical Standards

This server implements calculations based on:
- **ASHRAE TC 9.9**: Cooling load calculations and PUE guidelines
- **Uptime Institute Tier Standard**: Facility classification requirements
- **ASHRAE Guideline 0**: Commissioning best practices
- **Manufacturer standards**: Equipment derating curves and efficiency ratings

## Integration

### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "datacenter": {
      "command": "node",
      "args": ["/path/to/datacenter-mcp-server/dist/index.js"]
    }
  }
}
```

### Cursor / Other Editors
Use the HTTP endpoint:
- Base URL: `http://localhost:3000`
- Register MCP server with HTTP transport

### Custom Integration
Embed in your application:
```javascript
import { McpServer } from "@modelcontextprotocol/sdk";
// Configure and use...
```

## Performance & Scalability

- **Sub-second response times** for most calculations
- **Horizontal scaling** supported via HTTP mode
- **Rate limiting** to prevent abuse
- **Request timeout** configuration for long-running operations
- **Health check** endpoint for monitoring

## Support & Documentation

- **Documentation**: See main README.md for architecture details
- **Issues**: Report bugs or feature requests on GitHub
- **Community**: Join data center engineering discussions

## License

MIT License - NextGen Mission Critical

---

**Ready to deploy?** Use Apify's Actor framework for marketplace availability with built-in billing and distribution.
