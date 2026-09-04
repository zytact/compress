#!/usr/bin/env bash
# Tear down what launch.sh started: this browser, this dev server, this run's
# state. Evidence under .local/verify-evidence/ is never touched.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
cd "$repo"

run="$repo/.local/verify"
session="$run/session.env"

if [ ! -f "$session" ]; then
  echo "No session at $session; nothing to clean up."
  exit 0
fi

# shellcheck source=/dev/null
. "$session"

# Ask the browser to close rather than signalling it. A signalled Chromium skips
# its Preferences flush, and the next launch reads a half-written file.
if [ -n "${COMPRESS_CDP_PORT:-}" ]; then
  node "$here/drive.mjs" close >/dev/null 2>&1 || true
fi

if [ -n "${COMPRESS_BROWSER_PID:-}" ]; then
  for _ in $(seq 1 20); do
    kill -0 "$COMPRESS_BROWSER_PID" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "$COMPRESS_BROWSER_PID" 2>/dev/null; then
    echo "Browser $COMPRESS_BROWSER_PID ignored Browser.close; signalling it." >&2
    kill "$COMPRESS_BROWSER_PID" 2>/dev/null || true
  fi
fi

# The dev server is its own process group, so this reaches vite and the nitro
# child without ever matching a process by name.
if [ -n "${COMPRESS_DEV_PID:-}" ]; then
  kill -TERM -"$COMPRESS_DEV_PID" 2>/dev/null || kill -TERM "$COMPRESS_DEV_PID" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$COMPRESS_DEV_PID" 2>/dev/null || break
    sleep 0.25
  done
  kill -KILL -"$COMPRESS_DEV_PID" 2>/dev/null || true
fi

rm -rf "$run"
echo "Cleaned up. Evidence under .local/verify-evidence/ is untouched."
