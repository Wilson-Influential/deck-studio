#!/usr/bin/env bash
# Regenerate library thumbnails + cap original sizes. macOS only (uses built-in `sips`).
# Run from the Deck Studio repo root after adding or changing assets in library-assets/.
set -euo pipefail
SRC="library-assets"
THUMBS="$SRC/thumbs"
THUMB_MAX=240
ORIG_MAX=1600
count=0
while IFS= read -r f; do
  rel="${f#"$SRC"/}"
  thumb="$THUMBS/$rel"
  mkdir -p "$(dirname "$thumb")"
  sips -Z "$ORIG_MAX" "$f" >/dev/null            # cap the original in place (longest edge)
  sips -Z "$THUMB_MAX" "$f" --out "$thumb" >/dev/null
  count=$((count+1))
done < <(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) ! -path "$THUMBS/*")
echo "Processed $count raster assets. Thumbnails in $THUMBS; originals capped at ${ORIG_MAX}px."
