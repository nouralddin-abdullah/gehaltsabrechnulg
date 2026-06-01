"use client";

import { useEffect, useRef } from "react";
import type { SlipState } from "@/lib/slip-state";
import type { ComputedTotals } from "@/lib/db/types";

// Parse a German-formatted number string ("2.855,29") to a number.
function parseDE(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

// Reads the template's own computed figures back out of the rendered (same-origin)
// iframe DOM. The template owns all math; we only copy the cells it produced. We
// read the DOM rather than the template's JS `state` because that variable is a
// module-local `const`, not exposed on the iframe window.
function captureComputed(win: Window): ComputedTotals | null {
  const doc = win.document;
  if (!doc.getElementById("gesamtBruttoCell")) return null; // not rendered yet
  const cell = (id: string) => parseDE(doc.getElementById(id)?.textContent);
  return {
    gesamtBrutto: cell("gesamtBruttoCell"),
    steuerBrutto: cell("vSteuerBrutto"),
    svBrutto: cell("vSvBrutto"),
    lohnsteuer: cell("vLohnsteuer"),
    kirchensteuer: cell("vKirchensteuer"),
    soli: cell("vSoli"),
    kvBeitrag: cell("vKvBeitrag"),
    rvBeitrag: cell("vRvBeitrag"),
    avBeitrag: cell("vAvBeitrag"),
    pvBeitrag: cell("vPvBeitrag"),
    auszahlung: cell("fAuszahlung"),
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
