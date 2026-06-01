"use client";

import type { FieldErrors } from "@/lib/auth/validation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
      <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{title}</h1>
      <form action={action} className="flex flex-col gap-4">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1.5 text-sm text-zinc-300">
            {f.label}
            <Input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} />
            {errors?.[f.name] && (
              <span className="text-xs text-red-400">{errors[f.name]}</span>
            )}
          </label>
        ))}
        {message && <p className="text-sm text-red-400">{message}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "…" : submitLabel}
        </Button>
      </form>
      {footer && <div className="text-sm text-zinc-400">{footer}</div>}
    </main>
  );
}
