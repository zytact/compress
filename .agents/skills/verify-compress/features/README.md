# compress feature map

One file per user-facing feature, written from the user's point of view: what it
is, how a person reaches it, how to drive it with `scripts/drive.mjs`, and what
observable end state proves it works.

This map is the maintained source for what a verification run should cover. A
proof that drives one convenient control is incomplete when the map lists
others. Keep it honest as the app changes; `/maintain-verification-skill` is the
loop for that.

| Feature                                     | Where it lives                              | Needs a fixture |
| ------------------------------------------- | ------------------------------------------- | --------------- |
| [Image intake](./image-intake.md)           | `file-drop-zone.tsx`, `wasm.ts`             | yes             |
| [Live compression](./live-compression.md)   | `image-compressor.tsx`, `image-compare.tsx` | yes             |
| [Resize](./resize.md)                       | `settings-panel.tsx`                        | yes             |
| [Format conversion](./format-conversion.md) | `compress.ts`, `compression-notice.ts`      | yes, both       |
| [Fit to a size](./fit-to-size.md)           | `compress.ts`, `wasm/`                      | yes             |
| [Download](./download.md)                   | `image-compressor.tsx`                      | yes             |

Two constraints shape every entry:

- **Nothing works without an image.** The app renders a landing page until a file
  is picked, and every control below is behind that. Run
  `scripts/fixture.mjs` once per session before driving anything.
- **Every change is debounced 300 ms and then encoded in a worker.** Reading the
  byte readout straight after a click reads the previous result. Wait for the
  number to change, or for the `Compressing` badge to disappear.

One feature is deliberately not in the table. The compare wipe has no output of
its own, so it is covered as a sub-feature of live compression rather than
pretending to be verifiable on its own terms.
