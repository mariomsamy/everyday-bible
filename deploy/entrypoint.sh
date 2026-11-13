#!/bin/sh
# Optionally downloads Bible texts in the background (the app works meanwhile; missing texts fall back to the public CDN).
set -e
if [ -n "$FETCH_TEXTS" ]; then
  if [ "$FETCH_TEXTS" = "all" ]; then
    (node scripts/fetch-texts.mjs || true) &
  else
    (node scripts/fetch-texts.mjs $(echo "$FETCH_TEXTS" | tr ',' ' ') || true) &
  fi
fi
exec "$@"
