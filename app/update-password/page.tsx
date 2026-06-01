"use client";

import { useActionState } from "react";
import { updatePassword, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function UpdatePasswordPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(
    updatePassword,
    {},
  );
  return (
    <AuthForm
      title="Set a new password"
      action={action}
      pending={pending}
      errors={state.errors}
      message={state.message}
      submitLabel="Update password"
      fields={[
        {
          name: "password",
          label: "New password",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
    />
  );
}
