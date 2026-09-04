# Fit to a size

Name a size in KB and let the app search for the JPEG quality that lands just
under it, at whatever width is currently set. The search runs in the WASM
encoder (`fit_to_filesize`), bounded to quality 30 through 95.

## Sub-features

- **Target field and Fit button**: JPEG output only.
- **The search**: encodes repeatedly at the current width and returns the
  highest quality still under the target. The quality slider then jumps to it,
  so the answer stays editable rather than locking the control.
- **The note**: three outcomes, and each names the number it settled on. Under
  the ceiling: `Quality set to N to land just under T KB.` At the ceiling 95:
  even at its sharpest it fits. At the floor 30: it may still overshoot, reduce
  the width too.
- **Staleness**: the note disappears the moment the width, target or quality
  moves, because it no longer describes what is on screen.
- **Disabled at zero**: an empty or zero target disables the button.

## How to get to it (user POV)

The `FIT TO A SIZE` panel: type a number of KB, press `Fit`.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

node $D fill "$U" '[aria-label="Target size in kilobytes"]' 200
node $D click "$U" 'section:has(input[aria-label="Target size in kilobytes"]) button'
node $D wait "$U" "Quality set to" 60000
sleep 2
node $D eval "$U" 'JSON.stringify({
  quality: document.querySelector("[aria-label=Quality]").getAttribute("aria-valuenow"),
  note: document.querySelector("p[role=status]").textContent,
  bytes: document.querySelector("main [role=img]").getAttribute("aria-label") })'
```

Then prove the staleness rule by moving one control:

```bash
node $D key "$U" '[aria-label="Quality"]' ArrowLeft 1
sleep 2
node $D eval "$U" 'document.querySelector("p[role=status]").textContent'
```

## What proves it works

- The result lands under the target and close to it. On `sample.jpg` at
  1600x1200 with a 200 KB target the measured answer is quality 39,
  `199.28 KB of the original 1.05 MB`, note
  `Quality set to 39 to land just under 200 KB.` Under the target is the
  contract; nowhere near it means the search is broken even though it "passed".
  The last decimal moves between runs because the fixture is redrawn each time;
  the quality and the "just under" relationship should not.
- The three numbers agree. The quality in the note, the slider's
  `aria-valuenow`, and the size in the readout describe one encode.
- The note vanishes after any control moves. A stale note that survives is worse
  than no note, because it describes an encode that is no longer on screen.
- The downloaded file is under `target × 1024` bytes. The readout is rounded for
  display; the file is the real evidence.

## Gotchas

- The search encodes the image several times and takes seconds on a 1600x1200
  fixture. `wait` on `Quality set to` rather than sleeping a fixed amount.
- The Fit button carries no test id. `section:has(input[aria-label="Target size
in kilobytes"]) button` is the stable handle; `:has()` is fine in every browser
  this skill launches.
- A target below what quality 30 can reach still returns quality 30 and a file
  over the target. That is the documented floor, and the note says so. Do not
  file it as a bug without checking the note.
- The panel does not exist when the output resolves to PNG, and the button
  selector matches nothing. Switch the format first.
