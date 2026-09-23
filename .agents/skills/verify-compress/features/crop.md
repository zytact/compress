# Crop

Choosing what part of the image to keep. The crop box is the output: its shape
sets the output aspect, and the image is panned and zoomed under it. The crop
goes to the encoder with the size, so cropping costs no extra pass.

## Sub-features

- **Crop shape buttons**: Original, 1:1, 4:5, 3:2, 16:9, 9:16, in the
  `CROP AND SIZE` panel. Picking one resets zoom to 100% and centres the box.
- **Pan**: drag the image, or focus the stage and press the arrow keys. The box
  never leaves the image.
- **Zoom**: the slider under the stage, the wheel over it, or `+` and `-` with
  the stage focused. 100% to 400%.
- **Stage fits the crop**: a wide crop gets a wide stage instead of empty bars.
- **Output chip**: `W × H` in the top left of the box, the same numbers as the
  `CROP AND SIZE` readout.
- **Kept-original fallback is off while cropped**: the source is not the image
  the user cropped, so a crop that encodes larger is still returned.

## How to get to it (user POV)

In the `CROP AND SIZE` panel, press a shape, then drag and zoom the image in the
preview.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

# 1:1 is index 1 in the shape group
node $D eval "$U" 'document.querySelectorAll("[role=radiogroup][aria-label=\"Crop shape\"] [role=radio]")[1].click()'
sleep 2
# zoom in, then pan right with the keyboard
node $D key "$U" '[aria-label=Zoom]' ArrowRight 50
node $D key "$U" 'main [role=group]' ArrowRight 5
sleep 2
node $D eval "$U" 'document.querySelector("img[alt=Compressed]")?.naturalWidth'
```

## What proves it works

- With a 1600x1200 fixture, 1:1 reads `1200 × 1200 px` in `CROP AND SIZE`, and
  at 150% zoom `800 × 800 px`.
- The download really is square: `file` on it reports `800x800` (or whatever
  the readout says), not the source's 4:3.
- Panning changes what is kept, not the size: the image moves under the box and
  the readout does not change.

## Gotchas

- `img[alt=Compressed]` is missing while no result matches the current crop, for
  example right after a pan. Wait for the `Compressing` badge to go.
- The zoom slider's step is 0.01, so one `ArrowRight` is 1%.
