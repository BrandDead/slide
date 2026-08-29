#!/usr/bin/env node
// ============================================================
// SLIDE — Asset Audit / CI Gate  (#79)
// frontend/scripts/assets/audit.mjs
//
// Exits non-zero when any of the five required conditions fail:
//   1. a required composited sprite has no alpha
//   2. a required manifest entry is missing on disk
//   3. a production sprite exceeds the fringe threshold
//   4. an asset exceeds its declared runtime dimensions
//   5. runtime assets exceed the budget without an approved exception
//
// Approved exceptions live in scripts/assets/exceptions.json and must
// carry a reason. An exception without a reason is itself a failure.
//
// Usage: node scripts/assets/audit.mjs [--json]
// ============================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { ASSET_CLASSES, RUNTIME_BUDGET_MB, FRINGE_THRESHOLD, analysePixels } from './process.mjs';

const JSON_OUT = process.argv.includes('--json');
const FRONTEND = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const RUNTIME_DIR = path.join(FRONTEND, 'public/assets/runtime');
const PACKAGE_DIR = path.join(FRONTEND, 'public/assets/packages');
const MANIFEST = path.join(FRONTEND, 'src/assets/runtimeManifest.json');
const EXCEPTIONS = path.join(FRONTEND, 'scripts/assets/exceptions.json');

// Classes whose sprites are composited over a scene and therefore MUST
// carry alpha. Environment plates are full-bleed and are exempt.
const MUST_HAVE_ALPHA = new Set([
  'actor-street', 'actor-fullbody', 'actor-topdown',
  'vehicle-topdown', 'vehicle-street', 'weapon-icon',
  'product-icon', 'effect',
]);

const errors = [];
const warnings = [];

function fail(code, msg) { errors.push({ code, msg }); }
function warn(code, msg) { warnings.push({ code, msg }); }

async function loadJson(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return fallback; }
}

