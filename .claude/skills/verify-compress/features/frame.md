# Frame

Choosing what part of the image to keep. The frame is the output: its shape sets
the output aspect, and the picture is panned and zoomed under it. The crop goes
to the encoder with the size, so cropping costs no extra pass.

## Sub-features

- **Frame shape buttons**: Original, 1:1, 4:5, 3:2, 16:9, 9:16. Picking one
  resets zoom to 100%, centres the frame, and switches the preview to Frame.
- **Preview toggle**: Compare shows the wipe over the cropped original and the
  result; Frame shows the whole source dimmed outside the frame.
- **Pan**: drag the picture, or focus the stage and press the arrow keys. The
  frame never leaves the source.
- **Zoom**: the slider under the stage, the wheel over it, or `+` and `-` with
  the stage focused. 100% to 400%.
- **Output label**: `W × H` above the frame, the same numbers as the `SIZE`
  readout.
- **Kept-original fallback is off while cropped**: the source is not the picture
  the user framed, so a crop that encodes larger is still returned.

## How to get to it (user POV)

In the `FRAME` panel, press a shape. The preview switches to Frame; drag and
zoom there. Press Compare above the preview to check quality.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

# 1:1 is index 1 in the shape group
node $D eval "$U" 'document.querySelectorAll("[role=radiogroup][aria-label=\"Frame shape\"] [role=radio]")[1].click()'
sleep 2
# zoom in, then pan right with the keyboard
node $D key "$U" '[aria-label=Zoom]' ArrowRight 50
node $D key "$U" 'main [role=group]' ArrowRight 5
sleep 2
node $D eval "$U" 'document.querySelector("img[alt=Compressed]")?.naturalWidth'
```

## What proves it works

- With a 1600x1200 fixture, 1:1 reads `1200 × 1200 px` in `SIZE`, and at 150%
  zoom `800 × 800 px`.
- The download really is square: `file` on it reports `800x800` (or whatever
  `SIZE` reads), not the source's 4:3.
- Panning changes what is kept, not the size: the Compare view shows a different
  region and the `SIZE` readout does not move.

## Gotchas

- `img[alt=Compressed]` only exists in the Compare view. Switch back before
  reading `naturalWidth`.
- The zoom slider's step is 0.01, so one `ArrowRight` is 1%.
