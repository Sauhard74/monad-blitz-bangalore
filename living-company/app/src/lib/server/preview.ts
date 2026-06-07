import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { fetchAgents, getBoardConfig } from '@/lib/server/paperclip';

/**
 * Locates the frontend a company's agents have built, inside the read-only
 * mount of their workspaces, so the office can preview the actual product.
 * Prefers a built static output (dist/build/out), then any index.html.
 */

const ROOT = process.env.PAPERCLIP_WORKSPACES_DIR || '/paperclip-ro/instances/default/workspaces';
// Where a built/serveable index.html tends to live, best first.
const CANDIDATE_SUBDIRS = ['dist', 'build', 'out', 'public', '.'];

export interface FrontendHit {
  /** Absolute dir that contains index.html (the static root to serve). */
  dir: string;
  /** mtime (ms) of the index — newest wins. */
  mtime: number;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function exists(p: string): Promise<number | null> {
  try {
    const st = await fs.stat(p);
    return st.isFile() ? st.mtimeMs : null;
  } catch {
    return null;
  }
}

/** Directory names of all workspaces belonging to this company's agents. */
async function companyWorkspaceDirs(companyId: string): Promise<string[]> {
  const board = getBoardConfig(companyId);
  if (!board) return [];
  try {
    const agents = await fetchAgents(companyId, board);
    return agents.map((a) => path.join(ROOT, a.id));
  } catch {
    return [];
  }
}

/** Find the best index.html to serve for the company, or null. */
export async function resolveFrontend(companyId: string): Promise<FrontendHit | null> {
  const dirs = await companyWorkspaceDirs(companyId);
  let best: FrontendHit | null = null;

  for (const ws of dirs) {
    if (!isInside(ROOT, ws)) continue;
    for (const sub of CANDIDATE_SUBDIRS) {
      const dir = path.resolve(ws, sub);
      if (!isInside(ROOT, dir)) continue;
      const mtime = await exists(path.join(dir, 'index.html'));
      if (mtime != null && (!best || mtime > best.mtime)) best = { dir, mtime };
    }
  }
  return best;
}

/** Safely resolve a request path against a served frontend dir (no traversal). */
export function safeFile(dir: string, rel: string): string | null {
  const target = path.resolve(dir, '.' + path.posix.normalize('/' + rel));
  return isInside(dir, target) || target === dir ? target : null;
}

/** A shallow listing of source files (for the code fallback view). */
export async function listSource(companyId: string, limit = 40): Promise<string[]> {
  const dirs = await companyWorkspaceDirs(companyId);
  const out: string[] = [];
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next']);
  for (const ws of dirs) {
    const stack: string[] = [ws];
    while (stack.length && out.length < limit) {
      const cur = stack.pop()!;
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (SKIP.has(e.name)) continue;
        const full = path.join(cur, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (/\.(tsx?|jsx?|html|css|json|md)$/.test(e.name)) {
          out.push(path.relative(ROOT, full));
          if (out.length >= limit) break;
        }
      }
    }
  }
  return out;
}
