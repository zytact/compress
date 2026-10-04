# AGENTS.md

## Project

Compress is a browser-only image compression and resizing tool. Size, format and quality are applied in one pass, the encoder is Rust compiled to WebAssembly under `wasm/`, and no image ever leaves the device.

Add shadcn components with `pnpm dlx shadcn@latest add <component>`.

## Validation

Install deps with `pnpm install` after pulling remote changes. After any change, run:

```sh
pnpm validate
```

It runs what CI runs (lint, Prettier check, typecheck, tests, build) and changes no files. When lint or formatting fails, `pnpm check` fixes what it can by running Prettier with `--write` and ESLint with `--fix`.

Changes under `wasm/` need `cargo test` from `wasm/` and `pnpm build:wasm` before `pnpm validate`, since the build reads the compiled artifacts from `public/wasm/`. Commit the rebuilt artifacts with the Rust change. CI rebuilds them with the toolchain pinned in `wasm/rust-toolchain.toml` and fails if they differ, so bump that pin only together with a rebuild.

To confirm a change in the real browser rather than in tests, use the `verify-compress` skill.
