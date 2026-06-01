"use client";

import { useState } from "react";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 text-[10px] leading-none text-zinc-400 hover:border-indigo-400 hover:text-indigo-300"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-5 top-0 z-10 w-60 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
