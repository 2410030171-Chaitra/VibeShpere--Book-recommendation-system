/* eslint-disable react/prop-types */
import React, { useState } from 'react';

// Simple image component with graceful fallback and lazy loading.
// Uses the project's `public/assets/default_cover.svg` as a fallback when no
// remote cover is available or when the image fails to load.

export default function BookImage({ primaryUrl, title = '', author = '', className = '', altIdentifiers = {} }) {
  const [errored, setErrored] = useState(false);

  // Prefer primaryUrl (if provided). If it's falsy or fails to load, use the
  // default cover asset shipped in public/assets.
  const fallback = '/assets/default_cover.svg';
  const src = (!primaryUrl || errored) ? fallback : primaryUrl;

  return (
    <img
      src={src}
      alt={title ? `${title} — ${author || 'Unknown'}` : 'Book cover'}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`object-cover w-full ${className || ''}`}
      draggable={false}
    />
  );
}
