#!/usr/bin/env node
// Builds the test images a verification run feeds to the app, using the running
// browser's own canvas encoder. Nothing but the browser is required, so a run
// never depends on ImageMagick being installed or on a photo checked into git.
//
//   node scripts/fixture.mjs [--out DIR]
//
// Writes sample.jpg and sample.png. The drawing is seeded, so it is the same
// picture every run and a size in a proof is comparable to the last one. Canvas
// rasterisation is not bit-exact across machines, so expect the encoded size to
// wander by a few hundred bytes, not by kilobytes.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const drive = resolve(here, 'drive.mjs');

const argv = process.argv.slice(2);
const outIndex = argv.indexOf('--out');
const outDir = resolve(
    outIndex === -1 ? `${repo}/.local/verify/fixtures` : argv[outIndex + 1],
);

if (!process.env.COMPRESS_CDP_PORT) {
    process.stderr.write(
        'Set COMPRESS_CDP_PORT (source .local/verify/session.env).\n',
    );
    process.exit(2);
}

const WIDTH = 1600;
const HEIGHT = 1200;

// Smooth gradients plus hard edges plus fine grain: gradients give JPEG
// something to compress, edges and grain give it something to lose, so a
// quality change moves the byte count instead of rounding to nothing.
const draw = `(() => {
  const c = document.createElement('canvas');
  c.width = ${WIDTH}; c.height = ${HEIGHT};
  const g = c.getContext('2d');
  let seed = 0x9e3779b9;
  const rnd = () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const sky = g.createLinearGradient(0, 0, 0, ${HEIGHT});
  sky.addColorStop(0, '#12324f');
  sky.addColorStop(0.55, '#d9884f');
  sky.addColorStop(1, '#2b1a12');
  g.fillStyle = sky;
  g.fillRect(0, 0, ${WIDTH}, ${HEIGHT});

  for (let i = 0; i < 40; i++) {
    g.globalAlpha = 0.35;
    g.fillStyle = 'hsl(' + Math.floor(rnd() * 360) + ' 70% ' + (25 + rnd() * 50) + '%)';
    g.beginPath();
    g.arc(rnd() * ${WIDTH}, rnd() * ${HEIGHT}, 20 + rnd() * 180, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  for (let i = 0; i < 24; i++) {
    g.strokeStyle = i % 2 ? '#f5f0e6' : '#101014';
    g.lineWidth = 1 + rnd() * 6;
    g.beginPath();
    g.moveTo(rnd() * ${WIDTH}, rnd() * ${HEIGHT});
    g.lineTo(rnd() * ${WIDTH}, rnd() * ${HEIGHT});
    g.stroke();
  }

  const grain = g.getImageData(0, 0, ${WIDTH}, ${HEIGHT});
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (rnd() - 0.5) * 34;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  g.putImageData(grain, 0, 0);

  return JSON.stringify({
    jpeg: c.toDataURL('image/jpeg', 0.96).split(',')[1],
    png: c.toDataURL('image/png').split(',')[1],
  });
})()`;

// Draw in a throwaway tab of its own, never in the app tab. Two page targets on
// the same URL would make every later drive.mjs command ambiguous, and drawing a
// 1600x1200 canvas inside the app tab leaves it in a state where the next
// DOM.setFileInputFiles silently fails to reach React.
const TITLE = 'compress-fixture';
const blank = `data:text/html,${encodeURIComponent(`<title>${TITLE}</title>`)}`;
const tabId = execFileSync('node', [drive, 'open', blank], {
    encoding: 'utf8',
}).trim();

let raw;
try {
    raw = execFileSync('node', [drive, 'eval', TITLE, draw], {
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024,
    });
} finally {
    await fetch(
        `http://127.0.0.1:${process.env.COMPRESS_CDP_PORT}/json/close/${tabId}`,
    ).catch(() => {});
}
const { jpeg, png } = JSON.parse(raw);

mkdirSync(outDir, { recursive: true });
for (const [name, data] of [
    ['sample.jpg', jpeg],
    ['sample.png', png],
]) {
    const file = resolve(outDir, name);
    const bytes = Buffer.from(data, 'base64');
    writeFileSync(file, bytes);
    process.stdout.write(`${file}\t${bytes.length} bytes\n`);
}
