Cozy Bookshelf — Frontend

This is a small standalone frontend that connects to the Google Books API and shows a cozy, responsive book gallery.

Files:
- index.html — main page
- style.css — cozy styles
- script.js — fetch & render logic

How to run:
- Open `cozy-frontend/index.html` in your browser (no server required).
- Use the search bar to search by title, author, or keyword.
- Click the genre pills to quickly browse Fiction / Non‑Fiction / Classics.

Notes:
- This uses the public Google Books API (no API key required for basic searches). If you need larger quota or additional params, consider adding an API key.
- Images are taken from the API's `imageLinks` when available; a gentle SVG placeholder is used when missing.

Design:
- Warm cream background, rounded cards, soft shadows, and elegant fonts to match a cozy reading-corner aesthetic.