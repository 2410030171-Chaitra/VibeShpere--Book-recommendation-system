import React, { useState } from 'react';

/**
 * BookImage - Shared book cover image component with robust fallback
 * 
 * Features:
 * - Fast rendering with primaryUrl
 * - Automatic fallback on error via onError (no blocking HTTP checks)
 * - Support for alt identifiers (ISBN, Open Library ID) for fallback construction
 * - Lazy loading for performance
 * - Always shows an image (never broken/missing)
 * 
 * @param {string} primaryUrl - Primary cover URL (Google Books thumbnail, etc.)
 * @param {object} altIdentifiers - {isbn, olid} for constructing Open Library fallback
 * @param {string} fallbackUrl - Final fallback URL (defaults to /assets/default_cover.svg)
 * @param {string} title - Book title (for alt text)
 * @param {string} author - Book author (for alt text)
 * @param {string} className - CSS classes to apply
 * @param {string} loading - Loading strategy ('lazy' or 'eager')
 */
export default function BookImage({ 
  primaryUrl, 
  altIdentifiers = {},
  fallbackUrl = '/assets/default_cover.svg',
  title = 'Book cover',
  author = '',
  className = '',
  loading = 'lazy'
}) {
  const [currentSrc, setCurrentSrc] = useState(primaryUrl || constructFallback(altIdentifiers) || fallbackUrl);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  /**
   * Construct Open Library cover URL from ISBN or OLID
   */
  function constructFallback(identifiers) {
    if (identifiers.isbn) {
      return `https://covers.openlibrary.org/b/isbn/${identifiers.isbn}-M.jpg`;
    }
    if (identifiers.olid) {
      return `https://covers.openlibrary.org/b/olid/${identifiers.olid}-M.jpg`;
    }
    return null;
  }

  /**
   * Handle image load error - try fallback, then final fallback
   */
  const handleError = (e) => {
    // Prevent infinite error loops
    if (e.target.src === fallbackUrl) {
      return;
    }

    // If primary failed and we haven't tried alt identifiers fallback yet
    if (!fallbackAttempted && (altIdentifiers.isbn || altIdentifiers.olid)) {
      const altUrl = constructFallback(altIdentifiers);
      if (altUrl && altUrl !== currentSrc) {
        setCurrentSrc(altUrl);
        setFallbackAttempted(true);
        return;
      }
    }

    // Use final fallback
    setCurrentSrc(fallbackUrl);
  };

  const altText = `${title}${author ? ` by ${author}` : ''}`;

  return (
    <img
      src={currentSrc}
      alt={altText}
      className={className}
      loading={loading}
      onError={handleError}
    />
  );
}
