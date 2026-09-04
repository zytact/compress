# Image intake

Getting a picture into the tab. Until this succeeds the app shows a landing page
and nothing else can be verified.

## Sub-features

- **Drop zone**: a full-width target that takes a click or a drag-and-drop.
  Accepts `image/jpeg,image/png,image/heic,image/heif,.heic,.heif`.
- **Replace image**: a compact button in the header row once a file is loaded,
  which resets the settings for the new picture.
- **Metadata header**: filename, then `WIDTH x HEIGHT - FORMAT - SIZE`. Format
  comes from the extension, dimensions from a real decode of the file, size from
  `file.size`.
- **HEIC conversion**: HEIC and HEIF are decoded through `createImageBitmap`,
  drawn to a canvas and re-encoded as JPEG at 0.95 before the WASM encoder ever
  sees them, and the output format switches off `Keep original`.
- **Stale-pick guard**: loading a file is several awaits long, and a newer pick
  wins them all (`selectionRef` in `image-compressor.tsx`).

## How to get to it (user POV)

Open the app, drag a JPEG or PNG onto the dashed area, or click it and pick one.
Once loaded, `Replace image` swaps it for another.

## Driving it with drive.mjs

```bash
. ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"
node .agents/skills/verify-compress/scripts/fixture.mjs

node $D upload "$U" 'input[type=file]' .local/verify/fixtures/sample.jpg
node $D wait "$U" "sample.jpg" 20000
node $D eval "$U" 'document.querySelector("main p").innerText'
```

There are two file inputs in the source but never two on screen: the landing
drop zone unmounts and the compact `Replace image` input takes its place, so
`input[type=file]` keeps matching exactly one element throughout. Replacing an
image is the same command with a different path.

Drag-and-drop itself is not driven. Synthesising a `DataTransfer` with a real
file over CDP is a different code path from the one a person uses, and the same
`onFileSelect` runs either way, so uploading through the input tests what
matters and lies about nothing.

## What proves it works

- The header reads `1600 x 1200 - JPEG - 1.05 MB` for `sample.jpg`. The four
  values come from three different places, so a wrong one is a real defect.
- The compare frame shows the picture, not a broken image icon:
  `document.querySelector('img[alt=Original]').naturalWidth` is 1600.
- After `Replace image` with `sample.png`, the header format flips to `PNG` and
  the width field resets to the new image's width.

## Gotchas

- **HEIC is not covered by the fixtures.** `createImageBitmap` HEIC support
  varies by platform, and ImageMagick on this machine has no HEIC encoder to
  fake one with, so verifying it needs a real HEIC off a phone. When you have
  one: drop it in and check that the format buttons lose `Keep original` and
  that the header still reads `HEIC`, because the header describes the file the
  person picked, not the JPEG it was converted to. If the browser cannot decode
  it the app shows `Could not open this image:` in `[role=alert]`, which is
  correct behaviour and not a pass.
- An unsupported extension is not rejected at the input, it fails at decode.
  `inferFormatFromFilename` returns `unknown` and the error banner carries the
  decoder's message.
- The landing page and the loaded workspace are the same route. Waiting on a URL
  change to detect intake waits forever; wait on the filename instead.
