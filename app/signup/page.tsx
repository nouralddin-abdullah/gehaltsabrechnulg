"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(
    signup,
    {},
  );
  return (
    <AuthForm
      title="Create your account"
      action={action}
      pending={pending}
      errors={state.errors}
      message={state.message}
      submitLabel="Sign up"
      fields={[
        { name: "username", label: "Username", autoComplete: "username" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
      footer={<Link href="/login">Already have an account? Log in</Link>}
    />
  );
}
