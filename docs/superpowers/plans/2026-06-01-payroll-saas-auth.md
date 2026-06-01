# Payroll SaaS — Plan 2: Auth & Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase email/password accounts with a per-user `profiles` row (username), Row-Level Security, route protection via middleware, and signup/login/logout/password-reset flows — so the app has a real login wall every later feature sits behind.

**Architecture:** Supabase (hosted Postgres + Auth) accessed through `@supabase/ssr` cookie-based clients (browser + server + middleware). A Postgres trigger auto-creates a `profiles` row on signup; RLS restricts each row to its owner. Next.js middleware refreshes the session and redirects unauthenticated users away from protected routes. Auth UIs are custom React forms using React 19 server actions + `useActionState`.

**Tech Stack:** Next.js 15 · React 19 · `@supabase/ssr` · `@supabase/supabase-js` · Postgres (Supabase) · Vitest · Playwright.

**Spec:** `docs/superpowers/specs/2026-06-01-payroll-saas-design.md` (§ Accounts & multi-tenancy)

**Prerequisite (you, the human):** a Supabase project. Task 1 walks through creating it and pasting two keys into `.env.local`. Nothing else in this plan can be verified until that exists.

---

## File Structure (created in this plan)

```
.env.local                                # Supabase URL + anon key (gitignored)
.env.example                              # documents required env vars (committed)
lib/supabase/client.ts                    # browser client (createBrowserClient)
lib/supabase/server.ts                    # server client (cookies-based)
lib/supabase/middleware.ts                # updateSession() — refresh + route guard
middleware.ts                             # Next middleware entrypoint + matcher
lib/auth/validation.ts                    # pure signup/login field validation
supabase/migrations/0001_profiles.sql     # profiles table + RLS + trigger
app/auth/actions.ts                       # server actions: signup, login, logout, reset, updatePassword
app/login/page.tsx                        # login form
app/signup/page.tsx                       # signup form
app/reset/page.tsx                        # request password reset
app/update-password/page.tsx              # set a new password (from email link)
app/dashboard/page.tsx                    # protected placeholder showing the username
components/AuthForm.tsx                    # shared form shell (fields + error display)
tests/unit/auth-validation.test.ts        # validation unit tests
tests/e2e/auth.spec.ts                    # route-protection + (optional) signup happy path
```

`.gitignore` gains `.env*.local`.

---

### Task 1: Supabase project + client wiring

**Files:**
- Create: `.env.local`, `.env.example`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create the Supabase project (human action)**

1. Go to https://supabase.com → sign in → **New project**. Pick a name (e.g. `gehaltsabrechnung`), a strong database password (save it), and a region near you. Wait ~2 min for provisioning.
2. In the project: **Project Settings → API**. Copy:
   - **Project URL** (e.g. `https://abcdxyz.supabase.co`)
   - **anon / public** key (a long JWT, or a `sb_publishable_...` key)
3. **Authentication → Sign In / Providers → Email**: turn **"Confirm email" OFF** (v1 lets users log in immediately). Save.

- [ ] **Step 2: Add env files**

`.env.local` (fill in your two values — this file is gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY
```

`.env.example` (committed, documents the contract — no real values):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Add to `.gitignore` (append):
```
# Local env
.env*.local
```

- [ ] **Step 3: Install Supabase packages**

Run:
```bash
npm install @supabase/ssr @supabase/supabase-js
```
Expected: two packages added, no errors.

- [ ] **Step 4: Browser client**

`lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 5: Server client** (Next 15 `cookies()` is async)

`lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 6: Middleware session refresh + route guard**

`lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/reset",
  "/update-password",
  "/demo",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path);
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}
```

`middleware.ts` (project root):
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip Next internals and static files (incl. /templates/*.html).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:html|png|jpg|jpeg|svg|ico|json)$).*)",
  ],
};
```

- [ ] **Step 7: Verify build compiles**

Run: `npm run build`
Expected: `✓ Compiled successfully`. (Auth routes don't exist yet; that's fine.)

- [ ] **Step 8: Commit** (`.env.local` must NOT be committed — confirm with `git status`)

```bash
git add .env.example .gitignore lib/supabase package.json package-lock.json middleware.ts
git status   # verify .env.local is untracked/ignored
git commit -m "feat: wire Supabase clients + session middleware"
```

---

### Task 2: Database — profiles, RLS, signup trigger

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_profiles.sql`:
```sql
-- One profile row per auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each user may read and update only their own profile.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create the profile when a new auth user signs up.
-- SECURITY DEFINER so the insert bypasses RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Apply it (human action)**

