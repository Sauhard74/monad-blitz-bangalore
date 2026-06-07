import 'server-only';

/**
 * Server-only Paperclip client. Reads credentials from env and talks to a
 * self-hosted Paperclip instance (REST + WebSocket). The agent API key never
 * leaves the server — the browser talks to our own `/api/paperclip/*` routes.
 *
 * See docs/plans/2026-06-06-paperclip-model.md for the full model.
 */
export interface PaperclipConfig {
  /** e.g. http://paperclip:3100/api (internal) */
  apiUrl: string;
  /** Long-lived agent API key (omit in local_trusted mode). */
  apiKey?: string;
  /** Target company id (resolved lazily if not set). */
  companyId?: string;
}

export function getPaperclipConfig(): PaperclipConfig | null {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  if (!apiUrl) return null;
  return {
    apiUrl: apiUrl.replace(/\/$/, ''),
    apiKey: process.env.PAPERCLIP_API_KEY || undefined,
    companyId: process.env.PAPERCLIP_COMPANY_ID || undefined,
  };
}

export function isPaperclipConfigured(): boolean {
  return getPaperclipConfig() !== null;
}

/**
 * Config for reading ANY company — uses the board key (instance-admin) which has
 * access across companies, so the office can switch between provisioned companies.
 * Falls back to the single agent key when no board key is set.
 */
export function getBoardConfig(companyId?: string): PaperclipConfig | null {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  const board = process.env.PAPERCLIP_BOARD_KEY || process.env.PAPERCLIP_API_KEY;
  if (!apiUrl || !board) return null;
  return {
    apiUrl: apiUrl.replace(/\/$/, ''),
    apiKey: board,
    companyId: companyId || process.env.PAPERCLIP_COMPANY_ID || undefined,
  };
}

/** The active company id for a request: explicit `?company=` wins, else env. */
export function activeCompanyId(req: Request): string | undefined {
  const fromQuery = new URL(req.url).searchParams.get('company');
  return fromQuery || process.env.PAPERCLIP_COMPANY_ID || undefined;
}

function authHeaders(cfg: PaperclipConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  return h;
}

/** Authenticated REST fetch against Paperclip. Throws on non-2xx. */
export async function pcFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  cfg: PaperclipConfig = getPaperclipConfig()!,
): Promise<T> {
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    ...init,
    headers: { ...authHeaders(cfg), ...(init.headers as Record<string, string>) },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Paperclip ${init.method ?? 'GET'} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Resolve the target company id (env override, else the first company). */
export async function resolveCompanyId(cfg = getPaperclipConfig()!): Promise<string> {
  if (cfg.companyId) return cfg.companyId;
  const companies = await pcFetch<{ id: string }[]>('/companies', {}, cfg);
  const first = companies[0]?.id;
  if (!first) throw new Error('Paperclip has no companies — create one first.');
  return first;
}

/** Build the WebSocket URL for a company's live-events stream. */
export function companyWsUrl(cfg: PaperclipConfig, companyId: string): string {
  const ws = cfg.apiUrl.replace(/^http/, 'ws');
  const q = cfg.apiKey ? `?token=${encodeURIComponent(cfg.apiKey)}` : '';
  return `${ws}/companies/${companyId}/events/ws${q}`;
}

// --- Raw Paperclip entity shapes we read (subset of the real schema) --------

export interface PcAgent {
  id: string;
  name: string;
  role: string;
  title?: string;
  status: string;
  reportsTo?: string | null;
  icon?: string;
}

export interface PcOrgNode extends PcAgent {
  reports?: PcOrgNode[];
}

/** Flatten the org tree into a list, preserving reportsTo edges. */
export function flattenOrg(node: PcOrgNode | PcOrgNode[] | null | undefined): PcAgent[] {
  if (!node) return [];
  const nodes = Array.isArray(node) ? node : [node];
  const out: PcAgent[] = [];
  const walk = (n: PcOrgNode, parent?: string) => {
    out.push({ ...n, reportsTo: n.reportsTo ?? parent ?? null });
    for (const child of n.reports ?? []) walk(child, n.id);
  };
  nodes.forEach((n) => walk(n));
  return out;
}

export async function fetchAgents(companyId: string, cfg = getPaperclipConfig()!): Promise<PcAgent[]> {
  // Prefer the org tree (has reporting lines); fall back to the flat list.
  try {
    const org = await pcFetch<PcOrgNode | PcOrgNode[]>(`/companies/${companyId}/org`, {}, cfg);
    const flat = flattenOrg(org);
    if (flat.length) return flat;
  } catch {
    // fall through
  }
  return pcFetch<PcAgent[]>(`/companies/${companyId}/agents`, {}, cfg);
}

/** Create a goal + a top-level issue from a brief (used by "start project"). */
export async function createProject(
  companyId: string,
  brief: string,
  assigneeAgentId?: string,
  cfg = getPaperclipConfig()!,
): Promise<{ goalId?: string; issueId?: string }> {
  let goalId: string | undefined;
  try {
    const goal = await pcFetch<{ id: string }>(
      `/companies/${companyId}/goals`,
      { method: 'POST', body: JSON.stringify({ title: brief, level: 'company', status: 'active' }) },
      cfg,
    );
    goalId = goal.id;
  } catch {
    // goals are optional
  }
  const issue = await pcFetch<{ id: string }>(
    `/companies/${companyId}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: brief,
        status: 'todo',
        priority: 'high',
        goalId,
        assigneeAgentId,
      }),
    },
    cfg,
  );
  return { goalId, issueId: issue.id };
}
