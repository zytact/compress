# Compress

A fast, privacy-focused image compression and resizing tool that runs entirely in your browser using WebAssembly. No data is sent to any server, and all processing happens locally on your device.

## Features

Size, format and quality are all live at once, so resizing and re-encoding
happen in one pass rather than as separate modes.

Name a target in KB and the app searches for the JPEG quality that lands just
under it, at whatever width you picked, then hands the slider back to you.

Drag across the image to wipe between the original and the result, so you can
see what quality traded away at the seam where the two meet.

Other things it does:

- Converts between JPEG and PNG, or keeps the original format
- Converts Apple's HEIC images to JPEG using browser-native APIs
- Returns the original untouched when re-encoding would not make it smaller, and says why
- Explains when a HEIC source grows, since JPEG cannot always match it
- Uploads nothing, so your images stay on your device
- Runs the encoder as Rust compiled to WebAssembly, off the main thread

## Demo

Visit the live demo at `https://compress.zytact.com`

Or run it locally:

```bash
pnpm run dev
```

Then open `http://localhost:3000` in your browser.

## Tech Stack

- **Frontend**: Tanstack Start + React 19 + TypeScript + Vite
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Image Processing**: Rust + WebAssembly (wasm-bindgen)
- **Build Tool**: Vite with TanStack React Start
- **Testing**: Vitest + Testing Library + jsdom

## Development

### Prerequisites

- Node.js 24+
- pnpm (for package management)
- Rust toolchain + `wasm-pack` (for WASM builds)

### Installation

```bash
# Install dependencies
pnpm install

# Build WASM module (required first time)
pnpm run build:wasm

# Start development server
pnpm run dev
```

### Build Commands

```bash
# Development server with hot reload
pnpm run dev

# Build WASM module
pnpm run build:wasm

# Production build
pnpm run build

# Preview production build
pnpm run preview

# Report lint failures
pnpm run lint

# Format and auto-fix lint
pnpm run check

# Run tests
pnpm run test
```

### Project Structure

```
compress/
├── src/
│   ├── components/ui/     # React components (shadcn/ui + custom)
│   ├── lib/               # Utilities and WASM wrapper
│   └── routes/            # TanStack Router pages
├── wasm/                  # Rust/WASM source code
│   └── src/lib.rs         # Image processing functions
├── public/wasm/           # Compiled WASM output
└── public/                # Static assets
```

## How It Works

1. **Image Upload**: Drop or select an image file
2. **Format Detection**: Browser and WASM detect image format and dimensions
3. **HEIC Handling**: For HEIC files, browser-native APIs convert to JPEG first
4. **Processing**:
    - **By Dimensions**: Resizes to exact W×H with specified quality
    - **By File Size**: Uses binary search to find quality level that hits target size
5. **Preview**: Drag a comparison slider across the original and the result
6. **Download**: Save the result as `<name>-compressed.<ext>`

## WASM Module

The core image processing is written in Rust and compiled to WebAssembly using `wasm-bindgen`:

- `ImageSource`: Decodes an image once and re-encodes it across passes
- `ImageSource.encode()`: Encode at exact dimensions with quality control
- `ImageSource.fit_to_filesize()`: Binary search for the quality that hits a target file size
- Format detection for JPEG/PNG
- Lanczos3 resampling for high-quality resizing

To rebuild the WASM module after changing `wasm/src/lib.rs`:

```bash
pnpm run build:wasm
```

For local development with faster iteration:

```bash
cd wasm
wasm-pack build --dev --target web --out-dir ../public/wasm
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/short-description`)
3. Run `pnpm check`, `pnpm test` and `pnpm build` before pushing
4. Commit your changes with descriptive messages
5. Push to your branch and create a Pull Request

### Code Style

- TypeScript strict mode enabled
- Prettier for formatting (4 spaces, semicolons, single quotes)
- ESLint via `@tanstack/eslint-config`
- Files: kebab-case, Components: PascalCase, variables: camelCase

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [image](https://github.com/image-rs/image) crate for Rust image processing
- [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) for Rust-WASM interop
