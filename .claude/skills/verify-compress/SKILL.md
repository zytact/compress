---
name: verify-compress
description: Launch compress for real and prove a change works. Starts the Vite dev server on a free port and a dedicated Chromium against a throwaway profile, then drives the single-page image compressor over CDP - pick an image, resize, change format, fit to a target size, download - and captures screenshots and the downloaded file as evidence. Use when asked to run the app, screenshot the UI, confirm a fix in the real browser, or verify compression output end to end.
---

# Verify compress

compress is one page. A person drops an image in, moves the size, format and
quality controls, and downloads what comes out. Everything runs in the tab: the
encoder is Rust compiled to WASM, loaded from `public/wasm/` and called from a
module worker, and nothing is uploaded. So there is no API to poke and no server
state to inspect. The only honest proof is a browser driving the real controls
and a real file landing on disk.

Read `features/README.md` before deciding what a run has to cover. A proof that
drives one convenient control is incomplete when the map lists others.

This skill lives twice, byte-identical, at `.agents/skills/verify-compress/` and
`.claude/skills/verify-compress/`. Commands below name the `.agents` path; the
scripts locate the repo root from their own location, so either copy runs.
**Edit one and copy it over the other in the same commit.** Two copies that
disagree about how to verify the app are worse than one.

## Launch

```bash
.agents/skills/verify-compress/scripts/launch.sh
```

It installs dependencies if `node_modules` is missing, starts `vite dev` on a
free port with `--strictPort`, waits for the page to answer, points the profile's
download directory at this run, and starts a browser with its own CDP port.

Readiness is three signals in order: the dev server answering HTTP 200 at `/`,
the CDP endpoint answering on its port, and the app tab actually hydrating. That
third one is not ceremony. The app is server-rendered, so HTTP 200 returns markup
while Vite is still building the client bundle, and a page driven in that window
takes events into nothing and reports success. On a cold Vite cache the wait can
run to a couple of minutes; the script allows four and then fails with the log. Everything it writes goes under `.local/`, which
`.gitignore` already covers with `*.local`, so a run leaves `git status` clean.

- `.local/verify/` is run state: profile, downloads, fixtures, logs, session.
  Cleanup deletes all of it. Nothing here is worth keeping.
- `.local/verify-evidence/` holds proofs, and nothing deletes them.

The app has no accounts and no server-side storage, so the profile is disposable
by design. That is the one real difference from a skill like GramGrab's, and it
means there is nothing to sign into and no reason to preserve a profile between
runs.

Every later command needs the session variables:

```bash
. ./.local/verify/session.env
```

That exports `COMPRESS_APP_URL`, `COMPRESS_DEV_PORT`, `COMPRESS_CDP_PORT`,
`COMPRESS_VERIFY_DOWNLOADS`, `COMPRESS_VERIFY_PROFILE`, and both PIDs.

The WASM encoder is committed under `public/wasm/`, so a normal checkout needs no
Rust toolchain. If that artifact is missing, launch stops and says so rather than
starting an app whose every compression would fail; restore it with git, or run
`pnpm run build:wasm` if you have Rust and `wasm-pack`.

### Browser choice

`launch.sh` resolves `COMPRESS_BROWSER` first, then `chromium`,
`chromium-browser`, `helium`, `google-chrome`. Any Chromium works here: unlike an
extension harness, this skill only needs CDP, which Google Chrome still serves.

```bash
COMPRESS_BROWSER=google-chrome .agents/skills/verify-compress/scripts/launch.sh
```

Never point `COMPRESS_BROWSER` at a browser you already have open with your own
profile. Chromium refuses to reuse a profile a live browser holds, and the run
would either fail or drive your real session.

## Doctor

```bash
node .agents/skills/verify-compress/scripts/doctor.mjs
```

Read-only. Eight checks, non-zero exit if any fails:

- session file present
- dev server pid still alive
- browser pid still alive
- the app answers HTTP 200 at `COMPRESS_APP_URL`
- `/wasm/image_compress_wasm_bg.wasm` is served and starts with the wasm magic
  bytes, so a 404 or an HTML error page is caught before a compression fails
