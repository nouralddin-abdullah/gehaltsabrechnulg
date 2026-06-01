"use client";

import { useEffect, useRef } from "react";
import type { SlipState } from "@/lib/slip-state";
import type { ComputedTotals } from "@/lib/db/types";

// Reads the template's own computed figures from the same-origin iframe window.
// The template owns all math; we only copy what it produced.
function captureComputed(win: Window): ComputedTotals | null {
  const w = win as unknown as {
    state?: SlipState;
    computeTotals?: (s: unknown) => { gesamtBrutto: number; auszahlungsbetrag: number };
    sumSteuerBrutto?: (b: unknown) => number;
    sumSVBrutto?: (b: unknown) => number;
    parseDE?: (s: string | undefined) => number | null;
  };
  if (!w.state || !w.computeTotals || !w.sumSteuerBrutto || !w.sumSVBrutto || !w.parseDE) {
    return null;
  }
  const s = w.state;
  const t = w.computeTotals(s);
  const st = (s.steuer && s.steuer[0]) || {};
  const sv = (s.sv && s.sv[0]) || {};
  const num = (v: string | undefined) => w.parseDE!(v) || 0;
  return {
    gesamtBrutto: t.gesamtBrutto,
    steuerBrutto: w.sumSteuerBrutto(s.brutto || []),
    svBrutto: w.sumSVBrutto(s.brutto || []),
    lohnsteuer: num(st.lohnsteuer),
    kirchensteuer: num(st.kirchensteuer),
    soli: num(st.soli),
    kvBeitrag: num(sv.kvBeitrag),
    rvBeitrag: num(sv.rvBeitrag),
    avBeitrag: num(sv.avBeitrag),
    pvBeitrag: num(sv.pvBeitrag),
    auszahlung: t.auszahlungsbetrag,
  };
}

export function SlipFrame({
  templateFile,
  state,
  onComputed,
}: {
  templateFile: string;
  state: SlipState;
  onComputed?: (totals: ComputedTotals) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const post = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.postMessage({ type: "setState", state }, "*");
      if (onComputed) {
        // let the template handle the message + render, then read it back
        setTimeout(() => {
          try {
            const totals = captureComputed(win);
            if (totals) onComputed(totals);
          } catch {
            /* cross-origin or not-ready: ignore */
          }
        }, 120);
      }
    };
    iframe.addEventListener("load", post);
    if (iframe.contentWindow) post();
    return () => iframe.removeEventListener("load", post);
  }, [state, templateFile, onComputed]);

  const print = () => ref.current?.contentWindow?.print();

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={print}
        className="self-end rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900"
      >
        Print / PDF
      </button>
      <iframe
        ref={ref}
        title="slip"
        src={`/templates/${templateFile}`}
        className="h-[297mm] w-[210mm] border border-neutral-700 bg-white"
      />
    </div>
  );
}
