#!/usr/bin/env node
// tools/evolve.mjs — runs the sealed evolution.
//   node tools/evolve.mjs --run      refuses unless data/prereg.json is committed and on GitHub and the world and kernel
//                                    are the sealed ones; runs once; writes data/run.json
//   node tools/evolve.mjs --verify   re-runs it from the seal and exits 1 unless the record is byte-identical to
//                                    data/run.json — what CI does on every push
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { world, habitat, evolve, judge } from '../evolve.mjs';
import { CONFIG, HABITAT, prereg } from './seal.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = join(ROOT, 'data', 'run.json');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const die = (m) => { console.error(m); process.exit(1); };

const pre = JSON.parse(text('data/prereg.json'));
if (JSON.stringify(pre) !== JSON.stringify(prereg())) die('data/prereg.json is not what the committed inputs seal');
for (const [f, h] of Object.entries(pre.sealed)) if (sha(text(f)) !== h) die(f + ' is not the sealed one');

export function runIt() {
  const data = JSON.parse(text('data/world.json'));
  const h = habitat(data, HABITAT), w = world(data.codes);
  const record = evolve(CONFIG, w, h.train, h.held);
  return { record, judged: judge(record, h, w), habitat: { table: h.table, train: h.train.length, held: h.held.length, realHeld: h.realHeld.length } };
}

if (process.argv.includes('--verify')) {
  if (!existsSync(OUT)) die('no data/run.json to verify');
  const committed = JSON.parse(text('data/run.json'));
  const t0 = Date.now(), again = runIt();
  const same = sha(JSON.stringify(again.record)) === sha(JSON.stringify(committed.record)) && committed.recordSha256 === sha(JSON.stringify(again.record));
  console.log((same ? 'REPRODUCED — the re-run evolution is byte-identical' : 'NOT REPRODUCED — the re-run differs') + ' · champion ' + again.record.champion.key + ' · ' + (Date.now() - t0) + ' ms');
  process.exit(same ? 0 : 1);
}
if (!process.argv.includes('--run')) die('usage: node tools/evolve.mjs --run | --verify');
if (existsSync(OUT)) die('data/run.json exists — the evolution runs once');
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', 'data/prereg.json', 'data/world.json', 'evolve.mjs', 'vendor/sealmark.mjs', 'tools/evolve.mjs', 'tools/seal.mjs')) die('commit the seal, the world, the kernel and the tools first');
git('fetch', '-q', 'origin');
try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/main'); } catch { die('push first — HEAD is not on origin/main'); }
const sealedIn = git('log', '-1', '--format=%H', '--', 'data/prereg.json');
const t0 = Date.now(), out = runIt();
writeFileSync(OUT, JSON.stringify({ kind: 'kard-evolve-run', v: 1, sealedIn, ranAt: new Date().toISOString(), ms: Date.now() - t0, recordSha256: sha(JSON.stringify(out.record)), ...out }, null, 1) + '\n');
console.log('evolved ' + CONFIG.generations + ' generations in ' + (Date.now() - t0) + ' ms · champion ' + out.record.champion.key + ' · ' + out.judged.passed + ' of ' + out.judged.of + ' record rules');
