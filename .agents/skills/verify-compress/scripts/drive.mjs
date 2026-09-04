#!/usr/bin/env node
// CDP driver for the compress verification skill. No dependencies: Node 24 ships
// a global WebSocket and fetch.
//
//   drive.mjs targets                        list every debuggable target
//   drive.mjs open   <url>                   open a tab and print its target id
//   drive.mjs eval   <match> <expression>    evaluate in the first target whose url contains <match>
//   drive.mjs text   <match>                 print document.body.innerText
//   drive.mjs shot   [--full] <match> <file> save a PNG screenshot
//   drive.mjs wait   <match> <needle> [ms]   poll innerText until <needle> appears
//   drive.mjs upload <match> <selector> <f>  hand a real file to a file input
//   drive.mjs click  <match> <selector>      click an element
//   drive.mjs fill   <match> <selector> <v>  set a React-controlled input's value
//   drive.mjs key    <match> <selector> <k> [n]  focus and press a key n times
//   drive.mjs close                          ask the browser to exit
//
// The port comes from COMPRESS_CDP_PORT, or --port as the first argument.

const argv = process.argv.slice(2);
let port = process.env.COMPRESS_CDP_PORT;
if (argv[0] === '--port') {
    port = argv[1];
    argv.splice(0, 2);
}
if (!port) fail('Set COMPRESS_CDP_PORT or pass --port <port>.');
const base = `http://127.0.0.1:${port}`;

function fail(message) {
    process.stderr.write(`${message}\n`);
    process.exit(2);
}

async function targets() {
    const response = await fetch(`${base}/json/list`).catch((error) => {
        fail(`No CDP endpoint on ${base}: ${error.message}`);
    });
    return response.json();
}

// The app owns several targets at once: the page and its compression worker.
// Prefer the page, or an eval lands in the worker where there is no document.
// Non-page targets stay reachable, which is how the worker itself gets driven.
async function findTarget(match) {
    const deadline = Date.now() + 10_000;
    for (;;) {
        const matches = (await targets()).filter(
            (target) =>
                target.webSocketDebuggerUrl &&
                (target.url.includes(match) || target.title === match),
        );
        const hit =
            matches.find((target) => target.type === 'page') ?? matches[0];
        if (hit) return hit;
        if (Date.now() > deadline)
            fail(`No target matching ${JSON.stringify(match)}.`);
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
}

// One socket, many commands. Remote object ids are only valid for the session
// that produced them, so `upload` has to evaluate and set files on one socket.
async function session(target, run) {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map();

    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error)
            entry.reject(
                new Error(`${entry.method}: ${message.error.message}`),
            );
        else entry.resolve(message.result);
    });

    const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`${method} timed out`));
            }, 60_000);
            pending.set(id, { resolve, reject, timer, method });
            socket.send(JSON.stringify({ id, method, params }));
        });

    try {
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, { once: true });
            socket.addEventListener(
                'error',
                () => reject(new Error('CDP socket failed')),
                { once: true },
            );
        });
        return await run(send);
    } finally {
        for (const entry of pending.values()) clearTimeout(entry.timer);
        socket.close();
    }
}

async function evaluate(match, expression, options = {}) {
    const target = await findTarget(match);
    return session(target, async (send) => {
        const result = await send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
            ...options,
        });
        if (result.exceptionDetails)
            fail(
                result.exceptionDetails.exception?.description ??
                    'Evaluation threw.',
            );
        return result.result.value;
    });
}

const quote = (value) => JSON.stringify(value);

// Finds an element or fails inside the page, so a bad selector is an error at
// the point of use rather than a silent no-op the caller reads as success.
const pick = (selector) =>
    `(() => { const el = document.querySelector(${quote(selector)});
    if (!el) throw new Error('No element matching ' + ${quote(selector)});
    return el; })()`;

// Enough of a key table for the controls this app exposes to the keyboard.
const KEYS = {
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    PageUp: 33,
    PageDown: 34,
    Home: 36,
    End: 35,
    Enter: 13,
    Tab: 9,
    Escape: 27,
};

