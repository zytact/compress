#!/usr/bin/env bash
# Start the compress dev server and a dedicated browser pointed at it, then
# write the session variables every other script reads.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
cd "$repo"

run="$repo/.local/verify"
session="$run/session.env"
profile="$run/profile"
downloads="$run/downloads"

if [ -f "$session" ]; then
  echo "A session already exists at $session." >&2
  echo "Run scripts/cleanup.sh first; two instances would fight over the profile." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install --frozen-lockfile
fi

# The WASM encoder is committed under public/wasm, so a normal checkout needs no
# Rust toolchain. Only a deleted or half-built artifact lands here.
if [ ! -f public/wasm/image_compress_wasm_bg.wasm ]; then
  echo "public/wasm/image_compress_wasm_bg.wasm is missing." >&2
  echo "Restore it with git, or rebuild it with 'pnpm run build:wasm' (needs Rust + wasm-pack)." >&2
  exit 1
fi

mkdir -p "$run" "$downloads" "$profile/Default"

free_port() {
  node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{const{port}=s.address();s.close(()=>console.log(port))})'
}

dev_port="${COMPRESS_DEV_PORT:-$(free_port)}"
cdp_port="${COMPRESS_CDP_PORT:-$(free_port)}"
app_url="http://127.0.0.1:$dev_port/"

echo "Starting dev server on $dev_port..."
# --strictPort so a taken port is a loud failure instead of a silent shift to
# another one that nothing else in this session knows about.
# setsid puts vite and every child it spawns in one process group, so cleanup
# can take the whole tree down by group instead of guessing at pids by name.
setsid pnpm exec vite dev --port "$dev_port" --strictPort --host 127.0.0.1 \
  >"$run/dev.log" 2>&1 &
dev_pid=$!

wait_for_http() {
  local url="$1" deadline=$((SECONDS + 120))
  until curl -fs -o /dev/null "$url"; do
    if ! kill -0 "$dev_pid" 2>/dev/null; then
      echo "Dev server exited. Last lines of $run/dev.log:" >&2
      tail -20 "$run/dev.log" >&2
      exit 1
    fi
    [ "$SECONDS" -lt "$deadline" ] || { echo "Dev server did not answer $url in 120s." >&2; exit 1; }
    sleep 0.5
  done
}
wait_for_http "$app_url"

# Downloads are steered through the profile's own Preferences rather than CDP
# Browser.setDownloadBehavior, which renames the file to download.<ext> and
# destroys the "-compressed" filename this app builds and worth proving.
# Chromium rewrites Preferences on exit, so this is written on every launch.
node -e '
const {readFileSync, writeFileSync} = require("node:fs");
const [file, dir] = process.argv.slice(1);
let prefs = {};
try { prefs = JSON.parse(readFileSync(file, "utf8")); } catch {}
prefs.download = {...prefs.download, default_directory: dir, prompt_for_download: false};
prefs.savefile = {...prefs.savefile, default_directory: dir};
writeFileSync(file, JSON.stringify(prefs));
' "$profile/Default/Preferences" "$downloads"

browser="${COMPRESS_BROWSER:-}"
if [ -z "$browser" ]; then
  for candidate in chromium chromium-browser helium google-chrome google-chrome-stable; do
    if command -v "$candidate" >/dev/null 2>&1; then browser="$candidate"; break; fi
  done
fi
if [ -z "$browser" ]; then
  echo "No Chromium-family browser found. Set COMPRESS_BROWSER=<path>." >&2
  kill "$dev_pid" 2>/dev/null || true
  exit 1
fi

echo "Starting $browser on CDP port $cdp_port..."
"$browser" \
  --user-data-dir="$profile" \
  --remote-debugging-port="$cdp_port" \
  --no-first-run \
  --no-default-browser-check \
  --disable-search-engine-choice-screen \
  --hide-crash-restore-bubble \
  --window-size=1440,1000 \
  "$app_url" \
  >"$run/browser.log" 2>&1 &
browser_pid=$!

deadline=$((SECONDS + 60))
until curl -fs -o /dev/null "http://127.0.0.1:$cdp_port/json/version"; do
  if ! kill -0 "$browser_pid" 2>/dev/null; then
    echo "Browser exited. Last lines of $run/browser.log:" >&2
    tail -20 "$run/browser.log" >&2
    kill "$dev_pid" 2>/dev/null || true
    exit 1
  fi
  [ "$SECONDS" -lt "$deadline" ] || {
    echo "No CDP endpoint on $cdp_port after 60s." >&2
    exit 1
  }
  sleep 0.5
done

# HTTP 200 only means the server rendered the shell. On a cold checkout Vite is
# still building the client bundle at that point, so the page has markup and no
# React behind it, and anything driven now fires events into nothing. React
# stamps __reactProps$ onto the body when it attaches; that is the real ready
# signal. First run after an install can take a couple of minutes here.
echo "Waiting for the client bundle to hydrate..."
deadline=$((SECONDS + 240))
until [ "$(COMPRESS_CDP_PORT=$cdp_port node "$here/drive.mjs" eval "$app_url" \
  'Object.keys(document.body).some((k) => k.startsWith("__reactProps$"))' 2>/dev/null)" = "true" ]; do
  if ! kill -0 "$dev_pid" 2>/dev/null; then
    echo "Dev server exited while building. Last lines of $run/dev.log:" >&2
    tail -20 "$run/dev.log" >&2
    exit 1
  fi
  [ "$SECONDS" -lt "$deadline" ] || {
    echo "App never hydrated in 240s. Check $run/dev.log and the browser console." >&2
    exit 1
  }
  sleep 1
done

cat >"$session" <<ENV
export COMPRESS_APP_URL=$app_url
export COMPRESS_DEV_PORT=$dev_port
export COMPRESS_CDP_PORT=$cdp_port
export COMPRESS_VERIFY_DOWNLOADS=$downloads
export COMPRESS_VERIFY_PROFILE=$profile
export COMPRESS_DEV_PID=$dev_pid
export COMPRESS_BROWSER_PID=$browser_pid
export COMPRESS_BROWSER_BIN=$browser
ENV

echo
echo "Ready. App at $app_url"
echo "Load the session with:  . ./.local/verify/session.env"
