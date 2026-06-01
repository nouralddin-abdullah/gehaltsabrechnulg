"use client";

import type { FieldErrors } from "@/lib/auth/validation";

export type Field = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
};

export function AuthForm({
  title,
  fields,
  action,
  pending,
  errors,
  message,
  submitLabel,
  footer,
}: {
  title: string;
  fields: Field[];
  action: (formData: FormData) => void;
  pending: boolean;
  errors?: FieldErrors;
  message?: string;
  submitLabel: string;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold text-neutral-100">{title}</h1>
      <form action={action} className="flex flex-col gap-4">
        {fields.map((f) => (
          <label
            key={f.name}
            className="flex flex-col gap-1 text-sm text-neutral-300"
          >
            {f.label}
            <input
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-400"
            />
            {errors?.[f.name] && (
              <span className="text-xs text-red-400">{errors[f.name]}</span>
            )}
          </label>
        ))}
        {message && <p className="text-sm text-red-400">{message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-100 px-3 py-2 font-medium text-neutral-900 disabled:opacity-50"
        >
          {pending ? "…" : submitLabel}
        </button>
      </form>
      {footer && <div className="text-sm text-neutral-400">{footer}</div>}
    </main>
  );
}
