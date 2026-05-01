<p align="center">
  <a href="https://hive-mcp-audit-readiness.onrender.com/health">
    <img src="https://img.shields.io/badge/Hive%20Civilization-MCP-C08D23?style=flat-square" alt="Hive Civilization MCP"/>
  </a>
</p>

<h1 align="center">hive-mcp-audit-readiness</h1>

<p align="center"><strong>EU AI Act · Colorado AI Act · CCPA · SB 942 · LL 144 · HIPAA — readiness scoring with sourced penalty math</strong></p>

<p align="center">
  <a href="https://glama.ai/mcp/servers"><img alt="Glama" src="https://img.shields.io/badge/Glama-pending-C08D23?style=flat-square"/></a>
  <a href="https://hive-mcp-audit-readiness.onrender.com/health"><img alt="Live" src="https://img.shields.io/badge/service-live-C08D23?style=flat-square"/></a>
  <a href="https://github.com/srotzin/hive-mcp-audit-readiness/releases"><img alt="Release" src="https://img.shields.io/github/v/release/srotzin/hive-mcp-audit-readiness?style=flat-square&color=C08D23"/></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-C08D23?style=flat-square"/></a>
  <a href="https://github.com/srotzin/hive-mcp-audit-readiness/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/badge/CodeQL-enabled-C08D23?style=flat-square"/></a>
  <a href="https://www.opensanctions.org/"><img alt="OpenSanctions" src="https://img.shields.io/badge/OpenSanctions-integrated-C08D23?style=flat-square"/></a>
</p>

<p align="center">
  <code>https://hive-mcp-audit-readiness.onrender.com/mcp</code>
</p>

---

## What this is

`hive-mcp-audit-readiness` is a Model Context Protocol (MCP) server that wraps the live HiveAudit Readiness assessment endpoint at `https://hivemorph.onrender.com/v1/audit/readiness`. It computes a multi-jurisdictional AI compliance readiness score in a single call: penalty exposure in EUR and USD, Article-citing compliance gaps, recommended audit tier, and the nearest enforcement deadline.

Penalty math is sourced from the regulations directly:

- **EU AI Act** — Reg 2024/1689 Art 99 (€15M floor, €35M cap, 3% / 7% turnover)
- **Colorado AI Act** — CRS § 6-1-1701 ($20K per consumer violation, effective 2026-06-30)
- **California SB 942** — Cal. Bus. & Prof. § 22757 ($5K / violation / day)
- **CCPA** — Cal. Civ. § 1798.155 ($7,500 per violation)
- **NYC LL 144** — § 20-871 ($1,500 per occurrence)
- **HIPAA** — 45 CFR § 160.404 ($1.5M annual cap)
- **NIST AI RMF** + **ISO 42001** — gap analysis only, no penalty math

- **Protocol:** MCP 2024-11-05 over Streamable-HTTP / JSON-RPC 2.0
- **Transport:** `POST /mcp`
- **Discovery:** `GET /.well-known/mcp.json`
- **Health:** `GET /health`
- **Auth:** none — free
- **Rate limit:** 10 requests / IP / hour
- **Brand gold:** Pantone 1245 C / `#C08D23`

## Tools

| Tool | Description |
|---|---|
| `audit_readiness_score` | Compute a multi-jurisdictional readiness score: penalty exposure (EUR + USD), Article-citing compliance gaps, recommended audit tier, nearest deadline. |
| `audit_get_tier_pricing` | Get the four published HiveAudit tier prices and brackets (STARTER $500 / STANDARD $1,500 / ENTERPRISE $2,500 / FEDERAL $7,500/yr). |

## Backend endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/audit/readiness` | Multi-jurisdictional readiness score |

## Run locally

```bash
git clone https://github.com/srotzin/hive-mcp-audit-readiness.git
cd hive-mcp-audit-readiness
npm install
npm start
# server up on http://localhost:3000/mcp
curl http://localhost:3000/health
curl http://localhost:3000/.well-known/mcp.json
```

## Connect from an MCP client

### Claude Desktop, Cursor, Manus

```json
{
  "mcpServers": {
    "hive-audit-readiness": {
      "url": "https://hive-mcp-audit-readiness.onrender.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Coinbase AgentKit (Model Context Protocol extension)

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { McpClient } from "@modelcontextprotocol/sdk/client";

const audit = new McpClient();
await audit.connect({
  url: "https://hive-mcp-audit-readiness.onrender.com/mcp",
  transport: "streamable-http"
});

const agentKit = await AgentKit.from({
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
  mcpClients: [audit]
});
```

### GOAT SDK

GOAT SDK consumes any MCP server via its `@goat-sdk/plugin-mcp` adapter — point at `https://hive-mcp-audit-readiness.onrender.com/mcp`.

### Pulse MCP

Auto-crawled from the Official MCP Registry entry `io.github.srotzin/hive-mcp-audit-readiness`.

### Glama / MCP.so / mcpverse / mcp-hunt / mkinf

Auto-crawled from this GitHub repo.

## Example call

```bash
curl -s -X POST https://hive-mcp-audit-readiness.onrender.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{
      "name":"audit_readiness_score",
      "arguments":{
        "organization_country":"DE",
        "jurisdictions":["EU"],
        "data_volume_records":500000,
        "agent_count":10,
        "monthly_inference_calls":5000000,
        "sectors":["finance"],
        "frameworks":["eu_ai_act","gdpr"],
        "company":"Example GmbH"
      }
    }
  }'
```

Returns penalty exposure (€15M EU AI Act Art 99), specific gaps (Articles 12, 13), and the recommended ENTERPRISE tier ($2,500) with a 30-day Professional trial CTA.

## Disclaimers

- This is an automated readiness score, not legal advice. Engage qualified counsel for binding compliance opinions.
- Penalty math reflects statutory ceilings as of 2026-04-30. Statutes change — verify the regulation source if relying on a specific number.
- The HiveAudit Professional trial is a 30-day evaluation. The four tier prices are one-time bundles or annual subscriptions; see [thehiveryiq.com/pricing](https://thehiveryiq.com/pricing).

## License

MIT — see [LICENSE](LICENSE).

---

Brand gold: Pantone 1245 C / `#C08D23`. Treasury (EIP-55): `0x15184Bf50B3d3F52b60434f8942b7D52F2eB436E` (Base mainnet).
