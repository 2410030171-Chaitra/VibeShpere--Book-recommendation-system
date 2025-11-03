import React from 'react';

/**
 * Shared BookImage component
 * Props:
 * - primaryUrl: preferred cover URL (string)
 * - altIdentifiers: { isbn?: string } used for Open Library fallback
 * - fallbackUrl: final fallback asset (defaults to /assets/default_cover.svg)
 * - title: book title (for alt text)
 * - author: author name (for alt text)
 * - className, style, loading: passthrough to <img>
 */
export default function BookImage({
  primaryUrl,
  secondaryUrl, // optional: try this if primary fails (e.g., Google <-> OpenLibrary)
  altIdentifiers = {},
  fallbackUrl = '/assets/default_cover.svg',
  title = 'Book cover',
  author = '',
  className,
  style,
  loading = 'lazy',
}) {
  const normalize = (u) => {
    if (!u) return null;
    try {
      return String(u).replace(/^http:/, 'https:');
    } catch (_) {
      return u;
    }
  };

  const openLibFromIsbn = (isbn) => {
    if (!isbn) return null;
    return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
  };

  // Build candidate list in order of preference:
  // 1) primaryUrl
  // 2) secondaryUrl (if provided)
  // 3) Open Library by ISBN (if provided)
  // 4) fallback asset
  const candidatesInit = [
    normalize(primaryUrl),
    normalize(secondaryUrl),
    openLibFromIsbn(altIdentifiers?.isbn),
    fallbackUrl,
  ].filter(Boolean);

  const [candidates, setCandidates] = React.useState(candidatesInit);
  const [src, setSrc] = React.useState(candidatesInit[0] || (fallbackUrl || null));
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const next = [
      normalize(primaryUrl),
      normalize(secondaryUrl),
      openLibFromIsbn(altIdentifiers?.isbn),
      fallbackUrl,
    ].filter(Boolean);
    setCandidates(next);
  setSrc(next[0] || (fallbackUrl || null));
  setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryUrl, secondaryUrl, altIdentifiers?.isbn, fallbackUrl]);

  const handleError = (e) => {
    // Move to the next candidate
    if (candidates.length <= 1) {
      // No more candidates.
      if (fallbackUrl) {
        if (e && e.currentTarget && e.currentTarget.src !== fallbackUrl) {
          e.currentTarget.src = fallbackUrl;
        }
      } else {
        setFailed(true);
      }
      return;
    }
    const [, ...rest] = candidates;
    setCandidates(rest);
    setSrc(rest[0] || fallbackUrl);
  };

  // If the loaded image looks like a low-res/placeholder (common with Google “image not available”),
  // opportunistically try Open Library by title/author. If that fails, keep the current src.
  async function tryUpgradeCover(imgEl){
    try {
      // Heuristics: small intrinsic width AND from googleusercontent/googleapis
      const isGoogle = /googleusercontent\.com|googleapis\.com/.test(String(imgEl?.src || ''));
      const tooSmall = (imgEl?.naturalWidth || 0) <= 128; // many placeholders are 128px wide
      const missingIsbn = !altIdentifiers?.isbn;
      if (!(isGoogle && tooSmall && missingIsbn)) return;

      // Query Open Library search by title + author
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (author) params.set('author', author);
      params.set('limit', '1');
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const json = await res.json();
      const doc = (json && json.docs && json.docs[0]) || null;
      const coverId = doc && doc.cover_i;
      if (!coverId) return;
      const better = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      if (better && imgEl.src !== better) {
        imgEl.src = better;
      }
    } catch (_) {
      // ignore
    }
  }

  const altText = author ? `${title} — ${author} (cover)` : `${title} (cover)`;

  if (failed || !src) return null;

  return (
    <img
      src={src}
      alt={altText}
      className={className}
      style={style}
      loading={loading}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={handleError}
      onLoad={(e)=>{ tryUpgradeCover(e.currentTarget); }}
    />
  );
}