In the Supabase dashboard → **SQL Editor** → **New query** → paste the entire file → **Run**.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verify schema + policies**

In the SQL Editor run:
```sql
select tablename, rowsecurity from pg_tables where tablename = 'profiles';
select polname from pg_policies where tablename = 'profiles';
```
Expected: `profiles` with `rowsecurity = true`; two policies `profiles_select_own`, `profiles_update_own`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat: profiles table with RLS and signup trigger"
```

---

### Task 3: Signup, login, logout + protected dashboard

**Files:**
- Create: `lib/auth/validation.ts`, `app/auth/actions.ts`, `components/AuthForm.tsx`, `app/signup/page.tsx`, `app/login/page.tsx`, `app/dashboard/page.tsx`
- Test: `tests/unit/auth-validation.test.ts`, `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Write the failing validation test**

`tests/unit/auth-validation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateSignup, validateLogin } from "@/lib/auth/validation";

describe("validateSignup", () => {
  it("accepts valid input", () => {
    expect(
      validateSignup({ username: "maxm", email: "max@acme.de", password: "supersecret" }),
    ).toEqual({});
  });
  it("rejects short username, bad email, short password", () => {
    const e = validateSignup({ username: "ab", email: "nope", password: "short" });
    expect(e.username).toBeTruthy();
    expect(e.email).toBeTruthy();
    expect(e.password).toBeTruthy();
  });
});

describe("validateLogin", () => {
  it("requires an email and a password", () => {
    const e = validateLogin({ email: "", password: "" });
    expect(e.email).toBeTruthy();
    expect(e.password).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test`
Expected: FAIL — `@/lib/auth/validation` does not exist.

- [ ] **Step 3: Implement the validation**

`lib/auth/validation.ts`:
```typescript
export type FieldErrors = Record<string, string>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateSignup(input: {
  username: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.username.trim().length < 3)
    errors.username = "Username must be at least 3 characters.";
  if (!EMAIL.test(input.email))
    errors.email = "Enter a valid email address.";
  if (input.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  return errors;
}

export function validateLogin(input: {
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.email) errors.email = "Email is required.";
  if (!input.password) errors.password = "Password is required.";
  return errors;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — validation tests green (plus the earlier 7 from Plan 1).

- [ ] **Step 5: Write the server actions**

`app/auth/actions.ts`:
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { validateSignup, validateLogin, type FieldErrors } from "@/lib/auth/validation";

export type AuthResult = { errors?: FieldErrors; message?: string };

export async function signup(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const username = String(formData.get("username") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const errors = validateSignup({ username, email, password });
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) return { message: error.message };
  redirect("/dashboard");
}

export async function login(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: "Invalid email or password." };
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 6: Shared form shell**

`components/AuthForm.tsx`:
```tsx
"use client";

import Link from "next/link";
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
          <label key={f.name} className="flex flex-col gap-1 text-sm text-neutral-300">
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
```

- [ ] **Step 7: Signup + login pages**

`app/signup/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(signup, {});
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
        { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
      ]}
      footer={<Link href="/login">Already have an account? Log in</Link>}
    />
  );
}
```

`app/login/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(login, {});
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
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
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
```

- [ ] **Step 8: Protected dashboard placeholder**

`app/dashboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold text-neutral-100">Dashboard</h1>
      <p className="mt-2 text-neutral-400">
        Signed in as{" "}
        <span className="text-neutral-200">{profile?.username ?? user.email}</span>
      </p>
      <form action={logout} className="mt-6">
        <button className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200">
          Log out
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 9: Write the route-protection E2E**

`tests/e2e/auth.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test("unauthenticated users are redirected from /dashboard to /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
```

- [ ] **Step 10: Run E2E (requires `.env.local` from Task 1)**

Run: `npm run test:e2e`
Expected: PASS — both this test and the Plan 1 demo test. (Middleware constructs a Supabase client from the env and, finding no session, redirects.)

- [ ] **Step 11: Manual verification (creates a real account)**

`npm run dev`, then:
1. Open `/signup`, register `username=tester`, a real-looking email, password ≥ 8 chars → you land on `/dashboard` showing "Signed in as tester".
2. In Supabase → **Table Editor → profiles**: a row exists with that username (proves the trigger).
3. Click **Log out** → back to `/login`. Log in with the same credentials → `/dashboard` again.

