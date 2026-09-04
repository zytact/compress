# Resize

Choosing the output dimensions. Resizing and re-encoding happen in one pass, so
width interacts with quality rather than preceding it.

## Sub-features

- **Scale buttons**: 100%, 75%, 50%, 25% of the original width. The active one
  is highlighted only when the width still equals that scale exactly.
- **Width field**: a whole-number text input. It is a text input on purpose;
  `number-input.tsx` explains why React's numeric syncing broke it.
- **Height follows width**: derived from the source aspect ratio, floor 1 px.
  Shown in the `SIZE` section readout as `W × H px`.
- **Upscale clamp**: typing a width above the original clamps to the original.
- **Fit invalidation**: changing the width clears any fit note, because the
  quality it solved for no longer describes what is on screen.

## How to get to it (user POV)

In the `SIZE` panel, press a scale button or type a width.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

# 50% is index 2 in the scale group
node $D eval "$U" 'document.querySelectorAll("[role=radiogroup][aria-label=Scale] [role=radio]")[2].click()'
sleep 2
node $D eval "$U" 'document.querySelector("section").innerText.replace(/\n/g," | ")'

# typed width, and the upscale clamp
node $D fill "$U" 'main label input[inputmode="numeric"]' 640
sleep 2
node $D fill "$U" 'main label input[inputmode="numeric"]' 9999
sleep 2
node $D eval "$U" 'document.querySelector("main label input[inputmode=numeric]").value'
```

## What proves it works

- The `SIZE` readout tracks the aspect ratio: 50% of 1600x1200 reads
  `800 × 600 px`, not `800 × 1200 px`.
- The encoded image really is that size, not just labelled it:
  `document.querySelector('img[alt=Compressed]').naturalWidth` is 800. The
  displayed element is stretched to the frame by CSS, so only `naturalWidth`
  answers this.
- Typing 9999 leaves the field at 1600. The clamp is in the change handler, so a
  regression shows as a field that accepts the larger number.
- The byte readout drops when the width drops, at unchanged quality.

## Gotchas

- The width field carries no `aria-label`; it is labelled by the wrapping
  `<label>`. `main label input[inputmode="numeric"]` is the handle, and the
  `main` scope is what keeps it from also matching the target-size field.
- The scale buttons compare a computed width for exact equality, so after typing
  640 no button is active even though nothing is wrong. Do not read an unlit
  scale row as a failure.
- Height is derived, never typed. There is no height input to drive.
