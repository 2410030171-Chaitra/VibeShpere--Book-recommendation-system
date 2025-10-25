Proposed replacements for low-res / broken covers

This patch contains suggested repo-level changes that are safe to review and apply manually.

Patch summary:
- Replace `cover` URL for book `b5` (Quantum Tea & Other Stories) with an empty string so the runtime placeholder is used.

Rationale:
- A HEAD check reported the Unsplash URL as low-content-length (~27KB) and no Google Books thumbnail was found.
- Rather than leaving a low-res image, replacing with an empty cover ensures the `CoverImage` component shows the SVG placeholder (or tries Google Books at runtime).

How to apply:
- From the project root run:

  git apply scripts/proposed_replacements.patch

- Review changes, run the site, and verify covers.

If you'd like, I can apply the patch automatically instead of leaving it for manual review. If you'd like that, say "apply the proposed replacements" and I'll update the repo in-place (with a backup).