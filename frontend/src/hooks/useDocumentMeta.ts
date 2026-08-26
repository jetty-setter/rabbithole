import { useEffect } from "react";

const SITE_TITLE = "RabbitHole";
const DEFAULT_TITLE = "RabbitHole — Follow Curiosity Deeper";
const DEFAULT_DESCRIPTION =
  "Search what was actually said across video, jump directly to the moment, and follow connected ideas wherever they lead.";

/** Sets document.title + the og/twitter/description meta tags for the
 *  current route, restoring the site defaults on unmount. Every route
 *  otherwise inherited the same static index.html metadata, so a shared
 *  Watch link looked identical to the homepage in previews and tabs. */
export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_TITLE}` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;

    document.title = fullTitle;
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', desc);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:title"]', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[name="twitter:title"]', DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}

function setMeta(selector: string, content: string) {
  document.querySelector(selector)?.setAttribute("content", content);
}
