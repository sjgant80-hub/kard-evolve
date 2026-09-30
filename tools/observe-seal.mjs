#!/usr/bin/env node
// tools/observe-seal.mjs — writes data/observe-prereg.json, experiment 2's pre-registration: the self-observing creature
// against blind mutation and against blind trials, on experiment 1's world. Committed and pushed BEFORE the first
// generation of any sealed seed.
//   node tools/observe-seal.mjs            write it (refuses to overwrite)
//   node tools/observe-seal.mjs --check    exit 1 unless the committed file is exactly what this writes
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ARMS, CAP, COSTLY, TRIALS } from '../observe.mjs';
import { HABITAT } from './seal.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = join(ROOT, 'data', 'observe-prereg.json');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
export const CONFIG = { population: 48, generations: 60, elites: 4, tries: 3 };
export const SEEDS = [2718, 1, 2, 3, 4, 5, 6, 7];

export function prereg() {
  return {
    kind: 'kard-evolve-observe-prereg', v: 1, written: '2026-09-30',
    approvedBy: 'Simon, relayed verbatim: "yes go kar build the self-observing creature lfg"',
    statement: 'Sealed, committed and pushed before the first generation of any sealed seed. Experiment 2 of kard-evolve: a creature that watches its own misreads and rewrites its own genes from them, measured against blind mutation and against blind trials given the same compute, on experiment 1\'s world. The result is published whichever way it lands.',
    question: 'With no answer key — only what it can see about itself — does a creature that watches its own misreads find what it needs faster than blind mutation, and faster than blind search given the same compute and the same self-scoring, without getting worse on cards it never saw?',
    sealed: { 'data/world.json': sha(text('data/world.json')), 'evolve.mjs': sha(text('evolve.mjs')), 'observe.mjs': sha(text('observe.mjs')), 'vendor/sealmark.mjs': sha(text('vendor/sealmark.mjs')) },
    world: 'experiment 1\'s, unchanged: the 192 real replies of fallkard-forge\'s sealed paid read, cards 0–31 train and 32–63 held out, plus ' + HABITAT.perCard + ' damaged copies per card drawn from the training cards\' measured slips (habitat ' + JSON.stringify(HABITAT) + ')',
    what: {
      selection: 'experiment 1\'s exactly: battles on the training set, the birth gate, ' + CONFIG.elites + ' elites; the world, with the answer key, decides who lives',
      blind: 'the child changes by experiment 1\'s one random mutation',
      trials: 'the control: ' + TRIALS + ' blind mutations of the child, scored by its own confidence on its own troubled reads, best kept (or none) — the observer\'s compute and scoring, without its eyes',
      observe: 'the child looks at its own troubled reads (the first ' + CAP + ' it refused or that cost it ' + COSTLY + '+ corrections); suspects a symbol it does not know in a read it refused for that reason (else a character of its costly reads), drawn in proportion; tries re-aiming that character to every code symbol and nudging each threshold; keeps what its own confidence says is best, or stays as it is',
      confidence: 'no answer key: 100 for every read it resolves (it cannot know if the card is right), −2 for every correction',
      diary: 'every self-change along the champion\'s line is recorded in its own terms: what troubled it, what it suspected, what it tried, what it chose, how much surer it became',
    },
    config: CONFIG, seeds: SEEDS,
    crossCheck: 'the blind arm on seed 2718 must reproduce the first ' + CONFIG.generations + ' generations of experiment 1\'s sealed record exactly (checked by tools/observe.mjs, not a rule)',
    rules: [
      { id: 'observer-finds-uv', rule: 'the observer\'s best creature reads U as V by generation 10 in at least 7 of the 8 seeds' },
      { id: 'faster-than-blind', rule: 'the median generation at which the best creature first reads U as V is earlier for the observer than for blind mutation (never found counts as ' + (CONFIG.generations + 1) + ')' },
      { id: 'faster-than-trials', rule: 'the same median is earlier for the observer than for blind trials with the same compute and self-scoring' },
      { id: 'not-worse', rule: 'the observer\'s champion is at least as fit on the held-out cards as blind mutation\'s in at least 7 of the 8 seeds' },
      { id: 'never-wrong', rule: 'none of the observer\'s 8 champions names a wrong card on the held-out reads' },
      { id: 'reproducible', rule: 're-running all 24 evolutions from this seal gives byte-identical records — CI re-runs them on every push' },
    ],
    pilot: 'timing only: seed 999 (not a sealed seed), 60 generations, one run per arm — blind 13 s, trials 23 s, observe 49 s on Kar\'s machine; no outcome was looked at or kept',
    predictions: {
      said: 'before the first sealed generation, by Kar',
      'observer-finds-uv': 'pass — a refused read names U as the symbol it does not know, and V is the re-aim that makes those reads resolve with the fewest corrections; I expect generation 1 or 2',
      'faster-than-blind': 'pass — blind took 14 generations in experiment 1',
      'faster-than-trials': 'pass, but closer — blind trials with the same self-scoring should also find it within a few generations',
      'not-worse': 'pass',
      'never-wrong': 'pass',
      reproducible: 'pass',
    },
  };
}

const stable = (o) => JSON.stringify(o, null, 1) + '\n';
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/observe-seal.mjs')) {
  if (process.argv.includes('--check')) {
    const same = existsSync(OUT) && text('data/observe-prereg.json') === stable(prereg());
    console.log(same ? 'experiment 2\'s pre-registration matches its inputs' : 'data/observe-prereg.json differs from what the committed inputs give');
    process.exit(same ? 0 : 1);
  }
  if (existsSync(OUT)) { console.error('data/observe-prereg.json exists — it is sealed'); process.exit(1); }
  writeFileSync(OUT, stable(prereg()));
  console.log('sealed data/observe-prereg.json · sha256 ' + sha(stable(prereg())) + ' · ' + ARMS.length + ' arms × ' + SEEDS.length + ' seeds');
}
