"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, null);

  const input =
    "mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] outline-none transition-shadow focus:ring-2 focus:ring-[var(--color-admin-accent-soft)] focus:border-[var(--color-admin-accent)] border-[var(--color-admin-border)]";

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-[13px] font-medium">
        Email
        <input name="email" type="email" autoComplete="username" required className={input} />
      </label>
      <label className="block text-[13px] font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </label>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-[13px]"
          style={{
            backgroundColor: "var(--color-admin-danger-soft)",
            color: "var(--color-admin-danger)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--color-admin-accent-hover)] disabled:cursor-wait disabled:opacity-70"
        style={{ backgroundColor: "var(--color-admin-accent)" }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
