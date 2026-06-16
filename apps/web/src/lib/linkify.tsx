/**
 * Split a plain string into React nodes, turning URLs into clickable
 * <a target="_blank"> while leaving the rest as text. Used to render
 * note items (and any other free-form user text) where users paste
 * Slack/ClickUp/etc links and expect them to be clickable.
 *
 * Conservative regex: matches http(s)://... up to the first whitespace
 * or common punctuation that would clearly terminate a URL. Trailing
 * dots/commas/parens are stripped so a sentence like "abre em
 * https://x.com." doesn't include the period in the link.
 */
import { Fragment, type ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"]+)/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;

export function linkify(text: string): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_PATTERN.lastIndex = 0;
  let key = 0;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const raw = match[0];
    // Strip trailing punctuation so sentence endings don't end up in href.
    const trimmedTrailing = raw.replace(TRAILING_PUNCT, "");
    const tail = raw.slice(trimmedTrailing.length);
    const start = match.index;
    if (start > lastIndex) {
      out.push(text.slice(lastIndex, start));
    }
    out.push(
      <a
        key={`lk-${key++}`}
        href={trimmedTrailing}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {trimmedTrailing}
      </a>,
    );
    if (tail) out.push(tail);
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return <Fragment>{out}</Fragment>;
}
