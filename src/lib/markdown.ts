/**
 * Strip Markdown syntax down to a single line of plain text, for previews and
 * excerpts (cards, list rows) where the raw Markdown source would otherwise be
 * shown verbatim. This is intentionally a lightweight regex pass, not a full
 * parser — it removes the common inline/block syntax and collapses whitespace.
 *
 * For *rendered* Markdown (the project detail page) use `MarkdownContent`.
 */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_~>]+/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
