'use client';

import { useEffect, useState } from 'react';
import { companyQuery } from '@/lib/data/activeCompany';

interface PreviewState {
  available: boolean;
  indexUrl?: string;
  files?: string[];
}

/** "Preview Product" — opens a full-screen view of the frontend the agents have
 *  built (iframed live), or, until one exists, the real source files in progress. */
export function ProductPreview() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/paperclip/preview${companyQuery()}`);
        const data = (await res.json()) as PreviewState;
        if (live) setState(data);
      } catch {
        if (live) setState({ available: false, files: [] });
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto whitespace-nowrap border-2 border-[#1f6f4a] bg-[#2f9d6a] px-3 py-2 text-[9px] leading-none text-[#04200f] shadow-[2px_2px_0_0_rgba(40,24,12,0.4)] transition-transform active:translate-y-px"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        ▶ PREVIEW PRODUCT
      </button>

      {open ? (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-[#06121d]">
          {/* title bar */}
          <div className="flex items-center justify-between border-b border-[#163243] px-4 py-2">
            <span
              className="flex items-center gap-2 text-[11px] tracking-widest text-[#46d9ff]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#7CFC98]" />
              LIVE PRODUCT PREVIEW
            </span>
            <button
              onClick={() => setOpen(false)}
              className="border-2 border-[#46d9ff] px-3 py-1 text-[10px] text-[#cfeefc] hover:bg-[#0e2a3a]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              CLOSE ✕
            </button>
          </div>

          {/* body */}
          <div className="relative flex-1 overflow-hidden bg-white">
            {loading && !state ? (
              <p className="p-6 text-[#063] " style={{ fontFamily: 'var(--font-pixel-body)' }}>
                Loading the build…
              </p>
            ) : state?.available && state.indexUrl ? (
              <iframe
                title="Built product"
                src={state.indexUrl}
                className="h-full w-full border-0 bg-white"
                /* No allow-same-origin: the built frontend is agent-authored, so
                   it runs in a null origin and cannot reach the office's DOM. */
                sandbox="allow-scripts allow-forms allow-popups"
              />
            ) : (
              <div
                className="flex h-full flex-col gap-2 overflow-y-auto bg-[#06121d] p-6 text-[#bfe4f5]"
                style={{ fontFamily: 'var(--font-pixel-body)' }}
              >
                <p className="text-[18px] text-[#ffd35c]">
                  No built frontend yet — but the team is writing real code:
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-[14px]">
                  {(state?.files ?? []).map((f) => (
                    <li key={f} className="text-[#9fc4d8]">
                      › {f}
                    </li>
                  ))}
                  {!state?.files?.length && <li className="text-[#5f86a0]">No source files found yet.</li>}
                </ul>
                <p className="mt-2 text-[13px] text-[#5f86a0]">
                  The preview turns live the moment they build the frontend (a dist/ or index.html).
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
