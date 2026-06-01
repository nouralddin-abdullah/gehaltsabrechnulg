"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(
    login,
    {},
  );
  return (
    <AuthForm
      title="Log in"
      action={action}
      pending={pending}
      errors={state.errors}
      message={state.message}
      submitLabel="Log in"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "current-password",
        },
      ]}
      footer={
        <div className="flex justify-between">
          <Link href="/signup">Create account</Link>
          <Link href="/reset">Forgot password?</Link>
        </div>
      }
    />
  );
}
