# Download

Saving the result. There is no server: the blob from the worker is handed to an
anchor with a `download` attribute and clicked. This is the only step that
produces something outside the tab, so it is the one every proof should end on.

## Sub-features

- **The button**: reads `Download <size>` once a result exists, plain `Download`
  before that, and is disabled until there is something to save.
- **Filename**: the source name with its extension replaced by the output
  format's, then `-compressed` before the dot. `sample.jpg` becomes
  `sample-compressed.jpg`; a PNG result becomes `sample-compressed.png`.
- **Object URL hygiene**: the blob URL is revoked right after the click.

## How to get to it (user POV)

The large button under the settings panel.

## Driving it with drive.mjs

```bash
cd /home/arnab/Projects/compress && . ./.local/verify/session.env
D=.agents/skills/verify-compress/scripts/drive.mjs && U="$COMPRESS_APP_URL"

node $D eval "$U" 'document.querySelector("main button:has(svg.lucide-download)").textContent'
node $D click "$U" 'main button:has(svg.lucide-download)'
sleep 3
ls -l "$COMPRESS_VERIFY_DOWNLOADS"
file "$COMPRESS_VERIFY_DOWNLOADS"/*
```

Downloads land in this run's directory because `launch.sh` writes
`download.default_directory` into the profile's `Preferences`. Do not switch
this to CDP `Browser.setDownloadBehavior`: it renames the file to
`download.<ext>` and destroys the filename evidence below.

## What proves it works

- A file exists in `$COMPRESS_VERIFY_DOWNLOADS` named exactly
  `sample-compressed.jpg`. Filename construction is real string logic with an
  off-by-one dot in reach, so record the exact name.
- Its size matches the button and the byte readout. Measured after a 200 KB fit:
  the button read `Download 199.28 KB` and the file was 204060 bytes, which is
  199.28 KiB. They agree because `formatBytes` divides by 1024. Compare the two
  against each other, not against these exact numbers: the fixture is redrawn
  every run and lands a few hundred bytes off.
- `file` reports the format the UI claimed. A JPEG saved as `.png` looks correct
  everywhere on screen and only this catches it.
- It opens. `magick identify` or a browser tab on the file proves the bytes are a
  decodable image, not a truncated blob.

## Gotchas

- No `saveAs` dialog: the anchor download completes on its own, and
  `prompt_for_download` is false in the profile. A run never blocks on a native
  dialog.
- Chromium writes a `.crdownload` first. Three seconds is enough for these
  sizes; for a larger fixture, poll for the final name instead of sleeping.
- Downloading twice appends ` (1)` to the name, which then fails an exact-name
  check. Clear `$COMPRESS_VERIFY_DOWNLOADS` between downloads, or expect it.
- Cleanup deletes the downloads directory with the rest of the run state. Copy
  anything a proof depends on into `.local/verify-evidence/` first.
