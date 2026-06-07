#!/usr/bin/env node
/**
 * Tex memory as an MCP stdio server for Paperclip agents — ZERO dependencies
 * (Node 18+ global fetch, hand-rolled MCP/JSON-RPC over stdio) so it runs inside
 * the Paperclip container with nothing to install.
 *
 * Exposes two tools the agent calls instead of the file-based memory skill:
 *   - recall_memory({ query })  → semantic recall from Tex
 *   - remember({ note })        → persist a memory to Tex
 *
 * Talks to Tex DIRECTLY (token-exchange + /recall + /ingestion/memory) using
 * creds from env — the agent's memory does not depend on the office web app.
 *
 * Env:
 *   TEX_API_URL   (default https://api.getmetacognition.com)
 *   TEX_API_KEY   (required)         — the org is locked to this key
 *   TEX_ORG_ID    (required)         — scope.org_id
 *   AGENT_HOME    (optional)         — used to derive a per-agent user_id
 *   TEX_SESSION   (optional)         — scope.session_id (defaults to "company")
 */

const TEX_URL = (process.env.TEX_API_URL || 'https://api.getmetacognition.com').replace(/\/$/, '');
const TEX_KEY = process.env.TEX_API_KEY || '';
const ORG_ID = process.env.TEX_ORG_ID || '';
const SESSION = process.env.TEX_SESSION || 'company';

// Derive a stable per-agent id from AGENT_HOME (…/agents/<uuid>/…), else "shared".
function agentUserId() {
  const home = process.env.AGENT_HOME || '';
  const m = home.match(/agents\/([0-9a-f-]{8,})/i);
  return m ? `agent-${m[1]}` : 'agent-shared';
}
const USER_ID = agentUserId();

// --- Tex client (token cached in-process) ---------------------------------
let token = null;
let tokenExp = 0;
async function getToken() {
  if (token && Date.now() < tokenExp - 60_000) return token;
  const res = await fetch(`${TEX_URL}/auth/token-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: TEX_KEY }),
  });
  if (!res.ok) throw new Error(`token-exchange ${res.status}`);
  const j = await res.json();
  token = j.access_token;
  tokenExp = Date.now() + (j.expires_in ?? 86400) * 1000;
  return token;
}
function scope() {
  return { org_id: ORG_ID, user_id: USER_ID, session_id: SESSION };
}
function clean(text) {
  return String(text || '').replace(/^(?:\s*\[[^\]]*\])+\s*/, '').trim();
}
async function texRecall(query) {
  const t = await getToken();
  const res = await fetch(`${TEX_URL}/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ scope: scope(), q: String(query || ''), mode: 'active', top_k: 8 }),
  });
  if (!res.ok) throw new Error(`recall ${res.status}`);
  const j = await res.json();
  const turns = (j.hits && j.hits.turns) || [];
  const obs = (j.hits && j.hits.observations) || [];
  const lines = [...turns, ...obs].slice(0, 8).map((h) => `- ${clean(h.text)}`);
  if (!lines.length) return 'No relevant memories found.';
  const conf = typeof j.confidence === 'number' ? ` (confidence ${j.confidence.toFixed(2)})` : '';
  return `Recalled from memory${conf}:\n${lines.join('\n')}`;
}
async function texRemember(note) {
  const t = await getToken();
  const res = await fetch(`${TEX_URL}/ingestion/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      scope: scope(),
      turns: [{ role: 'assistant', text: String(note || ''), timestamp: new Date().toISOString() }],
      options: { write_active: true, write_passive: true },
    }),
  });
  return res.ok;
}

// --- MCP tools ------------------------------------------------------------
const TOOLS = [
  {
    name: 'recall_memory',
    description:
      'Recall relevant long-term memory (past decisions, facts, context) before acting. ' +
      'Use this whenever you need to remember anything from earlier work or other agents.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What you want to remember.' } },
      required: ['query'],
    },
  },
  {
    name: 'remember',
    description:
      'Persist a durable memory (a decision, fact, or lesson) to long-term memory so you and ' +
      'other agents can recall it later. Use after making a decision or learning something.',
    inputSchema: {
      type: 'object',
      properties: { note: { type: 'string', description: 'The thing to remember.' } },
      required: ['note'],
    },
  },
];

async function callTool(name, args) {
  try {
    if (name === 'recall_memory') return await texRecall(args && args.query);
    if (name === 'remember') return (await texRemember(args && args.note)) ? 'Saved to memory.' : 'Could not save to memory.';
    return `Unknown tool: ${name}`;
  } catch {
    // Memory must never break the agent — degrade to a calm message.
    return name === 'recall_memory' ? 'Memory is unavailable right now.' : 'Could not save to memory.';
  }
}

// --- MCP stdio transport (newline-delimited JSON-RPC 2.0) -----------------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}
async function handle(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'tex-memory', version: '0.1.0' },
      },
    });
    return;
  }
  if (method === 'notifications/initialized' || (method && method.startsWith('notifications/'))) return;
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }
  if (method === 'tools/call') {
    const text = await callTool(params && params.name, (params && params.arguments) || {});
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } });
    return;
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

let buf = '';
let inflight = 0;
let ended = false;
async function track(req) {
  inflight++;
  try {
    await handle(req);
  } finally {
    inflight--;
    if (ended && inflight === 0) process.exit(0);
  }
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      continue;
    }
    void track(req);
  }
});
// On EOF, exit only once any in-flight tool calls have drained.
process.stdin.on('end', () => {
  ended = true;
  if (inflight === 0) process.exit(0);
});
