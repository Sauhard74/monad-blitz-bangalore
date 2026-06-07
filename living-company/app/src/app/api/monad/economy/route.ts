import { getEconomy, isMonadConfigured } from '@/lib/server/monad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The live on-chain agent economy (treasury + per-agent MON earnings) for the
 *  office's Monad panel. Read straight from the AgentPayroll contract. */
export async function GET(): Promise<Response> {
  if (!isMonadConfigured()) return Response.json({ configured: false });
  try {
    const eco = await getEconomy();
    return Response.json({ configured: true, ...eco });
  } catch (e) {
    console.error('[monad/economy]', e);
    return Response.json({ configured: false });
  }
}