- [ ] **Step 12: Commit**

```bash
git add lib/auth app/auth app/signup app/login app/dashboard components/AuthForm.tsx tests/unit/auth-validation.test.ts tests/e2e/auth.spec.ts
git commit -m "feat: signup/login/logout with protected dashboard"
```

---

### Task 4: Password reset (request + set new password)

**Files:**
- Modify: `app/auth/actions.ts` (add `requestReset`, `updatePassword`)
- Create: `app/reset/page.tsx`, `app/update-password/page.tsx`

- [ ] **Step 1: Add reset server actions**

Append to `app/auth/actions.ts`:
```typescript
import { headers } from "next/headers";

export async function requestReset(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { errors: { email: "Email is required." } };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/update-password`,
  });
  if (error) return { message: error.message };
  return { message: "Check your email for a reset link." };
}

export async function updatePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return { errors: { password: "Password must be at least 8 characters." } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: error.message };
  redirect("/dashboard");
}
```

(`AuthResult`, `createClient`, `redirect` are already imported at the top of the file from Task 3.)

- [ ] **Step 2: Reset-request page**

`app/reset/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function ResetPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(requestReset, {});
  return (
    <AuthForm
      title="Reset password"
      action={action}
      pending={pending}
      errors={state.errors}
      message={state.message}
      submitLabel="Send reset link"
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      footer={<Link href="/login">Back to login</Link>}
    />
  );
}
```

- [ ] **Step 3: Update-password page**

`app/update-password/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { updatePassword, type AuthResult } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function UpdatePasswordPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(updatePassword, {});
  return (
    <AuthForm
      title="Set a new password"
      action={action}
      pending={pending}
      errors={state.errors}
      message={state.message}
      submitLabel="Update password"
      fields={[
        { name: "password", label: "New password", type: "password", autoComplete: "new-password" },
      ]}
    />
  );
}
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run build`
Expected: `✓ Compiled successfully`; routes include `/reset` and `/update-password`.

- [ ] **Step 5: Manual verification (uses Supabase's default email)**

`npm run dev`, open `/reset`, submit your test account's email → "Check your email…". Open the link from the email → `/update-password` → set a new password ≥ 8 chars → redirected to `/dashboard`. Log out and log in with the new password.
(Note: Supabase's built-in email is rate-limited; for production a custom SMTP is configured later. Not needed for v1 dev.)

- [ ] **Step 6: Commit**

```bash
git add app/auth/actions.ts app/reset app/update-password
git commit -m "feat: password reset request + update flow"
```

---

## Self-Review

**1. Spec coverage (§ Accounts & multi-tenancy):**
- "Supabase email + password; username is a profile field" → Task 2 (`profiles` + trigger reading `raw_user_meta_data.username`) + Task 3 (signup passes `options.data.username`). ✓
- "every table carries owner_id with RLS; users only see their own rows" → Task 2 establishes the RLS pattern on `profiles` (own-row select/update); later plans reuse it for companies/employees/payslips. ✓
- "password reset via Supabase email" → Task 4. ✓
- "email-verification gate OFF in v1 (log in immediately)" → Task 1 Step 1.3 turns off Confirm email; signup redirects straight to `/dashboard`. ✓
- Route protection (login wall) → Task 1 middleware + Task 3 dashboard guard + E2E. ✓

**2. Placeholder scan:** No TBD/TODO. Every code step is complete. The only human-action steps (create project, apply SQL, manual auth checks) are inherent to an external auth provider and each has exact instructions + expected results. Automated coverage: validation unit tests (Task 3) + route-protection E2E (Task 3); full signup/login/reset are verified manually because they create real accounts / send real emails.

**3. Type consistency:** `AuthResult` and `FieldErrors` are defined once (`app/auth/actions.ts` and `lib/auth/validation.ts`) and reused by every page and the `AuthForm` component. `createClient()` from `lib/supabase/server.ts` is async and always `await`ed (actions, dashboard, middleware helper uses the separate `createServerClient` directly). `validateSignup`/`validateLogin` signatures match their call sites and tests. The middleware `PUBLIC_PATHS` includes every auth route created (`/login`, `/signup`, `/reset`, `/update-password`) plus `/` and `/demo`.

**Note for later plans:** companies/employees/payslips tables repeat the `profiles` RLS pattern with `owner_id uuid not null references auth.users(id)` and `using (auth.uid() = owner_id)` policies; the serial counter uses a `SECURITY DEFINER` function like `handle_new_user` here.
