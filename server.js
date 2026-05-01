#!/usr/bin/env node
/**
 * HiveAudit Readiness MCP Server
 * EU AI Act / Colorado AI Act / CCPA / SB942 / NYC LL144 / HIPAA readiness scoring
 *
 * Backend: https://hivemorph.onrender.com/v1/audit/readiness
 * Spec   : MCP 2024-11-05 / Streamable-HTTP / JSON-RPC 2.0
 * Brand  : Hive Civilization gold #C08D23 (Pantone 1245 C)
 */

import express from 'express';
import { mcpErrorWithEnvelope, recruitmentEnvelope, assertEnvelopeIntegrity } from './recruitment.js';
assertEnvelopeIntegrity();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const HIVE_BASE = process.env.HIVE_BASE || 'https://hivemorph.onrender.com';
const BRAND_GOLD = '#C08D23';
const SERVICE_NAME = 'hive-mcp-audit-readiness';
const VERSION = '1.0.0';

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'audit_readiness_score',
    description: 'Compute a multi-jurisdictional AI compliance readiness score for an organization. Returns penalty exposure (EUR + USD), specific compliance gaps citing the regulation article, recommended audit tier (STARTER/STANDARD/ENTERPRISE/FEDERAL), and the nearest enforcement deadline. Penalty math sources EU AI Act Art 99, Colorado AI Act SB 24-205, CCPA, Cal SB 942, NYC LL 144, HIPAA. Free, no auth, rate-limited 10/IP/hr.',
    inputSchema: {
      type: 'object',
      required: ['organization_country', 'jurisdictions', 'data_volume_records', 'agent_count', 'monthly_inference_calls', 'frameworks'],
      properties: {
        organization_country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code of the organization headquarters (e.g. "US", "DE", "FR", "GB").' },
        jurisdictions: { type: 'array', items: { type: 'string' }, description: 'Where the system operates: ["EU", "US-CO", "US-CA", "US-NY", "US-TX", ...]. Drives which regulations apply.' },
        data_volume_records: { type: 'integer', description: 'Total records processed (drives CCPA / GDPR scoping).' },
        agent_count: { type: 'integer', description: 'Number of distinct AI agents in production.' },
        monthly_inference_calls: { type: 'integer', description: 'Inference call volume per month (drives tier selection).' },
        sectors: { type: 'array', items: { type: 'string' }, description: 'Industries: ["finance", "healthcare", "employment", "education", "lending", "insurance", "criminal_justice", "biometric", "critical_infrastructure"]. High-risk sectors trigger Annex III scoping.' },
        frameworks: { type: 'array', items: { type: 'string' }, description: 'Regulations to score against: ["eu_ai_act", "co_ai_act", "ccpa", "ca_sb942", "nyc_ll144", "hipaa", "gdpr", "nist_ai_rmf"].' },
        company: { type: 'string', description: 'Organization name (optional; populates the assessment record).' }
      }
    }
  },
  {
    name: 'audit_get_tier_pricing',
    description: 'Get the four published HiveAudit tier prices and bracket thresholds: STARTER ($500, <$500K exposure), STANDARD ($1,500, <$5M), ENTERPRISE ($2,500, <$50M), FEDERAL ($7,500/yr, ≥$50M or federal agency). Returns the tier card mapping plus the trial CTA. No backend call — inlined for offline discovery.',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── Inlined tier card (matches /v1/audit/readiness recommended_tier output) ─

const TIER_CARD = {
  tiers: [
    { id: 'STARTER', label: 'Audit Starter', price_usd: 500, billing: 'one_time_bundle', exposure_ceiling_usd: 500_000, window_days: 30, calls_max: 10_000, description: 'Single audit bundle, 30-day window, up to 10K calls, PDF + JSON export.' },
    { id: 'STANDARD', label: 'Audit Standard', price_usd: 1_500, billing: 'one_time_bundle', exposure_ceiling_usd: 5_000_000, window_days: 90, calls_max: 100_000, description: 'Single audit bundle, 90-day window, up to 100K calls, PDF + JSON export, multi-jurisdiction.' },
    { id: 'ENTERPRISE', label: 'Audit Enterprise', price_usd: 2_500, billing: 'one_time_bundle', exposure_ceiling_usd: 50_000_000, window_days: 180, calls_max: 500_000, description: 'Single audit bundle, 180-day window, up to 500K calls, EU AI Act + NIST AI RMF + ISO 42001 mapping, white-glove delivery.' },
    { id: 'FEDERAL', label: 'Audit Federal', price_usd: 7_500, billing: 'annual_subscription', exposure_ceiling_usd: null, window_days: 365, calls_max: null, description: 'Annual subscription. Federal-agency contracts or organizations with >$50M penalty exposure. Continuous monitoring, quarterly attestation, FedRAMP-aligned controls.' }
  ],
  primary_cta: {
    label: 'Start 30-day HiveAudit Professional trial',
    url: 'https://thehiveryiq.com/audit/trial',
    subtext: 'No credit card. ZK audit trail activates immediately.'
  },
  secondary_cta: {
    label: 'Or buy a one-time audit bundle',
    url: 'https://thehiveryiq.com/pricing',
    subtext: null
  },
  endpoint: `${HIVE_BASE}/v1/audit/readiness`,
  rate_limit: '10 requests / IP / hour',
  auth_required: false,
  brand_gold: BRAND_GOLD
};

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function hivePost(path, body) {
  const res = await fetch(`${HIVE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  let data;
  try { data = await res.json(); } catch { data = { raw: await res.text() }; }
  return { data, status: res.status };
}

// ─── Tool execution ──────────────────────────────────────────────────────────

async function executeTool(name, args) {
  switch (name) {
    case 'audit_readiness_score': {
      const { data, status } = await hivePost('/v1/audit/readiness', args);
      return { type: 'text', text: JSON.stringify({ status, ...data }, null, 2) };
    }
    case 'audit_get_tier_pricing': {
      return { type: 'text', text: JSON.stringify(TIER_CARD, null, 2) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP JSON-RPC handler ────────────────────────────────────────────────────

app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (jsonrpc !== '2.0') {
    return res.json(mcpErrorWithEnvelope(id, -32600, 'Invalid JSON-RPC'));
  }
  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: SERVICE_NAME,
              version: VERSION,
              description: 'EU AI Act / Colorado AI Act / CCPA / SB942 / LL144 / HIPAA readiness scoring with sourced penalty math.'
            }
          }
        });
      case 'tools/list':
        return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      case 'tools/call': {
        const { name, arguments: args } = params || {};
        const out = await executeTool(name, args || {});
        return res.json({ jsonrpc: '2.0', id, result: { content: [out] } });
      }
      default:
        return res.json(mcpErrorWithEnvelope(id, -32601, `Method not found: ${method}`));
    }
  } catch (e) {
    return res.json(mcpErrorWithEnvelope(id, -32603, e.message));
  }
});

// ─── Discovery + health ──────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    version: VERSION,
    backend: HIVE_BASE,
    endpoint: `${HIVE_BASE}/v1/audit/readiness`,
    auth_required: false,
    rate_limit: '10/IP/hr',
    brand: BRAND_GOLD
  });
});

app.get('/.well-known/mcp.json', (req, res) => {
  res.json({
    name: SERVICE_NAME,
    version: VERSION,
    description: 'MCP server for HiveAudit Readiness — multi-jurisdictional AI compliance scoring with sourced penalty math.',
    protocolVersion: '2024-11-05',
    transport: 'streamable-http',
    endpoint: '/mcp',
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    backend: HIVE_BASE,
    repository: 'https://github.com/srotzin/hive-mcp-audit-readiness',
    license: 'MIT',
    brand: BRAND_GOLD
  });
});

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${SERVICE_NAME} · HiveAudit Readiness MCP</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px/1.55 ui-sans-serif,system-ui,-apple-system,sans-serif;color:#111;background:#fafaf7;margin:0;padding:32px;max-width:780px;margin:auto}h1{color:${BRAND_GOLD};margin:0 0 4px}h2{color:${BRAND_GOLD};border-bottom:1px solid #e9e3d2;padding-bottom:4px;margin-top:28px}code{background:#f1ecdf;padding:2px 5px;border-radius:3px}a{color:${BRAND_GOLD}}.grid{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:14px 0}</style></head><body><h1>${SERVICE_NAME}</h1><p><strong>HiveAudit Readiness MCP</strong> — multi-jurisdictional AI compliance readiness scoring with sourced penalty math.</p><div class="grid"><strong>Endpoint:</strong><code>POST /mcp</code><strong>Discovery:</strong><code>GET /.well-known/mcp.json</code><strong>Backend:</strong><code>${HIVE_BASE}/v1/audit/readiness</code><strong>Auth:</strong>none<strong>Rate limit:</strong>10 / IP / hour<strong>Repo:</strong><a href="https://github.com/srotzin/${SERVICE_NAME}">github.com/srotzin/${SERVICE_NAME}</a></div><h2>Tools</h2><ul>${TOOLS.map(t => `<li><code>${t.name}</code> — ${t.description}</li>`).join('')}</ul><h2>Frameworks scored</h2><p>EU Reg 2024/1689 (EU AI Act) Art 99 · Colorado AI Act SB 24-205 (eff Jun 30 2026) · California CCPA · Cal SB 942 · NYC Local Law 144 · HIPAA · NIST AI RMF · ISO 42001.</p></body></html>`);
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} v${VERSION} listening on :${PORT}`);
  console.log(`  backend = ${HIVE_BASE}`);
  console.log(`  mcp     = POST /mcp`);
  console.log(`  health  = GET /health`);
});
