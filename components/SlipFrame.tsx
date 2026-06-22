"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { SlipState } from "@/lib/slip-state";
import type { ComputedTotals } from "@/lib/db/types";

export type SlipFrameHandle = { print: () => void };

// Parse a German-formatted number string ("2.855,29") to a number.
function parseDE(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

// Reads the template's own computed figures back out of the rendered (same-origin)
// iframe DOM. The template owns all math; we only copy the cells it produced.
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

const GUARD_STYLE_ID = "__credit_guard_style";
const GUARD_MARK_ID = "__credit_guard_mark";

// In preview mode we (a) make printing the frame produce a blank page, and
// (b) tile a "VORSCHAU" watermark over it. A clean, printable copy only appears
// after a credit has been spent (mode === "print"). The iframe is same-origin so
// the parent can inject directly into its document.
function applyGuard(win: Window, preview: boolean) {
  const doc = win.document;
  if (!doc || !doc.body) return;
  const existingStyle = doc.getElementById(GUARD_STYLE_ID);
  const existingMark = doc.getElementById(GUARD_MARK_ID);

  if (!preview) {
    existingStyle?.remove();
    existingMark?.remove();
    return;
  }

  if (!existingStyle) {
    const style = doc.createElement("style");
    style.id = GUARD_STYLE_ID;
    style.textContent = "@media print { html, body { display: none !important; } }";
    doc.head.appendChild(style);
  }
  if (!existingMark) {
    const mark = doc.createElement("div");
    mark.id = GUARD_MARK_ID;
    mark.setAttribute(
      "style",
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;" +
        "display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:70px;" +
        "transform:rotate(-28deg) scale(1.4);transform-origin:center;",
    );
    for (let i = 0; i < 28; i++) {
      const span = doc.createElement("span");
      span.textContent = "VORSCHAU";
      span.setAttribute(
        "style",
        "font:700 30px/1 Arial,Helvetica,sans-serif;letter-spacing:.18em;" +
          "color:rgba(190,30,30,.13);white-space:nowrap;",
      );
      mark.appendChild(span);
    }
    doc.body.appendChild(mark);
  }
}

export const SlipFrame = forwardRef<
  SlipFrameHandle,
  {
    templateFile: string;
    state: SlipState;
    mode?: "preview" | "print";
    onComputed?: (totals: ComputedTotals) => void;
  }
>(function SlipFrame(
  { templateFile, state, mode = "print", onComputed },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      print: () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        // Belt and braces: only ever print a clean (non-preview) document.
        applyGuard(win, mode === "preview");
        if (mode === "print") win.print();
      },
    }),
    [mode],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const post = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.postMessage({ type: "setState", state }, "*");
      // let the template handle the message + render, then guard + read back
      setTimeout(() => {
        try {
          applyGuard(win, mode === "preview");
          if (onComputed) {
            const totals = captureComputed(win);
            if (totals) onComputed(totals);
          }
        } catch {
          /* cross-origin or not-ready: ignore */
        }
      }, 120);
    };
    iframe.addEventListener("load", post);
    if (iframe.contentWindow) post();
    return () => iframe.removeEventListener("load", post);
  }, [state, templateFile, mode, onComputed]);

  return (
    <iframe
      ref={iframeRef}
      title="slip"
      src={`/templates/${templateFile}`}
      // print:hidden stops a stray Ctrl+P on the app page from printing the slip;
      // legitimate printing goes through the iframe's own print() (mode "print").
      className="h-[297mm] w-[210mm] border border-zinc-200 bg-white shadow-sm print:hidden"
    />
  );
});
