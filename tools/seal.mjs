#!/usr/bin/env node
// tools/seal.mjs — writes data/prereg.json, the evolution's pre-registration, from the committed files: the world's and
// the kernel's sha256, the configuration, the rules and a prediction. Committed and pushed BEFORE the first generation.
//   node tools/seal.mjs            write it (refuses to overwrite)
//   node tools/seal.mjs --check    exit 1 unless the committed file is exactly what this writes
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { RIGHT, WRONG, EDIT, BOUNDS, SPEC, SOURCE } from '../evolve.mjs';
import { ALPHABET } from '../vendor/sealmark.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = join(ROOT, 'data', 'prereg.json');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
import { CONFIG } from './pilot.mjs';        // the very configuration the pilot ran with — one source
export { CONFIG };
export const HABITAT = { perCard: 8, trainSeed: 31, heldSeed: 32 };

export function prereg() {
  const pilot = JSON.parse(text('data/pilot.json'));
  return {
    kind: 'kard-evolve-prereg', v: 1, written: '2026-09-30',
    approvedBy: 'Simon, relayed verbatim: "yes go kar build the first step lfg x"',
    statement: 'Sealed, committed and pushed before the first generation. The first step of the kard-creatures vision: creatures whose genes are runnable, whose fitness is measured, and whose evolution anyone can re-run. This fixes, in advance, the world, the kernel, the configuration, the rules and a prediction. The result is published whichever way it lands.',
    question: 'Bred, battled and selected only on the training half, does evolution produce a reader of damaged seal codes that beats generation 0 on cards it never saw — and does it rediscover, untold, that the model reads V as U?',
    sealed: { 'data/world.json': sha(text('data/world.json')), 'evolve.mjs': sha(text('evolve.mjs')), 'vendor/sealmark.mjs': sha(text('vendor/sealmark.mjs')), 'data/pilot.json': sha(text('data/pilot.json')) },
    world: {
      source: 'the 192 real replies of fallkard-forge\'s sealed paid read (claude-sonnet-5, shown only each card picture), with the 64 cards\' codes — data/world.json, taken byte-exact from fallkard-forge@d672d84',
      split: 'cards 0–31 train, cards 32–63 held out — selection never sees a held-out card',
      damage: 'habitat(): each card also gets ' + HABITAT.perCard + ' deliberately damaged copies with 1–5 slips, drawn in proportion from the slips MEASURED on the training cards\' real reads only (trainSeed ' + HABITAT.trainSeed + ', heldSeed ' + HABITAT.heldSeed + ')',
      habitat: HABITAT,
    },
    creature: {
      genes: 'up to ' + BOUNDS.folds + ' folds "read X as Y" (X any of the ' + SOURCE.length + ' letters and digits, Y any of the ' + ALPHABET.length + ' code symbols, all equally likely to appear by mutation), plus maxEdits ' + BOUNDS.maxEdits.join('–') + ', margin ' + BOUNDS.margin.join('–') + ', maxUnknown ' + BOUNDS.maxUnknown.join('–'),
      phenotype: 'fold the read, then the spec\'s own normalisation and resolution against the 64 cards (vendor/sealmark.mjs)',
      fitness: RIGHT + ' per right card, ' + WRONG + ' per wrong card, ' + EDIT + ' per correction used, 0 for a refusal — a sure read beats a lucky one',
      generation0: 'the spec\'s own reader ' + JSON.stringify(SPEC) + ' plus ' + (CONFIG.population - 1) + ' random genomes',
      battle: 'two creatures drawn at random; the fitter on the whole training set wins (fitness, then fewer folds, then population order)',
      breed: 'two battle winners cross over (each fold kept at a coin\'s toss, each threshold from one parent), then one random mutation (gain, lose or re-aim a fold, or nudge a threshold)',
      birthGate: 'the crossover must carry a gene from each parent, and the child must be no weaker than the weaker parent; a coupling that fails ' + CONFIG.tries + ' tries bears nothing and the stronger parent carries on',
      survival: 'the best ' + CONFIG.elites + ' carry over each generation',
    },
    config: CONFIG,
    rules: [
      { id: 'beats-gen0', rule: 'on the held-out cards (real and damaged reads), the champion\'s fitness is higher than generation 0\'s best' },
      { id: 'u-to-v', rule: 'the champion carries the fold U → V — found by mutation and selection, never told' },
      { id: 'never-wrong', rule: 'the champion names no wrong card on the held-out reads' },
      { id: 'real-held', rule: 'on the 96 held-out REAL model replies alone, the champion resolves more cards than the spec\'s own reader, and none wrong' },
      { id: 'reproducible', rule: 're-running the evolution from this seal gives a byte-identical record — CI re-runs it on every push' },
    ],
    pilot: {
      why: 'run before the seal on a made-up world (64 invented cards; an invented slip table where W is read as U, not V) to learn whether the engine can climb and aim a fold at all; the real world was not touched',
      first: 'with fitness = right cards − 4 × wrong (no price on corrections), the champion was "read U as 0, accept up to 5 edits with a margin of 1": perfect on the pilot\'s held-out cards (352/352 vs generation 0\'s 257) but it never aimed the fold — an extra edit cost nothing. So corrections were priced (' + EDIT + ' each), which rewards exactness in general, not any particular fold.',
      second: pilot.result,
    },
    predictions: {
      said: 'before the first generation, by Kar',
      'beats-gen0': 'pass — generation 0 refuses every U read and every read past 3 slips',
      'u-to-v': 'pass — the pilot aimed U at W by generation 13; here the measured slips make V the right aim',
      'never-wrong': 'pass',
      'real-held': 'pass — the 2 held-out real U reads come back',
      reproducible: 'pass',
    },
  };
}

const stable = (o) => JSON.stringify(o, null, 1) + '\n';
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/seal.mjs')) {
  if (process.argv.includes('--check')) {
    const same = existsSync(OUT) && text('data/prereg.json') === stable(prereg());
    console.log(same ? 'the evolution\'s pre-registration matches its inputs' : 'data/prereg.json differs from what the committed inputs give');
    process.exit(same ? 0 : 1);
  }
  if (existsSync(OUT)) { console.error('data/prereg.json exists — it is sealed'); process.exit(1); }
  writeFileSync(OUT, stable(prereg()));
  console.log('sealed data/prereg.json · sha256 ' + sha(stable(prereg())));
}
