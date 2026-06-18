#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────────────────
# Runtime injection of NEXT_PUBLIC_API_BASE_URL.
#
# Next.js inlines NEXT_PUBLIC_* into the compiled bundle at BUILD time, so it
# can't normally be changed without rebuilding. To make this image runtime-
# configurable, we build with a sentinel string and swap it for the real value
# here, on container start. Result: set NEXT_PUBLIC_API_BASE_URL in your
# platform's env vars and just restart — no rebuild, no build args.
#
# (If the image was built WITH a real --build-arg, no sentinel is present and
# this is a harmless no-op — the baked value wins.)
# ─────────────────────────────────────────────────────────────────────────

: "${NEXT_PUBLIC_API_BASE_URL:=http://localhost:8000/api/v1}"

SENTINEL="APP_RUNTIME_API_BASE_URL"

if [ "$NEXT_PUBLIC_API_BASE_URL" != "$SENTINEL" ]; then
  echo "[entrypoint] injecting API base URL: ${NEXT_PUBLIC_API_BASE_URL}"
  # Only the compiled output under .next contains the sentinel. Use '|' as the
  # sed delimiter so the URL's slashes don't need escaping.
  find /app/.next -type f \( -name "*.js" -o -name "*.json" -o -name "*.html" \) \
    -exec sed -i "s|${SENTINEL}|${NEXT_PUBLIC_API_BASE_URL}|g" {} + 2>/dev/null || true
fi

exec "$@"
