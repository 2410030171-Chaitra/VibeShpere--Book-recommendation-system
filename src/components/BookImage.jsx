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

  // Build candidate list: primary -> Open Library (ISBN) -> fallback asset
  const candidatesInit = [
    normalize(primaryUrl),
    openLibFromIsbn(altIdentifiers?.isbn),
    fallbackUrl,
  ].filter(Boolean);

  const [candidates, setCandidates] = React.useState(candidatesInit);
  const [src, setSrc] = React.useState(candidatesInit[0] || fallbackUrl);

  React.useEffect(() => {
    const next = [normalize(primaryUrl), openLibFromIsbn(altIdentifiers?.isbn), fallbackUrl].filter(Boolean);
    setCandidates(next);
    setSrc(next[0] || fallbackUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryUrl, altIdentifiers?.isbn, fallbackUrl]);

  const handleError = (e) => {
    // Move to the next candidate
    if (candidates.length <= 1) {
      // Already at last fallback; ensure it's the local asset
      if (e && e.currentTarget && e.currentTarget.src !== fallbackUrl) {
        e.currentTarget.src = fallbackUrl;
      }
      return;
    }
    const [, ...rest] = candidates;
    setCandidates(rest);
    setSrc(rest[0] || fallbackUrl);
  };

  const altText = author ? `${title} — ${author} (cover)` : `${title} (cover)`;

  return (
    <img
      src={src}
      alt={altText}
      className={className}
      style={style}
      loading={loading}
      onError={handleError}
    />
  );
}
