import { promises as fs } from 'fs';
import path from 'path';
import { resolveFrontend, safeFile } from '@/lib/server/preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

// Short cache of each company's resolved static root (avoid re-scan per asset).
const dirCache = new Map<string, { dir: string; exp: number }>();

async function rootFor(company: string): Promise<string | null> {
  const cached = dirCache.get(company);
  // No Date.now in workflows, but this is a normal route — fine here.
  const now = Date.now();
  if (cached && cached.exp > now) return cached.dir;
  const hit = await resolveFrontend(company);
  if (!hit) return null;
  dirCache.set(company, { dir: hit.dir, exp: now + 15_000 });
  return hit.dir;
}

/** Serve a single static file from the company's built frontend. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ company: string; path: string[] }> },
): Promise<Response> {
  const { company, path: parts } = await ctx.params;
  const dir = await rootFor(company);
  if (!dir) return new Response('No preview available', { status: 404 });

  const rel = (parts ?? []).join('/') || 'index.html';
  const file = safeFile(dir, rel);
  if (!file) return new Response('Forbidden', { status: 403 });

  try {
    // Symlink guard: the agents own these files, so resolve real paths and
    // reject anything whose true location escapes the served dir (e.g. a
    // symlink pointing at /etc or the host secrets).
    const [realDir, realFile] = await Promise.all([fs.realpath(dir), fs.realpath(file)]);
    if (realFile !== realDir && !realFile.startsWith(realDir + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    const buf = await fs.readFile(realFile);
    const type = MIME[path.extname(realFile).toLowerCase()] ?? 'application/octet-stream';
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        // Treat the bytes as sandboxed even if loaded directly, and only let
        // our own office frame them.
        'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-popups; frame-ancestors 'self'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
