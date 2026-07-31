#!/usr/bin/env node
// ============================================================
// SLIDE — Build-time Asset Processor  (#79)
// frontend/scripts/assets/process.mjs
//
// Moves chroma cleanup and downsizing OUT of the player's browser.
// assetResolver.loadDefringedSprite() currently runs a full
// getImageData -> per-pixel loop -> putImageData for every sprite on
// first paint. That work happens here, once, at build time.
//
// Layout contract:
//   art-src/                        master art, NEVER shipped
//   frontend/public/assets/runtime/  processed derivatives, shipped
//   frontend/src/assets/runtimeManifest.json  generated metadata
//
// Source art is COPIED to art-src before anything is written. Nothing
// is destructively overwritten.
//
// Usage:
//   node scripts/assets/process.mjs            # dry run
//   node scripts/assets/process.mjs --write
//   node scripts/assets/process.mjs --write --quality-pass=high
// ============================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ARGV = process.argv.slice(2);
const WRITE = ARGV.includes('--write');
const HIGH = ARGV.includes('--quality-pass=high');

const FRONTEND = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const REPO = path.resolve(FRONTEND, '..');
const LEGACY_ASSETS = path.join(FRONTEND, 'public/assets');
const RUNTIME_DIR = path.join(FRONTEND, 'public/assets/runtime');
const ART_SRC = path.join(REPO, 'art-src');
const MANIFEST_OUT = path.join(FRONTEND, 'src/assets/runtimeManifest.json');

export const RUNTIME_BUDGET_MB = 20;

// ─── Class budgets ───────────────────────────────────────────
// maxEdge derived from real on-screen size. projection.ts caps an actor at
// actorHeightRatio 0.26 of scene height; at 1080p / 2x DPR that is ~560px.
// 640 is already generous. Anything above it is pixels nobody sees.

