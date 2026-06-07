#!/usr/bin/env node
// Standalone stdio MCP server exposing Tex memory to Paperclip's local agents
// (claude_local / codex_local). It forwards two tools to the Living-Company
// app's HTTP memory routes — the Tex API key lives in the app, not here.
//
// Tools:
//   recall_memory({ query })  -> GET-like recall, returns a text summary of hits
//   remember({ note })        -> persists a note, returns a short confirmation
//
// Memory must NEVER break the agent: every handler fully try/catches and
// degrades to a calm text message when the app or Tex is unreachable.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const LC_BASE_URL = (process.env.LC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const AGENT_ID = process.env.AGENT_ID || 'unknown';
const COMPANY_ID = process.env.COMPANY_ID || undefined;
const PROJECT_ID = process.env.PROJECT_ID || undefined;

/** Strip leading `[...]` bracket prefixes (e.g. `[Date: …] [role]`). */
function cleanSnippet(text) {
  if (!text) return '';
  return text.replace(/^(?:\s*\[[^\]]*\])+\s*/, '').trim();
}

/** POST JSON to an app memory route. Throws on network / non-ok. */
async function postJson(path, body) {
  const res = await fetch(`${LC_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

const server = new McpServer({ name: 'tex-memory', version: '0.1.0' });

server.registerTool(
  'recall_memory',
  {
    description:
      'Recall relevant facts from your long-term memory (Tex). Use before answering ' +
      'when prior context, decisions, or who-did-what might matter.',
    inputSchema: { query: z.string().describe('What you want to remember about') },
  },
  async ({ query }) => {
    try {
      const data = await postJson('/api/memory/recall', {
        q: query,
        agentId: AGENT_ID,
        projectId: PROJECT_ID,
        companyId: COMPANY_ID,
      });
      const turns = Array.isArray(data?.turns) ? data.turns : [];
      if (!data?.topSnippet && turns.length === 0) {
        return textResult('No relevant memories found.');
      }
      const lines = [];
      if (data.topSnippet) lines.push(cleanSnippet(data.topSnippet));
      const hits = turns
        .slice(0, 5)
        .map((t) => cleanSnippet(t?.text ?? ''))
        .filter(Boolean);
      if (hits.length) {
        lines.push('');
        for (const h of hits) lines.push(`- ${h}`);
      }
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
      lines.push('');
      lines.push(`(confidence: ${confidence.toFixed(2)})`);
      return textResult(lines.join('\n'));
    } catch {
      return textResult('Memory is unavailable right now.');
    }
  },
);

server.registerTool(
  'remember',
  {
    description:
      'Save a durable note to your long-term memory (Tex) so future-you and ' +
      'teammates can recall it. Use for decisions, facts, and outcomes worth keeping.',
    inputSchema: { note: z.string().describe('The fact or note to remember') },
  },
  async ({ note }) => {
    try {
      const data = await postJson('/api/memory/remember', {
        text: note,
        agentId: AGENT_ID,
        projectId: PROJECT_ID,
        companyId: COMPANY_ID,
      });
      return textResult(data?.ok ? 'Saved to memory.' : 'Could not save to memory.');
    } catch {
      return textResult('Could not save to memory.');
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
