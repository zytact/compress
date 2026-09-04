# AGENTS.md

## Project

Compress is a browser-only image compression and resizing tool. Size, format and quality are applied in one pass, the encoder is Rust compiled to WebAssembly under `wasm/`, and no image ever leaves the device.

## Validation

Install deps with `pnpm install` after pulling remote changes. After any change, run:

```sh
pnpm check
pnpm test
pnpm build
```

`pnpm check` runs Prettier over the repo and then ESLint with `--fix`. Run `pnpm lint` on its own when you want failures reported instead of fixed.

Changes under `wasm/` need `cargo test` from `wasm/` and `pnpm build:wasm` before `pnpm build`, since the build reads the compiled artifacts from `public/wasm/`.

To confirm a change in the real browser rather than in tests, use the `verify-compress` skill.
