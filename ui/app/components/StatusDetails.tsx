import React from "react";

/**
 * Parse Jira `Status details` content into structured entries.
 *
 * Jira `Status details` are written as a stack of dated notes:
 *   {{2026-04-27}} *Moved to CQ3*
 *   # Coverage dashboard is internal tooling.
 *   # Dock improvements minor, won't block pilots.
 *   {{2026-04-08}} *Engineering kick-off completed* ...
 *
 * Older entries also use the bare-date form (`2026-03-24 *Note*`).
 *
 * Returns entries sorted newest-first, each with its date, headline body line,
 * and any sub-bullet lines (those starting with `# `).
 */
export type StatusEntry = { date: string | null; head: string; bullets: string[] };

const DATE_RE = /(?:^|\n)\s*(?:\{\{(\d{4}-\d{2}-\d{2})\}\}|(\d{4}-\d{2}-\d{2}))\s+/g;

export function parseStatusDetails(raw: string): StatusEntry[] {
  if (!raw) return [];
  const text = stripJiraLinks(raw);
  const matches: { date: string; index: number; endHeader: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = DATE_RE.exec(text)) !== null) {
    matches.push({
      date: m[1] ?? m[2],
      index: m.index + (m[0].startsWith("\n") ? 1 : 0),
      endHeader: m.index + m[0].length,
    });
  }
  if (matches.length === 0) {
    // Undated content: treat whole thing as a single anonymous entry.
    return [{ date: null, head: text.trim(), bullets: [] }];
  }
  const entries: StatusEntry[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].endHeader;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const bullets: string[] = [];
    const headLines: string[] = [];
    for (const line of lines) {
      if (/^#\s+/.test(line)) bullets.push(line.replace(/^#\s+/, ""));
      else headLines.push(line);
    }
    entries.push({
      date: matches[i].date,
      head: headLines.join(" "),
      bullets,
    });
  }
  return entries;
}

/** Strip Jira-wiki `[url|label|smart-link]` markup down to the URL. */
function stripJiraLinks(t: string): string {
  return t.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
    const parts = inner.split("|");
    return parts[0];
  });
}

/** Inline renderer: turn URLs into links and `*x*` into bold. */
export function RichLine({ text }: { text: string }) {
  // Split first on bold tokens, then within each chunk on URLs.
  const boldRe = /\*([^*\n]+)\*/g;
  const urlRe = /(https?:\/\/[^\s)<>]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const pushText = (s: string) => {
    if (!s) return;
    const parts = s.split(urlRe);
    for (const p of parts) {
      if (urlRe.test(p)) {
        urlRe.lastIndex = 0;
        out.push(
          <a
            key={key++}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "#818cf8", wordBreak: "break-all" }}
          >
            {p.length > 80 ? p.slice(0, 77) + "…" : p}
          </a>,
        );
      } else if (p) {
        out.push(<span key={key++}>{p}</span>);
      }
    }
  };
  while ((m = boldRe.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    out.push(<strong key={key++}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));
  return <span>{out}</span>;
}
