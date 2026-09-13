import { Fragment, type CSSProperties, type ReactNode } from "react";

// Renders editor-written copy without ever injecting HTML. The admin's rich
// textareas understand three things: a blank line starts a new paragraph,
// **double asterisks** make bold, *single asterisks* make italic. Any other
// line break is kept as a <br />. Plain JSX, no hooks — usable from server and
// client components alike.

type InlineStyles = {
  strong?: CSSProperties;
  strongClassName?: string;
};

const TOKEN = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|\n)/g;

/** Inline markup for one run of text: bold, italic and line breaks. */
export function inline(text: string, styles: InlineStyles = {}): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part === "\n") return <br key={i} />;
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className={styles.strongClassName} style={styles.strong}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Splits copy into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** One <p> per paragraph, each with inline markup applied. */
export function RichText({
  text,
  className,
  style,
  ...styles
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
} & InlineStyles) {
  return (
    <>
      {paragraphs(text).map((p, i) => (
        <p key={i} className={className} style={style}>
          {inline(p, styles)}
        </p>
      ))}
    </>
  );
}
