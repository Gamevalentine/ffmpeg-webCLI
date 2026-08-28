// WASM benchmark for ffmpeg-webCLI, run in real Chrome. Appends to results_wasm_chrome.csv per run.
import { chromium } from 'playwright-core';
import fs from 'fs';

const CSV = new URL('./results_wasm_chrome.csv', import.meta.url).pathname;
const APP = 'https://tejaswigowda.com/ffmpeg-webCLI/';
const VID = new URL('./video/', import.meta.url).pathname;

if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, 'op,duration,condition,run,seconds,out_bytes\n');
const log = (s) => { console.log(new Date().toISOString().slice(11, 19), s); };
const row = (o, d, r, res) =>
  fs.appendFileSync(CSV, `${o},${d},wasm,${r},${res.seconds ?? 'OOM'},${res.out_bytes ?? 0}\n`);

const CLIPS = { '60s': ['small.mp4', 30.146], '150s': ['medium.mp4', 75.021], '600s': ['long.mp4', 298.272] };

// [op, durations, runs, argsBuilder(input, half) -> [args, out]]
const CELLS = [
  ['trim_copy', ['60s', '150s', '600s'], 3, (i, h) => [['-ss', '0', '-i', i, '-t', String(h), '-c:v', 'copy', '-c:a', 'copy', 'o.mp4'], 'o.mp4']],
  ['stripmeta_copy', ['60s', '150s', '600s'], 3, (i) => [['-i', i, '-map_metadata', '-1', '-c:v', 'copy', '-c:a', 'copy', 'o.mp4'], 'o.mp4']],
  ['audio_mp3', ['60s'], 2, (i) => [['-i', i, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', 'o.mp3'], 'o.mp3']],
  ['gif_480_15', ['60s'], 2, (i) => [['-i', i, '-vf', 'fps=15,scale=480:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-an', 'o.gif'], 'o.gif']],
  ['webm_vp9', ['60s'], 2, (i) => [['-i', i, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-c:a', 'libopus', 'o.webm'], 'o.webm']],
  ['compress_crf28', ['60s', '150s', '600s'], 2, (i) => [['-i', i, '-vf', 'scale=1920:1080', '-c:v', 'libx264', '-crf', '28', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', 'o.mp4'], 'o.mp4']],
  ['rotate90', ['60s', '150s', '600s'], 2, (i) => [['-i', i, '-vf', 'transpose=1', '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', 'o.mp4'], 'o.mp4']],
];

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage();
await page.goto(APP, { waitUntil: 'load' });
const ua = await page.evaluate(() => navigator.userAgent);
log('UA: ' + ua);

async function initInstance() {
  await page.evaluate(async () => {
    const { FFmpeg } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
    const ff = new FFmpeg();
    const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    await ff.load({
      classWorkerURL: new URL('./worker.js', location.href).href,
      coreURL: `${coreBase}/ffmpeg-core.js`,
      wasmURL: `${coreBase}/ffmpeg-core.wasm`,
    });
    window.__ff = ff;
    window.__loadClipFromInput = async (name) => {
      const f = document.getElementById('__benchInput').files[0];
      if (!f) throw new Error('no file in #__benchInput');
      const buf = new Uint8Array(await f.arrayBuffer());
      if (buf.length < 1e6) throw new Error(`clip too small: ${buf.length}B`);
      try { await ff.deleteFile(name); } catch (_) {}
      await ff.writeFile(name, buf);
      return buf.length;
    };
    if (!document.getElementById('__benchInput')) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.id = '__benchInput'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    window.__timedExec = async (args, outName) => {
      const t0 = performance.now();
      const rc = await window.__ff.exec(args);
      const dt = (performance.now() - t0) / 1000;
      let size = 0;
      try { const d = await window.__ff.readFile(outName); size = d.length; await window.__ff.deleteFile(outName); } catch (_) {}
      if (rc !== 0 || size === 0) throw new Error(`exec failed rc=${rc} out=${size}`);
      return { seconds: +dt.toFixed(2), out_bytes: size };
    };
  });
}

let currentClip = null;
async function ensureClip(dur) {
  if (currentClip === dur) return;
  const [file] = CLIPS[dur];
  await page.setInputFiles('#__benchInput', VID + file);
  const n = await page.evaluate(() => window.__loadClipFromInput('in.mp4'));
  log(`loaded ${file} (${n} bytes)`);
  currentClip = dur;
}

async function recover(dur) {
  log('recovering instance after crash…');
  try { await page.evaluate(() => { try { window.__ff.terminate(); } catch (_) {} }); } catch (_) {}
  await initInstance();
  currentClip = null;
  await ensureClip(dur);
  // discarded warm-up after reload
  await page.evaluate(() => window.__timedExec(['-ss', '0', '-i', 'in.mp4', '-t', '10', '-c:v', 'copy', '-c:a', 'copy', 'w.mp4'], 'w.mp4'));
}

await initInstance();
await ensureClip('60s');
await page.evaluate(() => window.__timedExec(['-ss', '0', '-i', 'in.mp4', '-t', '10', '-c:v', 'copy', '-c:a', 'copy', 'w.mp4'], 'w.mp4'));
log('warm-up done');

for (const [op, durs, runs, build] of CELLS) {
  for (const dur of durs) {
    await ensureClip(dur);
    const [args, out] = build('in.mp4', CLIPS[dur][1]);
    for (let r = 1; r <= runs; r++) {
      try {
        const res = await page.evaluate(({ args, out }) => window.__timedExec(args, out), { args, out });
        row(op, dur, r, res);
        log(`${op} ${dur} run${r}: ${res.seconds}s`);
      } catch (e) {
        row(op, dur, r, {});
        log(`${op} ${dur} run${r}: CRASH ${String(e).slice(0, 120)}`);
        await recover(dur);
        if (op === 'webm_vp9') break; // reproducible OOM; don't retry remaining runs
      }
    }
  }
}
log('ALL DONE');
await browser.close();
process.exit(0);
