# Live compression

The core loop: change a setting, watch the file get smaller. Encoding runs in a
module worker calling the Rust WASM encoder, so the page never freezes.

## Sub-features

- **Quality slider**: 1 to 100, JPEG output only. The section header shows the
  current value.
- **300 ms debounce**: a slider drag encodes once at the end, not per frame.
  `useDebouncedValue` in `hooks/use-debounced-value.ts`.
- **Byte bar**: original size, result size, the percent change, and a bar whose
  width is the ratio. It turns red and reads `LARGER` when a result grew.
- **Compare wipe**: drag across the frame to move the seam between the original
  and the result. Keyboard-driven too: arrows step 2%, PageUp/PageDown step 10%.
  The `ORIGINAL` and `COMPRESSED` captions fade out as the seam reaches them.
- **Compressing badge**: an in-flight indicator inside the frame; the result
  image also drops to 40% opacity while stale.
- **Never-larger guarantee**: if encoding cannot beat the source, the source is
  returned unchanged and a notice explains which control to reach for.

## How to get to it (user POV)

Load an image, then drag the `QUALITY` slider. The picture and the numbers
under it update about a third of a second after you stop.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

node $D upload "$U" 'input[type=file]' .local/verify/fixtures/sample.jpg
node $D wait "$U" "COMPRESSED" 30000
before=$(node $D eval "$U" 'document.querySelector("main [role=img]").getAttribute("aria-label")')

node $D key "$U" '[aria-label="Quality"]' ArrowLeft 10
sleep 2
after=$(node $D eval "$U" 'document.querySelector("main [role=img]").getAttribute("aria-label")')
printf 'before: %s\nafter:  %s\n' "$before" "$after"
```

The compare wipe, read off the element that owns the split:

```bash
node $D key "$U" '[aria-label="Compare position"]' ArrowLeft 10
node $D eval "$U" 'JSON.stringify({
  now: document.querySelector("[aria-label=\"Compare position\"]").getAttribute("aria-valuenow"),
  clip: getComputedStyle(document.querySelector("img[alt=Compressed]")).clipPath })'
```

## What proves it works

- The byte readout changes in the right direction. Quality 85 to 75 on
  `sample.jpg` moves it from about `653.8 KB of the original 1.05 MB` to about
  `421.5 KB of the original 1.05 MB`. Those are measured numbers, and the last
  decimal drifts because the fixture is redrawn each run. A pair that did not
  move at all is the failure.
- `aria-valuenow` on the quality thumb matches the number printed in the section
  header. They come from the same state, so a mismatch means a render bug.
- The wipe actually clips. `aria-valuenow` 30 must come with a computed
  `clip-path` of `inset(0px 0px 0px 30%)` on `img[alt=Compressed]`. Reading only
  the ARIA value would pass on a handle that moves and clips nothing.
- The result is a real encode, not the source passed through: `naturalWidth` on
  `img[alt=Compressed]` is the requested width and its blob size differs from
  the original.

## Gotchas

- **The byte bar is below the fold** at the default 1440x1000 window. Use
  `shot --full` or the proof shows the controls and hides the result.
- Reading the readout immediately after a `key` command reads the previous
  result. Wait for it to change; two seconds is comfortably past the 300 ms
  debounce plus a 1600x1200 encode.
- The quality section disappears entirely when the output resolves to PNG, and
  `[aria-label="Quality"]` stops matching. That is `format-conversion.md`
  territory, not a broken selector.
- The `Compressing` badge and the fit note are both `role=status`, so
  `[role=status]` matches two elements while an encode is in flight. The badge is
  a `span`, the note is a `p`: select `p[role=status]` for the note.
