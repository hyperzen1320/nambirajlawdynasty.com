import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { getAdminState, UNREACHABLE_MESSAGE } from "@/cms/auth";
import SidebarNav from "./SidebarNav";
import SignOutButton from "./SignOutButton";

// Everything behind the login. Reading the session means reading cookies, so
// the shell renders inside <Suspense> — Cache Components requires request-time
// work to sit under a boundary; the fallback is what paints first.

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const state = await getAdminState();

  if (state.status === "signed-out") redirect("/admin/login");

  if (state.status === "unconfigured") {
    return (
      <Notice title="Supabase isn't connected">
        Set <Code>SUPABASE_URL</Code> and <Code>SUPABASE_PUBLISHABLE_KEY</Code> in the server
        environment and restart it. Until then the public site shows its built-in copy.
      </Notice>
    );
  }

  if (state.status === "unreachable") {
    return (
      <Notice
        title="Can't reach Supabase"
        action={
          // Navigating re-renders this shell, re-running the check.
          <Link
            href="/admin"
            className="inline-flex rounded-lg px-4 py-2 text-[13.5px] font-medium text-white"
            style={{ backgroundColor: "var(--color-admin-accent)" }}
          >
            Try again
          </Link>
        }
      >
        {UNREACHABLE_MESSAGE} You&rsquo;re still signed in.
      </Notice>
    );
  }

  if (state.status === "forbidden") {
    return (
      <Notice title="No editing access" action={<SignOutButton variant="button" />}>
        <strong>{state.email || "This account"}</strong> is signed in but isn&rsquo;t on the list of
        CMS editors. Ask the site owner to add it (see CMS.md → &ldquo;Add an editor&rdquo;).
      </Notice>
    );
  }

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside
        className="border-b lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r"
        style={{
          backgroundColor: "var(--color-admin-bg-sidebar)",
          borderColor: "var(--color-admin-border)",
        }}
      >
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Logo size={30} />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight">Nambiraj CMS</div>
            <div className="text-[12px]" style={{ color: "var(--color-admin-fg-soft)" }}>
              Website content
            </div>
          </div>
        </div>
        <SidebarNav />
        <div
          className="hidden border-t px-5 py-4 lg:block"
          style={{ borderColor: "var(--color-admin-border)" }}
        >
          <div className="truncate text-[12.5px]" style={{ color: "var(--color-admin-fg-muted)" }}>
            {state.user.email}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-[14px]" style={{ color: "var(--color-admin-fg-soft)" }}>
      Loading…
    </div>
  );
}

function Notice({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-xl border p-6"
        style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-border)" }}
      >
        <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] leading-6" style={{ color: "var(--color-admin-fg-muted)" }}>
          {children}
        </p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="rounded px-1 py-0.5 text-[12.5px]"
      style={{ backgroundColor: "var(--color-admin-bg-sidebar)", fontFamily: "var(--font-plex-mono), monospace" }}
    >
      {children}
    </code>
  );
}