export const ASSET_CLASSES = [
  { id: 'actor-street',    test: /characters\/street\//,                max: 640,  q: 88, alpha: true,  pivot: [0.5, 1.0] },
  { id: 'actor-fullbody',  test: /characters\/fullbody\//,              max: 640,  q: 88, alpha: true,  pivot: [0.5, 1.0] },
  { id: 'actor-topdown',   test: /characters\/topdown\//,               max: 384,  q: 88, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'portrait',        test: /characters\/portraits\//,             max: 512,  q: 92, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'vehicle-topdown', test: /vehicles\/topdown\//,                 max: 512,  q: 88, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'vehicle-street',  test: /vehicles\/(street|damage|overlays)\//,max: 768,  q: 88, alpha: true,  pivot: [0.5, 1.0] },
  { id: 'weapon-icon',     test: /weapons\//,                           max: 256,  q: 90, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'product-icon',    test: /products\//,                          max: 256,  q: 90, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'ui-icon',         test: /(ui\/icons|assets\/icons)\//,          max: 192,  q: 90, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'effect',          test: /effects\//,                           max: 512,  q: 88, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'env-topdown',     test: /environments\/topdown\//,             max: 1536, q: 82, alpha: false, pivot: [0.5, 0.5] },
  { id: 'env-street',      test: /environments\/street\//,              max: 1920, q: 82, alpha: false, pivot: [0.5, 1.0] },
  { id: 'legacy-sheet',    test: /assets\/sprites\//,                   max: 1024, q: 86, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'ui-overlay',      test: /generated\/ui\//,                     max: 1024, q: 86, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'backdrop',        test: /(bg_|_frame|game_logo|crosshair)/,    max: 1280, q: 80, alpha: true,  pivot: [0.5, 0.5] },
  { id: 'misc',            test: /.*/,                                  max: 512,  q: 86, alpha: true,  pivot: [0.5, 0.5] },
];

// Never reaches the browser.
const QUARANTINE = [
  { rx: /_original\.(png|webp|jpe?g)$/i, why: 'source-resolution duplicate' },
  { rx: /gang_members\.png$/i,           why: 'legacy sprite sheet, superseded by manifest actors' },
];

// Fringe threshold — fraction of edge pixels that are dominantly green.
export const FRINGE_THRESHOLD = 0.02;

function classify(rel) {
  const norm = rel.replace(/\\/g, '/');
  return ASSET_CLASSES.find((c) => c.test.test(norm)) ?? null;
}

function parseName(file) {
  // character_dealer_male_blacktee_street_aim_v001.png
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const parts = base.split('_');
  const STATES = ['idle','walk','aim','fire','reload','hit','downed','dead','arrested','seated','driving','alert','front','side'];
  const ROLES  = ['dealer','shooter','enforcer','lookout','driver','recruit','chemist','runner','boss','civilian','rival'];
  return {
    role:  parts.find((p) => ROLES.includes(p))  ?? null,
    state: parts.reverse().find((p) => STATES.includes(p)) ?? null,
  };
}

async function walk(dir, out = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p === RUNTIME_DIR) continue; // never reprocess our own output
      await walk(p, out);
    } else if (/\.(png|webp|jpe?g)$/i.test(e.name)) out.push(p);
  }
  return out;
}

// ─── Chroma analysis + cleanup ───────────────────────────────

export function analysePixels(px, width, height) {
  let opaque = 0, greenish = 0, edgeGreen = 0, edge = 0, transparent = 0;
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const a = px[i + 3];
    if (a === 0) { transparent++; continue; }
    opaque++;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (g > 110 && g > Math.max(r, b) * 1.4) greenish++;

    const x = p % width, y = (p / width) | 0;
    const isEdge = x < 2 || y < 2 || x > width - 3 || y > height - 3;
    if (isEdge) {
      edge++;
      if (g > 100 && g > Math.max(r, b) * 1.25) edgeGreen++;
    }
  }
  return {
    hasAlpha: transparent > 0,
    alphaRatio: transparent / (px.length / 4),
    greenRatio: opaque ? greenish / opaque : 0,
    fringeRatio: edge ? edgeGreen / edge : 0,
  };
}

/**
 * Detect a uniform matte background from the border ring.
 * The generated library is NOT on green screen — it is on flat white
 * (255,255,255) or near-black, with 98–100% uniform borders. Chroma
 * keying finds nothing. Returns null when the border is not uniform.
 */
export function detectMatte(px, width, height) {
  const ring = [];
  const stepX = Math.max(1, Math.floor(width / 160));
  const stepY = Math.max(1, Math.floor(height / 160));
  const at = (x, y) => { const i = (y * width + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  for (let x = 0; x < width; x += stepX) { ring.push(at(x, 0)); ring.push(at(x, height - 1)); }
  for (let y = 0; y < height; y += stepY) { ring.push(at(0, y)); ring.push(at(width - 1, y)); }

  const opaque = ring.filter((c) => c[3] > 250);
  if (opaque.length < ring.length * 0.9) return null;   // already has alpha at the edge

  const mean = [0, 1, 2].map((k) => Math.round(opaque.reduce((s, c) => s + c[k], 0) / opaque.length));
  const uniform = opaque.filter((c) => Math.max(...[0, 1, 2].map((k) => Math.abs(c[k] - mean[k]))) < 18);
  if (uniform.length / opaque.length < 0.9) return null; // busy background, not a matte

  return { color: mean, uniformity: uniform.length / opaque.length };
}

/**
 * Flood fill inward from the border to remove the matte.
 * Deliberately NOT a global colour threshold: a global threshold on white
 * punches holes through eyes, teeth, sneakers and chrome. Only background
 * connected to the frame edge is removed.
 */
function floodMatte(px, width, height, matte, tol = 26) {
  const seen = new Uint8Array(width * height);
  const stack = [];
  const close = (i) => Math.max(
    Math.abs(px[i] - matte[0]), Math.abs(px[i + 1] - matte[1]), Math.abs(px[i + 2] - matte[2]),
  ) <= tol;

  for (let x = 0; x < width; x++) { stack.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y++) { stack.push(y * width, y * width + width - 1); }

  let cleared = 0;
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!close(i)) continue;
    px[i + 3] = 0;
    cleared++;
    const x = p % width, y = (p / width) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  // Feather: any surviving pixel touching a cleared pixel gets partial alpha
  // so the cutout does not read as a hard sticker edge.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x, i = p * 4;
      if (px[i + 3] === 0) continue;
      let open = 0;
      if (px[(p - 1) * 4 + 3] === 0) open++;
      if (px[(p + 1) * 4 + 3] === 0) open++;
      if (px[(p - width) * 4 + 3] === 0) open++;
      if (px[(p + width) * 4 + 3] === 0) open++;
      if (open >= 2) px[i + 3] = 140;
      else if (open === 1) px[i + 3] = 205;
    }
  }
  return cleared;
}

async function cleanup(buf, needsAlpha) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8ClampedArray(data);
  const before = analysePixels(px, info.width, info.height);

  let keyed = 0;
  let matteUsed = null;

  if (needsAlpha) {
    if (!before.hasAlpha) {
      const matte = detectMatte(px, info.width, info.height);
      if (matte) {
        matteUsed = matte.color;
        keyed = floodMatte(px, info.width, info.height, matte.color);
      }
    }
    // Green spill suppression still applies to genuinely green-fringed art.
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a === 0) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const maxRB = Math.max(r, b);
      if (g > 90 && g > maxRB * 1.2) px[i + 1] = maxRB;
      if (a > 0 && a < 24) px[i + 3] = 0;
    }
  }

  const after = analysePixels(px, info.width, info.height);
  return {
    pipeline: sharp(Buffer.from(px.buffer), { raw: { width: info.width, height: info.height, channels: 4 } }),
    width: info.width, height: info.height, before, after, keyed, matteUsed,
  };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const files = await walk(LEGACY_ASSETS);
  const mb = (b) => (b / 1048576).toFixed(2) + ' MB';

  console.log(`\nSLIDE asset processor — ${files.length} source images`);
  console.log(WRITE ? 'MODE: WRITE' : 'MODE: DRY RUN (pass --write to apply)');
  console.log(`Quality pass: ${HIGH ? 'high' : 'standard'}\n`);

  let beforeBytes = 0, afterBytes = 0;
  const entries = [], quarantined = [], unclassified = [], repaired = [];

  for (const abs of files) {
    const rel = path.relative(LEGACY_ASSETS, abs).replace(/\\/g, '/');
    const size = (await fs.stat(abs)).size;
    beforeBytes += size;

    const q = QUARANTINE.find((x) => x.rx.test(path.basename(abs)));
    if (q) {
      quarantined.push({ rel, size, why: q.why });
      if (WRITE) {
        const dest = path.join(ART_SRC, rel);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(abs, dest);
        await fs.unlink(abs);
      }
      continue;
    }

    const cls = classify(rel);
    if (!cls) { unclassified.push({ rel, size }); afterBytes += size; continue; }

    const buf = await fs.readFile(abs);
    const { pipeline, width, height, before, after, keyed, matteUsed } = await cleanup(buf, cls.alpha);

    if (cls.alpha && !before.hasAlpha) {
      repaired.push({ rel, keyed, dims: `${width}x${height}`, matte: matteUsed, total: width * height });
    }

    const maxEdge = Math.max(width, height);
    const targetEdge = Math.min(maxEdge, HIGH ? Math.round(cls.max * 1.5) : cls.max);
    const resized = maxEdge > targetEdge
      ? pipeline.resize({
          width:  width >= height ? targetEdge : undefined,
          height: height > width  ? targetEdge : undefined,
          fit: 'inside', kernel: 'lanczos3',
        })
      : pipeline;

    const out = await resized
      .webp({ quality: HIGH ? Math.min(97, cls.q + 5) : cls.q, alphaQuality: 100, effort: 6 })
      .toBuffer();

    const meta = await sharp(out).metadata();
    afterBytes += out.length;

    const runtimeRel = rel.replace(/\.(png|jpe?g)$/i, '.webp');
    const { role, state } = parseName(rel);

    entries.push({
      id: runtimeRel.replace(/\.[^.]+$/, '').replace(/[\/]/g, '.'),
      runtimePath: `/assets/runtime/${runtimeRel}`,
      sourcePath: `art-src/${rel}`,
      class: cls.id,
      role, state,
      width: meta.width, height: meta.height,
      bytes: out.length,
      hasAlpha: after.hasAlpha || Boolean(meta.hasAlpha),
      fringeRatio: Number(after.fringeRatio.toFixed(5)),
      pivot: { x: cls.pivot[0], y: cls.pivot[1] },
      alphaRepaired: cls.alpha && !before.hasAlpha,
    });

    if (WRITE) {
      const srcDest = path.join(ART_SRC, rel);
      await fs.mkdir(path.dirname(srcDest), { recursive: true });
      await fs.copyFile(abs, srcDest);            // preserve master first
      const outPath = path.join(RUNTIME_DIR, runtimeRel);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, out);
      await fs.unlink(abs);                        // remove oversized original from public/
    }
  }

  // ─── Report ────────────────────────────────────────────────
  const byClass = {};
  for (const e of entries) {
    byClass[e.class] ??= { n: 0, bytes: 0 };
    byClass[e.class].n++; byClass[e.class].bytes += e.bytes;
  }

  console.log('Runtime package by class');
  console.log('─'.repeat(64));
  for (const [k, v] of Object.entries(byClass).sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${k.padEnd(18)} ${String(v.n).padStart(3)} files  ${mb(v.bytes).padStart(10)}`);
  }

  console.log('\nLargest 10 runtime files');
  console.log('─'.repeat(64));
  for (const e of [...entries].sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
    console.log(`  ${mb(e.bytes).padStart(10)}  ${String(e.width + 'x' + e.height).padEnd(11)} ${e.runtimePath}`);
  }

  if (repaired.length) {
    console.log(`\nALPHA REPAIRED — ${repaired.length} sprites shipped with NO transparency and were chroma-keyed:`);
    for (const r of repaired.slice(0, 30)) {
      const pct = r.total ? (100 * r.keyed / r.total).toFixed(1) : '0.0';
      const m = r.matte ? `matte rgb(${r.matte.join(',')})` : 'NO UNIFORM MATTE';
      const flag = r.keyed === 0 ? '  <-- UNRECOVERABLE' : '';
      console.log(`  ${r.dims.padEnd(11)} ${pct.padStart(5)}% removed  ${m.padEnd(24)} ${r.rel}${flag}`);
    }
    const dead = repaired.filter((r) => r.keyed === 0);
    if (dead.length) {
      console.log(`  ${dead.length} sprite(s) have no uniform matte and CANNOT be auto-cut.`);
      console.log('  Those must be regenerated with true transparency.');
    }
  }

  if (quarantined.length) {
    const qb = quarantined.reduce((s, x) => s + x.size, 0);
    console.log(`\nQUARANTINED — ${quarantined.length} files (${mb(qb)}) moved to art-src/, not shipped:`);
    for (const x of quarantined.slice(0, 10)) console.log(`  ${mb(x.size).padStart(10)}  ${x.rel}  (${x.why})`);
    if (quarantined.length > 10) console.log(`  ... and ${quarantined.length - 10} more`);
  }

  if (unclassified.length) {
    console.log(`\nUNCLASSIFIED — ${unclassified.length} files left untouched (add a rule to ASSET_CLASSES):`);
    for (const x of unclassified.slice(0, 10)) console.log(`  ${mb(x.size).padStart(10)}  ${x.rel}`);
  }

  const budgetOk = afterBytes / 1048576 <= RUNTIME_BUDGET_MB;
  console.log('\n' + '═'.repeat(64));
  console.log(`RUNTIME TOTAL   ${mb(beforeBytes)}  →  ${mb(afterBytes)}`);
  console.log(`REDUCTION       ${(100 - (afterBytes / beforeBytes) * 100).toFixed(1)}%`);
  console.log(`BUDGET          ${RUNTIME_BUDGET_MB} MB — ${budgetOk ? 'PASS' : 'FAIL'}`);
  console.log('═'.repeat(64));

  if (WRITE) {
    const manifest = {
      generatedAt: new Date().toISOString(),
      budgetMB: RUNTIME_BUDGET_MB,
      totalBytes: afterBytes,
      qualityPass: HIGH ? 'high' : 'standard',
      entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
    };
    await fs.mkdir(path.dirname(MANIFEST_OUT), { recursive: true });
    await fs.writeFile(MANIFEST_OUT, JSON.stringify(manifest, null, 2));
    console.log(`\nWrote ${entries.length} entries → src/assets/runtimeManifest.json`);
    console.log(`Masters preserved  → art-src/`);
    console.log(`Runtime derivatives→ public/assets/runtime/`);
    console.log('\nNEXT: remove loadDefringedSprite() from services/assetResolver.ts —');
    console.log('      the matte is baked out, so that runtime pass is now dead cost.');
  } else {
    console.log('\nDry run complete. Nothing written.');
  }
}

// Only run when invoked directly — audit.mjs imports this module for its
// class table and pixel analyser and must not trigger a full pass.
const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
