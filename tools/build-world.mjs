#!/usr/bin/env node
// tools/build-world.mjs — writes data/world.json: the 64 real cards and the 192 real model replies of fallkard-forge's
// sealed paid read (commit d672d84), taken byte-exact from that commit with their sha256s recorded, each reply's code
// extracted by fallkard-forge's own gated extractCode. The creatures live in this world. Refuses to overwrite.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const FORGE = resolve(ROOT, '..', 'fallkard-forge');
const COMMIT = 'd672d84c61c95abb3f304e22ddc381e2c6e61d04';
const OUT = join(ROOT, 'data', 'world.json');
if (existsSync(OUT)) { console.error('data/world.json exists — the world is made once'); process.exit(1); }
const show = (f) => execFileSync('git', ['-C', FORGE, 'show', COMMIT + ':' + f], { maxBuffer: 1 << 26 });
const sha = (b) => createHash('sha256').update(b).digest('hex');

const files = ['data/vision.json', 'data/vision/cards.json', 'vision.mjs', 'sealmark.mjs'];
const bytes = Object.fromEntries(files.map((f) => [f, show(f)]));
// the extractor used must be the one at that commit
if (readFileSync(join(FORGE, 'vision.mjs'), 'utf8').replace(/\r\n/g, '\n') !== bytes['vision.mjs'].toString('utf8')) { console.error('fallkard-forge/vision.mjs is not the one at ' + COMMIT.slice(0, 7)); process.exit(1); }
if (sha(bytes['sealmark.mjs']) !== sha(readFileSync(join(ROOT, 'vendor', 'sealmark.mjs')))) { console.error('vendor/sealmark.mjs is not the one at ' + COMMIT.slice(0, 7)); process.exit(1); }
const { extractCode } = await import(pathToFileURL(join(FORGE, 'vision.mjs')).href);

const run = JSON.parse(bytes['data/vision.json']), cards = JSON.parse(bytes['data/vision/cards.json']).cards.filter((c) => !c.plumbing);
const index = Object.fromEntries(cards.map((c, i) => [c.i, i]));
const real = run.rows.map((r) => ({ card: index[r.card], condition: r.condition, reply: r.reply, read: extractCode(r.reply) }));
if (real.length !== 192 || real.some((r) => !Number.isInteger(r.card) || typeof r.read !== 'string')) { console.error('the paid read is not 192 answered replies'); process.exit(1); }
const world = {
  kind: 'kard-evolve-world', v: 1,
  source: { repo: 'sjgant80-hub/fallkard-forge', commit: COMMIT, files: Object.fromEntries(files.map((f) => [f, sha(bytes[f])])), what: 'the sealed paid read: claude-sonnet-5 shown only each card picture (full size, a JPEG 60 platform copy at 60%, and 35% size), its replies graded there 5 of 5' },
  seals: cards.map((c) => c.seal), codes: cards.map((c) => c.code),
  split: { train: Array.from({ length: 32 }, (_, i) => i), held: Array.from({ length: 32 }, (_, i) => i + 32), why: 'the first 32 cards in forging order train, the last 32 are held out — the natural halves; before choosing, Kar checked that each half holds real V-read-as-U misreads (5 and 2), because the sealed claim is about them' },
  real,
};
writeFileSync(OUT, JSON.stringify(world, null, 1) + '\n');
console.log('wrote data/world.json · ' + real.length + ' real reads of ' + cards.length + ' cards · from fallkard-forge@' + COMMIT.slice(0, 7));
