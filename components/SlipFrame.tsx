"use client";

import { useEffect, useRef } from "react";
import type { SlipState } from "@/lib/slip-state";

export function SlipFrame({
  templateFile,
  state,
}: {
  templateFile: string;
  state: SlipState;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  // Post the state whenever the frame is (re)loaded or the state changes.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const post = () => {
      iframe.contentWindow?.postMessage({ type: "setState", state }, "*");
    };
    iframe.addEventListener("load", post);
    // If it already loaded before this effect ran, post immediately.
    if (iframe.contentWindow) post();

    return () => iframe.removeEventListener("load", post);
  }, [state, templateFile]);

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
