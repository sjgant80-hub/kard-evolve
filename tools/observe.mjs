#!/usr/bin/env node
// tools/observe.mjs — runs experiment 2: every sealed seed, every arm.
//   node tools/observe.mjs --run            refuses unless data/observe-prereg.json is committed and on GitHub and every
//                                           sealed file is the sealed one; runs once; writes data/observe-run.json
//   node tools/observe.mjs --verify         re-runs all 24 evolutions and exits 1 unless every record is byte-identical
//   node tools/observe.mjs --verify --seed 2718   the same, for one seed (quicker)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { world, habitat } from '../evolve.mjs';
import { ARMS, evolveWith, compare } from '../observe.mjs';
import { HABITAT } from './seal.mjs';
import { CONFIG, SEEDS, prereg } from './observe-seal.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = join(ROOT, 'data', 'observe-run.json');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const die = (m) => { console.error(m); process.exit(1); };

const pre = JSON.parse(text('data/observe-prereg.json'));
if (JSON.stringify(pre) !== JSON.stringify(prereg())) die('data/observe-prereg.json is not what the committed inputs seal');
for (const [f, h] of Object.entries(pre.sealed)) if (sha(text(f)) !== h) die(f + ' is not the sealed one');

const data = JSON.parse(text('data/world.json'));
const h = habitat(data, HABITAT);
export function runSeed(seed) {
  return Object.fromEntries(ARMS.map((arm) => [arm, evolveWith({ ...CONFIG, seed }, world(data.codes), h.train, h.held, arm)]));
}

const argSeed = process.argv.includes('--seed') ? Number(process.argv[process.argv.indexOf('--seed') + 1]) : null;
if (process.argv.includes('--verify')) {
  if (!existsSync(OUT)) die('no data/observe-run.json to verify');
  const committed = JSON.parse(text('data/observe-run.json'));
  const seeds = argSeed === null ? SEEDS : [argSeed];
  let all = true;
  for (const seed of seeds) {
    const i = SEEDS.indexOf(seed);
    if (i < 0) die('not a sealed seed: ' + seed);
    const t0 = Date.now(), again = runSeed(seed);
    for (const arm of ARMS) {
      const same = sha(JSON.stringify(again[arm])) === committed.hashes[arm][i];
      all = all && same;
      console.log((same ? 'REPRODUCED ' : 'DIFFERENT  ') + 'seed ' + String(seed).padEnd(5) + arm.padEnd(8) + again[arm].champion.key);
    }
    console.log('  seed ' + seed + ' · ' + (Date.now() - t0) + ' ms');
  }
  process.exit(all ? 0 : 1);
}
if (!process.argv.includes('--run')) die('usage: node tools/observe.mjs --run | --verify [--seed N]');
if (existsSync(OUT)) die('data/observe-run.json exists — experiment 2 runs once');
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', 'data/observe-prereg.json', 'data/world.json', 'evolve.mjs', 'observe.mjs', 'vendor/sealmark.mjs', 'tools/observe.mjs', 'tools/observe-seal.mjs')) die('commit the seal, the world, the kernels and the tools first');
git('fetch', '-q', 'origin');
try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/main'); } catch { die('push first — HEAD is not on origin/main'); }
const sealedIn = git('log', '-1', '--format=%H', '--', 'data/observe-prereg.json');

// the cross-check: the blind arm on seed 2718 is experiment 1's first CONFIG.generations generations
const exp1 = JSON.parse(text('data/run.json')).record.history.slice(0, CONFIG.generations + 1);
const records = Object.fromEntries(ARMS.map((a) => [a, []]));
const t0 = Date.now();
for (const seed of SEEDS) {
  const r = runSeed(seed);
  for (const arm of ARMS) records[arm].push(r[arm]);
  if (seed === 2718 && JSON.stringify(r.blind.history) !== JSON.stringify(exp1)) die('the blind arm on seed 2718 does not reproduce experiment 1');
  console.log('seed ' + String(seed).padEnd(5) + ARMS.map((a) => a + ' ' + r[a].champion.key).join(' · ') + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
const hashes = Object.fromEntries(ARMS.map((a) => [a, records[a].map((r) => sha(JSON.stringify(r)))]));
const judged = compare(records, CONFIG.generations);
writeFileSync(OUT, JSON.stringify({ kind: 'kard-evolve-observe-run', v: 1, sealedIn, ranAt: new Date().toISOString(), ms: Date.now() - t0, crossCheck: 'blind on seed 2718 reproduced experiment 1\'s first ' + CONFIG.generations + ' generations exactly', hashes, judged, records }, null, 1) + '\n');
console.log('ran ' + SEEDS.length + ' seeds × ' + ARMS.length + ' arms in ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + judged.passed + ' of ' + judged.of + ' record rules');
