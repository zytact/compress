#!/usr/bin/env node
// Read-only health check for the session launch.sh started. Answers "is this
// instance worth driving?" and exits non-zero when it is not.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const sessionFile = resolve(repo, '.local/verify/session.env');
const drive = resolve(here, 'drive.mjs');

const checks = [];
const record = (name, ok, detail) => {
    checks.push({ ok });
    process.stdout.write(
        `${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}\n`,
    );
};

let session;
try {
    session = Object.fromEntries(
        readFileSync(sessionFile, 'utf8')
            .split('\n')
            .filter((line) => line.startsWith('export '))
            .map((line) => line.slice(7).split(/=(.*)/s).slice(0, 2)),
    );
    record('session file', true, sessionFile);
} catch {
    record(
        'session file',
        false,
        `missing ${sessionFile}; run scripts/launch.sh`,
    );
    process.exit(1);
}

const env = { ...process.env, ...session };
const alive = (pid) => {
    try {
        process.kill(Number(pid), 0);
        return true;
    } catch {
        return false;
    }
};

record(
    'dev server process',
    alive(session.COMPRESS_DEV_PID),
    `pid ${session.COMPRESS_DEV_PID}`,
);
record(
    'browser process',
    alive(session.COMPRESS_BROWSER_PID),
    `pid ${session.COMPRESS_BROWSER_PID}`,
);

try {
    const response = await fetch(session.COMPRESS_APP_URL);
    record(
        'app responds',
        response.ok,
        `${session.COMPRESS_APP_URL} HTTP ${response.status}`,
    );
} catch (error) {
    record('app responds', false, error.message);
}

// The encoder is the whole app. A dev server that serves the page but 404s the
// wasm looks healthy until the first compression fails with a module error.
try {
    const response = await fetch(
        new URL('/wasm/image_compress_wasm_bg.wasm', session.COMPRESS_APP_URL),
    );
    const head = Buffer.from(await response.arrayBuffer()).subarray(0, 4);
    const isWasm = head.equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
    record(
        'wasm served',
        response.ok && isWasm,
        isWasm ? 'magic bytes ok' : `HTTP ${response.status}`,
    );
} catch (error) {
    record('wasm served', false, error.message);
}

try {
    const version = await fetch(
        `http://127.0.0.1:${session.COMPRESS_CDP_PORT}/json/version`,
    ).then((r) => r.json());
    record('cdp endpoint', true, version.Browser ?? version.product);
} catch (error) {
    record('cdp endpoint', false, error.message);
}

// Ask the page itself, not the command line we passed the browser. Server-
// rendered markup arrives long before the client bundle does, so this checks
// that React actually attached, not just that elements exist.
try {
    const title = execFileSync(
        'node',
        [
            drive,
            'eval',
            session.COMPRESS_APP_URL,
            'JSON.stringify({origin: location.origin, hydrated: Object.keys(document.body).some((k) => k.startsWith("__reactProps$"))})',
        ],
        { env, encoding: 'utf8' },
    );
    const state = JSON.parse(title);
    const expected = new URL(session.COMPRESS_APP_URL).origin;
    record(
        'app tab hydrated',
        state.hydrated && state.origin === expected,
        state.hydrated
            ? `origin ${state.origin}`
            : 'markup is there, React is not',
    );
} catch (error) {
    record('app tab hydrated', false, String(error.message).split('\n')[0]);
}

// Downloads have to land in this run's directory, or a proof reads the
// developer's real ~/Downloads and reports whatever was already there.
try {
    const prefs = JSON.parse(
        readFileSync(
            resolve(session.COMPRESS_VERIFY_PROFILE, 'Default/Preferences'),
            'utf8',
        ),
    );
    const dir = prefs.download?.default_directory;
    record(
        'downloads isolated',
        dir === session.COMPRESS_VERIFY_DOWNLOADS,
        dir ?? 'unset',
    );
} catch (error) {
    record('downloads isolated', false, error.message);
}

process.exit(checks.every((check) => check.ok) ? 0 : 1);
