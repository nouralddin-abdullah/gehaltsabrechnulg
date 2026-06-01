import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export function Field({
  label,
  hint,
  example,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const tip = [hint, example ? `Example: ${example}` : ""].filter(Boolean).join(" ");
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        {label}
        {tip && <Tooltip text={tip} />}
      </span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