async function main() {
  const manifest = await loadJson(MANIFEST, null);
  const exceptions = await loadJson(EXCEPTIONS, { assets: {}, budgetMB: null });

  if (!manifest) {
    fail('E_NO_MANIFEST', 'src/assets/runtimeManifest.json missing. Run: node scripts/assets/process.mjs --write');
    return report();
  }

  for (const [id, ex] of Object.entries(exceptions.assets ?? {})) {
    if (!ex.reason) fail('E_EXCEPTION_NO_REASON', `Exception for "${id}" has no reason.`);
  }

  let totalBytes = 0;
  let orphanBytes = 0;
  let packageBytes = 0;
  let checked = 0;

  for (const entry of manifest.entries) {
    const abs = path.join(FRONTEND, 'public', entry.runtimePath.replace(/^\//, ''));
    const ex = exceptions.assets?.[entry.id];

    // (2) manifest entry must exist on disk
    let stat;
    try { stat = await fs.stat(abs); }
    catch {
      fail('E_MISSING_FILE', `Manifest entry has no file on disk: ${entry.runtimePath}`);
      continue;
    }
    totalBytes += stat.size;
    checked++;

    const cls = ASSET_CLASSES.find((c) => c.id === entry.class);
    if (!cls) { warn('W_UNKNOWN_CLASS', `${entry.id} has unknown class "${entry.class}"`); continue; }

    const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8ClampedArray(data);
    const stats = analysePixels(px, info.width, info.height);

    // (1) composited sprites must have alpha
    if (MUST_HAVE_ALPHA.has(entry.class) && !stats.hasAlpha) {
      if (ex?.allowNoAlpha) warn('W_NO_ALPHA_EXCEPTED', `${entry.id} has no alpha (excepted: ${ex.reason})`);
      else fail('E_NO_ALPHA', `${entry.id} is a composited sprite with NO alpha channel — it will render as an opaque rectangle. ${entry.runtimePath}`);
    }

    // (3) fringe threshold
    if (stats.fringeRatio > FRINGE_THRESHOLD) {
      if (ex?.allowFringe) warn('W_FRINGE_EXCEPTED', `${entry.id} fringe ${(stats.fringeRatio * 100).toFixed(1)}% (excepted: ${ex.reason})`);
      else fail('E_FRINGE', `${entry.id} edge fringe ${(stats.fringeRatio * 100).toFixed(1)}% exceeds ${(FRINGE_THRESHOLD * 100).toFixed(1)}%`);
    }

    // (4) runtime dimensions
    const maxEdge = Math.max(info.width, info.height);
    if (maxEdge > cls.max) {
      if (ex?.allowOversize) warn('W_OVERSIZE_EXCEPTED', `${entry.id} ${maxEdge}px (excepted: ${ex.reason})`);
      else fail('E_OVERSIZE', `${entry.id} is ${maxEdge}px, exceeds ${cls.max}px for class "${cls.id}"`);
    }
  }

  // Any runtime file NOT in the manifest is unaccounted weight.
  const onDisk = [];
  async function walk(d) {
    let es; try { es = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else onDisk.push(p);
    }
  }
  await walk(RUNTIME_DIR);
  const runtimeFileCount = onDisk.length;
  await walk(PACKAGE_DIR);
  const manifestPaths = new Set(manifest.entries.map((e) => path.join(FRONTEND, 'public', e.runtimePath.replace(/^\//, ''))));
  for (const p of onDisk) {
    if (!manifestPaths.has(p)) {
      const isPackageFile = p.startsWith(PACKAGE_DIR + path.sep);
      if (!isPackageFile) warn('W_ORPHAN', `Runtime file not in manifest: ${path.relative(FRONTEND, p)}`);
      // Unregistered runtime files and production-package files SHIP to
      // the browser, so both must count against the global budget. Package
      // contents are validated by validate-packages.mjs rather than the
      // image-only runtime manifest.
      try {
        const oStat = await fs.stat(p);
        totalBytes += oStat.size;
        if (isPackageFile) packageBytes += oStat.size;
        else orphanBytes += oStat.size;
      } catch { /* unreadable file already reported elsewhere */ }
    }
  }

  // (5) budget
  const budgetMB = exceptions.budgetMB ?? RUNTIME_BUDGET_MB;
  const totalMB = totalBytes / 1048576;
  if (totalMB > budgetMB) {
    fail('E_BUDGET', `Runtime assets ${totalMB.toFixed(2)} MB exceed the ${budgetMB} MB budget.`);
  }

  report({
    checked,
    packageFiles: onDisk.length - runtimeFileCount,
    packageMB: packageBytes / 1048576,
    totalMB,
    budgetMB,
    orphanMB: orphanBytes / 1048576,
  });
}

function report(summary = {}) {
  if (JSON_OUT) {
    console.log(JSON.stringify({ errors, warnings, ...summary }, null, 2));
  } else {
    console.log('\nSLIDE asset audit');
    console.log('─'.repeat(70));
    if (summary.checked !== undefined) {
      console.log(`Assets checked : ${summary.checked}`);
      if (summary.packageFiles) console.log(`Package files  : ${summary.packageFiles} (${summary.packageMB.toFixed(2)} MB)`);
      console.log(`Runtime total  : ${summary.totalMB.toFixed(2)} MB / ${summary.budgetMB} MB budget`);
      if (summary.orphanMB > 0.01) {
        console.log(`  ...of which unregistered (orphan): ${summary.orphanMB.toFixed(2)} MB`);
      }
    }
    console.log(`Errors         : ${errors.length}`);
    console.log(`Warnings       : ${warnings.length}`);

    if (errors.length) {
      console.log('\nERRORS (blocking)');
      for (const e of errors) console.log(`  [${e.code}] ${e.msg}`);
    }
    if (warnings.length) {
      console.log('\nWARNINGS (non-blocking)');
      for (const w of warnings.slice(0, 25)) console.log(`  [${w.code}] ${w.msg}`);
      if (warnings.length > 25) console.log(`  ... and ${warnings.length - 25} more`);
    }
    console.log('\n' + (errors.length ? 'AUDIT FAILED' : 'AUDIT PASSED'));
  }
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
