#!/usr/bin/env bash
# Copy a local image into the project's public assets folder as hero-lavender.png
# Usage: ./scripts/install-hero.sh /path/to/your/image.png
set -e
if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/your/image.png"
  exit 1
fi
SRC="$1"
DST="public/assets/hero-lavender.png"
cp "$SRC" "$DST"
echo "Copied $SRC -> $DST"
echo "Restart or refresh your dev server and open http://localhost:5173 to see the new hero image."