/**
 * Strip Markdown syntax down to a single line of plain text, for previews and
 * excerpts (cards, list rows) where the raw Markdown source would otherwise be
 * shown verbatim. This is intentionally a lightweight regex pass, not a full
 * parser — it removes the common inline/block syntax, strips any raw HTML tags
 * (and the contents of `<script>` blocks) so tag markup never leaks into meta
 * descriptions or card previews, and collapses whitespace.
 *
 * For *rendered* Markdown (the project detail page) use `MarkdownContent`.
 */
export function markdownToPlainText(md: string): string {
  return (
    md
      // Fenced code blocks (drop contents) and inline code (keep contents).
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Images: drop entirely (including alt text).
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // Reference-style link/image definitions on their own line
      // (`[ref]: https://… "title"`) — drop them so the bare URL never leaks.
      .replace(/^\s*\[[^\]]+\]:\s+\S.*$/gm, '')
      // Links: keep the link text. The text may itself contain one level of
      // balanced brackets (e.g. `[see [docs] here](url)`), and the URL one
      // level of balanced parens so a trailing ')' (Wikipedia/MDN URLs) and
      // bracketed link text don't leak the raw `](…)` markup through.
      .replace(/\[((?:[^[\]]|\[[^\]]*\])+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
      // Reference-style link usages (`[text][ref]` / `[text][]`): keep the text.
      .replace(/\[((?:[^[\]]|\[[^\]]*\])+)\]\[[^\]]*\]/g, '$1')
      // ATX headings and line-leading blockquote markers (keep a literal '>'
      // that appears mid-sentence in prose).
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*>+\s?/gm, '')
      // Paired emphasis / strikethrough: strip the markers, keep the text, and
      // never span a line break. '*'/'~' are stripped when paired; '_' only
      // when flanked by non-word characters, so intraword underscores in
      // identifiers (snake_case, MAX_SIZE) survive intact.
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/~(.+?)~/g, '$1')
      .replace(/(^|[^\w])__(.+?)__(?!\w)/gm, '$1$2')
      .replace(/(^|[^\w])_(.+?)_(?!\w)/gm, '$1$2')
      // List markers (unordered '-', '+', '*' and ordered '1.').
      .replace(/^\s*[-+*]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Raw HTML: drop <script>…</script> contents entirely, then strip every
      // remaining tag. `<[^>]*>` only matches a balanced `<…>`, so a literal
      // mid-sentence '>' (e.g. "5 > 3") is left untouched. Done before the
      // final collapse so any spacing left by removed tags is squeezed out.
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      // Collapse runs of whitespace into single spaces.
      .replace(/\s+/g, ' ')
      .trim()
  );
}
