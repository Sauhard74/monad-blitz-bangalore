import { azureChatJSON } from '@/lib/server/azure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The Atlas frontend runs in a sandboxed (null-origin) iframe, so its fetches
// are cross-origin — allow them explicitly.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

interface Itinerary {
  destination: string;
  pace: string;
  days: { title: string; where: string; stops: { time: string; emoji: string; title: string; note: string }[] }[];
  budget: { label: string; value: string }[];
  total: string;
  vibe: { emoji: string; label: string }[];
}

const SYSTEM = `You are Atlas, a tasteful travel planner. Given a free-text trip request, return a realistic, charming day-by-day plan as STRICT JSON, no prose.

Shape:
{
  "destination": "City, Country",
  "pace": "e.g. 5 days · gentle pace",
  "days": [
    { "title": "short evocative day title", "where": "neighborhood · short vibe",
      "stops": [ { "time": "9:30a", "emoji": "one fitting emoji", "title": "concrete place/activity", "note": "one warm sentence" } ] }
  ],
  "budget": [ { "label": "Stay · N nights", "value": "$520" }, { "label": "Food & coffee", "value": "$240" }, { "label": "Transit & entries", "value": "$95" } ],
  "total": "$855",
  "vibe": [ { "emoji": "☕", "label": "great coffee" } ]
}

Rules: 3-5 days, 2-3 stops each, real named places when you can, concrete and specific, warm but concise notes, currency in USD, 4 vibe tags. Match the requested vibe and pace.`;

/** Generate a real travel itinerary from a free-text prompt via gpt-5.5. */
export async function POST(req: Request): Promise<Response> {
  let prompt = '';
  try {
    prompt = String(((await req.json()) as { prompt?: string }).prompt ?? '').slice(0, 400);
  } catch {
    /* empty body */
  }
  if (!prompt.trim()) {
    return Response.json({ error: 'Tell Atlas about your trip.' }, { status: 400, headers: CORS });
  }

  try {
    const itinerary = await azureChatJSON<Itinerary>(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 3500 },
    );
    return Response.json(itinerary, { headers: CORS });
  } catch (e) {
    console.error('[atlas/plan]', e);
    return Response.json({ error: 'Atlas could not plan that trip right now.' }, { status: 502, headers: CORS });
  }
}
