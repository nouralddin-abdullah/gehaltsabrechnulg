"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function ResetPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(
    requestReset,
    {},
  );
  return (
    <AuthForm
      title="Reset password"
      action={action}
      pending={pending}
      errors={state.errors}
      message={state.message}
      submitLabel="Send reset link"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
      ]}
      footer={<Link href="/login">Back to login</Link>}
    />
  );
}