const [command, ...rest] = argv;

if (command === 'targets') {
    for (const target of await targets())
        process.stdout.write(`${target.type}\t${target.url}\n`);
} else if (command === 'open') {
    const [url] = rest;
    if (!url) fail('Usage: drive.mjs open <url>');
    const response = await fetch(
        `${base}/json/new?${encodeURIComponent(url)}`,
        { method: 'PUT' },
    );
    if (!response.ok) fail(`Could not open ${url}: HTTP ${response.status}`);
    const target = await response.json();
    // A new target starts on the initial blank document. Returning before the
    // real document settles hands the caller a page with no React root yet.
    const deadline = Date.now() + 60_000;
    for (;;) {
        const current = (await targets()).find((item) => item.id === target.id);
        if (!current)
            fail(`Target ${target.id} disappeared while loading ${url}.`);
        if (current.url !== 'about:blank') {
            const state = await session(current, (send) =>
                send('Runtime.evaluate', {
                    expression: 'document.readyState',
                    returnByValue: true,
                }),
            ).catch(() => undefined);
            if (state?.result?.value === 'complete') break;
        }
        if (Date.now() > deadline)
            fail(`${url} did not finish loading in 60s.`);
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    process.stdout.write(`${target.id}\n`);
} else if (command === 'close') {
    const info = await fetch(`${base}/json/version`).then((response) =>
        response.json(),
    );
    await session({ webSocketDebuggerUrl: info.webSocketDebuggerUrl }, (send) =>
        send('Browser.close'),
    ).catch(() => {});
    process.stdout.write('closing\n');
} else if (command === 'eval') {
    const [match, expression] = rest;
    if (!match || !expression)
        fail('Usage: drive.mjs eval <match> <expression>');
    const value = await evaluate(match, expression);
    process.stdout.write(
        `${typeof value === 'string' ? value : JSON.stringify(value)}\n`,
    );
} else if (command === 'text') {
    const [match] = rest;
    if (!match) fail('Usage: drive.mjs text <match>');
    process.stdout.write(
        `${await evaluate(match, 'document.body.innerText')}\n`,
    );
} else if (command === 'shot') {
    const full = rest[0] === '--full' && rest.shift();
    const [match, file] = rest;
    if (!match || !file) fail('Usage: drive.mjs shot [--full] <match> <file>');
    const target = await findTarget(match);
    const { data } = await session(target, async (send) => {
        // Chromium stalls captureScreenshot on a tab that is not rendering.
        await send('Page.bringToFront').catch(() => {});
        if (!full) return send('Page.captureScreenshot', { format: 'png' });
        // The workspace is taller than the window, and the byte readout lives below
        // the fold. Capture the whole document so the numbers are in the proof.
        const { cssContentSize } = await send('Page.getLayoutMetrics');
        return send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            clip: {
                x: 0,
                y: 0,
                width: cssContentSize.width,
                height: cssContentSize.height,
                scale: 1,
            },
        });
    });
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(data, 'base64'));
    process.stdout.write(`${file}\n`);
} else if (command === 'wait') {
    const [match, needle, timeout = '20000'] = rest;
    if (!match || !needle)
        fail('Usage: drive.mjs wait <match> <needle> [timeoutMs]');
    const deadline = Date.now() + Number(timeout);
    for (;;) {
        const text = await evaluate(match, 'document.body.innerText');
        if (String(text).includes(needle)) break;
        if (Date.now() > deadline)
            fail(`Timed out waiting for ${JSON.stringify(needle)}.`);
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    process.stdout.write(`${needle}\n`);
} else if (command === 'upload') {
    const [match, selector, file] = rest;
    if (!match || !selector || !file)
        fail('Usage: drive.mjs upload <match> <selector> <file>');
    const { resolve } = await import('node:path');
    const { access } = await import('node:fs/promises');
    const absolute = resolve(file);
    await access(absolute).catch(() => fail(`No file at ${absolute}`));
    const target = await findTarget(match);
    await session(target, async (send) => {
        // DOM.setFileInputFiles needs the DOM agent to hold a document.
        await send('DOM.enable');
        await send('DOM.getDocument', { depth: 0 });
        // The app is server-rendered, so the input is in the markup before React
        // attaches to it. Setting files in that window fires a change event into
        // nothing: the upload reports success and the page never reacts. React
        // stamps __reactProps$ onto the node when it attaches, so wait for that
        // rather than for readyState, which went complete long before.
        const hydrated = Date.now() + 30_000;
        for (;;) {
            const probe = await send('Runtime.evaluate', {
                expression: `(() => { const el = document.querySelector(${quote(selector)});
                    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$')); })()`,
                returnByValue: true,
            });
            if (probe.result.value === true) break;
            if (Date.now() > hydrated)
                fail(
                    `${selector} never got a React handler; is the app hydrated?`,
                );
            await new Promise((r) => setTimeout(r, 200));
        }
        // The app clears the input inside its own change handler, so afterwards
        // an accepted file and a file that never arrived look identical. Record
        // the count from inside the event, on window, because the input this
        // selector matches is unmounted and replaced once a file loads.
        const handle = await send('Runtime.evaluate', {
            expression: `(() => { const el = ${pick(selector)};
                window.__driveUploadFiles = 0;
                el.addEventListener('change',
                    (e) => { window.__driveUploadFiles = e.target.files.length; },
                    { capture: true, once: true });
                return el; })()`,
        });
        if (handle.exceptionDetails)
            fail(
                handle.exceptionDetails.exception?.description ??
                    'Selector threw.',
            );
        await send('DOM.setFileInputFiles', {
            files: [absolute],
            objectId: handle.result.objectId,
        });
        const accepted = await send('Runtime.evaluate', {
            expression: 'window.__driveUploadFiles',
            returnByValue: true,
        });
        if (!accepted.result.value)
            fail(`${selector} did not receive ${absolute}.`);
    });
    process.stdout.write(`${absolute}\n`);
} else if (command === 'click') {
    const [match, selector] = rest;
    if (!match || !selector) fail('Usage: drive.mjs click <match> <selector>');
    await evaluate(match, `${pick(selector)}.click()`);
    process.stdout.write(`clicked ${selector}\n`);
} else if (command === 'fill') {
    const [match, selector, value] = rest;
    if (!match || !selector || value === undefined)
        fail('Usage: drive.mjs fill <match> <selector> <value>');
    // React installs its own value setter on the element, so assigning `.value`
    // directly updates the DOM and leaves React's copy stale. Go through the
    // prototype setter and dispatch the event React actually listens for.
    await evaluate(
        match,
        `(() => { const el = ${pick(selector)};
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${quote(value)});
      el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
    process.stdout.write(`${selector}=${value}\n`);
} else if (command === 'key') {
    const [match, selector, key, count = '1'] = rest;
    if (!match || !selector || !key)
        fail('Usage: drive.mjs key <match> <selector> <key> [count]');
    const code = KEYS[key];
    if (code === undefined)
        fail(`Unknown key ${key}. Known: ${Object.keys(KEYS).join(', ')}`);
    const target = await findTarget(match);
    await session(target, async (send) => {
        await send('Page.bringToFront').catch(() => {});
        const focused = await send('Runtime.evaluate', {
            expression: `${pick(selector)}.focus()`,
        });
        if (focused.exceptionDetails)
            fail(
                focused.exceptionDetails.exception?.description ??
                    'Selector threw.',
            );
        for (let i = 0; i < Number(count); i++) {
            for (const type of ['rawKeyDown', 'keyUp']) {
                await send('Input.dispatchKeyEvent', {
                    type,
                    key,
                    code: key,
                    windowsVirtualKeyCode: code,
                    nativeVirtualKeyCode: code,
                });
            }
        }
    });
    process.stdout.write(`${key} x${count}\n`);
} else {
    fail(
        'Usage: drive.mjs targets|open|eval|text|shot|wait|upload|click|fill|key|close ...',
    );
}
