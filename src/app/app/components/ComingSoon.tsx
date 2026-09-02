import Link from "next/link";

export default function ComingSoon({
  title,
  subtitle,
  description,
  phase = "Phase 2",
}: {
  title: string;
  subtitle: string;
  description: string;
  phase?: string;
}) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6">
          <div
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            {subtitle}
          </div>
          <h2
            className="mt-2 text-[36px] font-semibold tracking-tight leading-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {title}
          </h2>
        </div>

        <div
          className="rounded-xl p-12"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px dashed var(--color-app-edge)",
          }}
        >
          <div className="mx-auto max-w-2xl text-center">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-copper-deep)",
              }}
            >
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--color-app-copper)" }}
              />
              {phase}
            </div>

            <h3
              className="mt-6 text-[30px] font-semibold tracking-tight leading-[1.05] sm:text-[40px]"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              Being fitted to{" "}
              <span style={{ fontStyle: "italic", color: "var(--color-app-copper-deep)" }}>
                the cabinet.
              </span>
            </h3>

            <p
              className="mx-auto mt-4 max-w-lg text-[15px] leading-7"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {description}
            </p>

            <Link
              href="/app"
              className="mt-7 inline-flex items-center gap-2 text-[13px] font-medium transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-copper-deep)",
              }}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