- CDP port answering, with the browser build string
- the app tab is on the expected origin and React has attached to it, which is
  a different question from whether the elements exist
- the profile's `download.default_directory` is this run's directory

Run it first whenever anything looks off. The wasm and downloads checks are the
two that catch a session which looks healthy and would still produce a worthless
proof.

## Drive

`scripts/drive.mjs` is a dependency-free CDP client. It reads
`COMPRESS_CDP_PORT` from the environment, or takes `--port` first.

```bash
. ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs
U="$COMPRESS_APP_URL"

node $D targets                                  # page and compression worker
node $D open  "$U"
node $D text  "$U"                               # innerText of the whole page
node $D wait  "$U" "COMPRESSED" 30000            # poll until text appears
node $D eval  "$U" 'document.title'
node $D upload "$U" 'input[type=file]' .local/verify/fixtures/sample.jpg
node $D click "$U" 'main button:has(svg.lucide-download)'
node $D fill  "$U" '[aria-label="Target size in kilobytes"]' 200
node $D key   "$U" '[aria-label="Quality"]' ArrowLeft 10
node $D shot  --full "$U" .local/verify-evidence/run/workspace.png
```

`fill` goes through React's own value setter and dispatches `input`, because
assigning `.value` updates the DOM and leaves React's copy stale. `key` focuses
the element and sends real key events through CDP, which is how the Radix quality
slider and the compare handle are driven.

### Test images

The app needs a file to work on, and there is no photo in the repo. Generate one:

```bash
node .agents/skills/verify-compress/scripts/fixture.mjs
```

It draws a seeded image in the tab launch.sh already opened and writes
`.local/verify/fixtures/sample.jpg` (about 1.05 MB, 1600x1200) and `sample.png`
(about 4.9 MB). Same picture every run, so a size in today's proof is comparable
to the last one; canvas rasterisation is not bit-exact, so expect the encoded
size to wander by a few hundred bytes. Nothing but the browser is needed, so a
run never depends on ImageMagick being installed.

It reuses the open tab on purpose. Two page targets on the same URL make every
`drive.mjs` command ambiguous, because it matches on URL and takes the first
page the browser lists. Keep one app tab open for the whole run.

No HEIC fixture, and not an oversight. HEIC intake leans on the browser's own
`createImageBitmap`, whose HEIC support varies by platform, and ImageMagick on
this machine has no HEIC encoder to fake one with. Verifying that path needs a
real HEIC off a phone. See `features/image-intake.md`.

### Handles

Prefer these, which the source owns:

| Target            | Handle                                                             |
| ----------------- | ------------------------------------------------------------------ |
| File input        | `input[type=file]` (hidden inside the dropzone)                    |
| Scale buttons     | `[role=radiogroup][aria-label="Scale"] [role=radio]`               |
| Width field       | `main label input[inputmode="numeric"]`                            |
| Format buttons    | `[role=radiogroup][aria-label="Output format"] [role=radio]`       |
| Quality slider    | `[aria-label="Quality"]` (the Radix thumb, `role=slider`)          |
| Target size field | `[aria-label="Target size in kilobytes"]`                          |
| Fit button        | `section:has(input[aria-label="Target size in kilobytes"]) button` |
| Fit note          | `p[role=status]`                                                   |
| Compare handle    | `[aria-label="Compare position"]` (`aria-valuenow` is the split %) |
| Byte readout      | `main [role=img]` (`aria-label` reads "X of the original Y")       |
| Download button   | `main button:has(svg.lucide-download)`                             |
| Error banner      | `[role=alert]`                                                     |

Read numbers off ARIA attributes rather than off rendered text. `aria-valuenow`
on the quality thumb and the `aria-label` on the byte bar are the same values the
UI renders, without the font and rounding in the way.

Three things bite when matching text:

- **CSS uppercases much of the chrome.** `text` and `wait` read `innerText`, so
  they see `COMPRESSED` and `FIT TO A SIZE`, while `textContent` in an `eval`
  selector still reads `Compressed`. Select on `textContent`, wait on the
  uppercase form.
