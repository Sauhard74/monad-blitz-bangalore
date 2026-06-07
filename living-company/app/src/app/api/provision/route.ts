import { provisionCompany } from '@/lib/server/provisioner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stand up a brand-new company from a name + idea (board-key driven). Privileged:
 * it mints a Tex org and spawns brained agents, so it's gated behind
 * `PROVISION_SECRET` — disabled entirely until that env is set. The caller passes
 * the secret in `x-provision-secret` (the onboarding form prompts the operator for
 * it; we don't embed it in the client bundle).
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.PROVISION_SECRET;
  if (!secret) {
    return Response.json({ error: 'provisioning is disabled (no PROVISION_SECRET)' }, { status: 403 });
  }
  if (req.headers.get('x-provision-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { name?: string; idea?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.name?.trim() || !body.idea?.trim()) {
    return Response.json({ error: 'name and idea are required' }, { status: 400 });
  }
  try {
    const result = await provisionCompany({ name: body.name, idea: body.idea });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
