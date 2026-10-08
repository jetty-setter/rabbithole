/** Highlight literal matches without interpreting either the text or query as HTML. */
export function HighlightedText({ text, query, phrase = false }: { text: string; query: string; phrase?: boolean }) {
  const terms = [...new Set((phrase ? [query.trim()] : query.trim().split(/\s+/)).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return <>{text}</>;
  const pattern = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "giu"));
  return <>{parts.map((part, i) => i % 2 ? <mark className="search-match" key={i}>{part}</mark> : part)}</>;
}