- **The TanStack devtools panel is in the dev build.** Its trigger sits bottom
  right in every screenshot, and its buttons show up in any unscoped
  `document.querySelectorAll('button')`. Scope selectors to `main`.
- **Compression is debounced 300 ms and then runs in a worker.** After moving a
  control, wait for the readout to change rather than reading immediately. The
  `Compressing` badge inside the compare frame is the in-flight signal.

Server rendering shapes the harness in one more place. `upload` waits for React
to stamp `__reactProps$` onto the target input before setting files, because the
input is in the SSR markup before React attaches to it, and setting files in that
window fires a `change` event that nothing is listening for. `upload` then checks
the event actually carried a file and fails if it did not, so a silent no-op
cannot pass for a successful drive.

## Evidence

Write proofs to `.local/verify-evidence/<UTC timestamp>/` and name the directory
in your report. Cleanup never touches it, and `*.local` in `.gitignore` covers
it, so evidence outlives the run without becoming a commit.

```bash
EV=.local/verify-evidence/$(date -u +%Y%m%dT%H%M%SZ) && mkdir -p "$EV"
node $D shot --full "$U" "$EV/after.png"
node $D eval "$U" 'document.querySelector("main [role=img]").getAttribute("aria-label")' > "$EV/bytes.txt"
node .agents/skills/verify-compress/scripts/doctor.mjs > "$EV/doctor.txt"
cp "$COMPRESS_VERIFY_DOWNLOADS"/* "$EV/" 2>/dev/null || true
```

Proof standards for this repo:

- Drive the real user path. Hand a file to `input[type=file]` and click the
  controls; do not call a React setter, and do not import `compress()` in a
  scratch script. The pipeline under test is intake, worker, WASM, blob, anchor.
- Capture the action and the resulting state, not only the end screen. A
  screenshot before and after the change beats one screenshot, and the byte
  readout before and after is the number that carries the claim.
- Check the file, not just the page. The result only exists as a download, so
  every compression proof ends with a file in `$COMPRESS_VERIFY_DOWNLOADS`:
  its name, its size, and its actual format. `file` or `magick identify` reads
  the real header, which is the only thing that catches an encoder emitting the
  wrong container under the right extension.
- Do not mock the encoder. `src/lib/__tests__/compress.test.ts` covers the pure
  logic with vitest, and `pnpm test` is the right tool for that. This skill
  exists for what jsdom cannot show: real WASM, real worker, real download.
- `--full` on `shot` matters more than it looks. The byte bar sits below the fold
  at the default window size, so a viewport screenshot proves the settings and
  hides the result.

## Cleanup

```bash
.agents/skills/verify-compress/scripts/cleanup.sh
```

It asks the browser to close over CDP, signals the dev server's process group,
and removes `.local/verify/` with the profile, downloads, fixtures and logs.
`.local/verify-evidence/` survives, so copy anything worth keeping out of the
downloads directory before running it.

Nothing is ever killed by process name. The dev server is started under `setsid`
so cleanup can take vite and its nitro child down as one process group, and the
browser is asked to exit rather than signalled, with a signal as the fallback
that warns when it fires.

Run cleanup after a failed attempt too, so a broken run does not strand a browser
or a dev server. `launch.sh` refuses to start while a session file exists.

## Helpers

All are executable and take no arguments beyond what is shown above.

| Script                | Purpose                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `scripts/launch.sh`   | Start the dev server and a dedicated browser, write `session.env`                                        |
| `scripts/doctor.mjs`  | Eight read-only health checks, non-zero exit on any failure                                              |
| `scripts/fixture.mjs` | Draw seeded `sample.jpg` and `sample.png` test images in the running browser                             |
| `scripts/drive.mjs`   | CDP client: `targets`, `open`, `eval`, `text`, `wait`, `shot`, `upload`, `click`, `fill`, `key`, `close` |
| `scripts/cleanup.sh`  | Close the browser, stop the dev server, remove run state, keep the evidence                              |
