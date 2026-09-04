# Format conversion

Choosing what comes out: keep the source format, force JPEG, or force PNG. This
is also where the app's promise that it never returns a larger file lives.

## Sub-features

- **Keep original**: resolves to PNG for a PNG source and JPEG for everything
  else. Hidden entirely for a HEIC source, which has no encoder here.
- **JPEG / PNG**: force one, whatever the source was.
- **Quality gating**: the quality slider and the fit panel only exist when the
  output resolves to JPEG. PNG shows an explanation instead.
- **Never larger**: when encoding would cost bytes, `runCompression` returns the
  source untouched and sets `keptOriginal`.
- **The notice**: `compression-notice.ts` says which format was kept, why, and
  which control to reach for. Warning tone for the HEIC case, neutral otherwise.

## How to get to it (user POV)

The `FORMAT` panel, under the size controls.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

pick() { node $D eval "$U" '[...document.querySelectorAll("[role=radiogroup][aria-label=\"Output format\"] [role=radio]")].find(b=>b.textContent==="'"$1"'").click()'; }

# JPEG source at full size, asked for PNG: PNG would be bigger, so it is refused
node $D upload "$U" 'input[type=file]' .local/verify/fixtures/sample.jpg
node $D wait "$U" "COMPRESSED" 30000
pick PNG
sleep 4
node $D eval "$U" 'JSON.stringify({
  bytes: document.querySelector("main [role=img]").getAttribute("aria-label"),
  notice: [...document.querySelectorAll("main p")].map(p=>p.textContent).filter(t=>t.includes("well compressed")) })'
```

Buttons are matched on `textContent`, not `innerText`, because CSS uppercases
the rendered label.

## What proves it works

- Asking a full-size JPEG for PNG keeps the JPEG. The readout reads
  `1.05 MB of the original 1.05 MB` and the notice reads
  `Your original is already well compressed. Saving it as PNG at these settings
would make it bigger, so we kept your original JPEG.` The notice naming both
  the format asked for and the format kept is the point; a generic message is a
  regression.
- The quality section is replaced by the PNG explanation, and
  `[aria-label="Quality"]` no longer matches anything.
- The downloaded file's real header matches the format shown. Download it and
  run `file` on it. A JPEG named `.png` passes every on-screen check and is
  exactly the failure this catches.
- With the width dropped to 50%, PNG does win on this fixture, the notice
  disappears, and the byte readout falls. Both branches, one fixture.

## Gotchas

- `Keep original` is not a third format, it is a resolution rule: PNG source to
  PNG, everything else to JPEG. Reading it as a distinct mode leads to proofs
  that never exercise the resolution.
- The never-larger guarantee overrides the requested format silently in the
  bytes and loudly in the notice. Do not check `keptOriginal` behaviour by the
  file extension alone.
- HEIC is the one source with no smaller fallback, so its notice has warning
  tone and different wording. Untested here; see `image-intake.md`.
