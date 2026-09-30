#!/usr/bin/env node
// tools/pilot.mjs — the machinery check, run BEFORE the seal on a made-up world that is not the real one: 64 invented
// seals and an invented slip table in which W is misread as U (the real reads misread V as U). It answers one question:
// can this engine, at the planned budget, climb and aim a fold at the right letter at all? Its result is disclosed in
// the pre-registration. It never touches data/world.json.
//   node tools/pilot.mjs            prints the pilot's result as JSON
import { createHash } from 'node:crypto';
import { sealCode } from '../vendor/sealmark.mjs';
import { world, synthesize, evolve, describe } from '../evolve.mjs';

export const PILOT = { table: [['W', 'U', 5], ['Q', '0', 3], ['G', '6', 3], ['Z', '2', 1], ['Q', 'D', 1], ['E', '8', 1]], seed: 777, perCardReal: 3, perCardSynth: 8 };
export const CONFIG = { seed: 2718, population: 48, generations: 150, elites: 4, tries: 3 };

export function pilot(config = CONFIG) {
  const seals = Array.from({ length: 64 }, (_, i) => createHash('sha256').update('kard-evolve pilot card ' + i).digest('hex'));
  const codes = seals.map(sealCode);
  const half = (lo) => Array.from({ length: 32 }, (_, i) => lo + i);
  const trainCards = half(0), heldCards = half(32);
  const train = [...synthesize(codes, trainCards, PILOT.table, PILOT.perCardReal, PILOT.seed), ...synthesize(codes, trainCards, PILOT.table, PILOT.perCardSynth, PILOT.seed + 1)];
  const held = [...synthesize(codes, heldCards, PILOT.table, PILOT.perCardReal, PILOT.seed + 2), ...synthesize(codes, heldCards, PILOT.table, PILOT.perCardSynth, PILOT.seed + 3)];
  const t0 = Date.now();
  const r = evolve(config, world(codes), train, held);
  return { ms: Date.now() - t0, champion: r.champion.key, words: describe(r.champion.genome), championHeld: r.champion.held, gen0: r.gen0.key, gen0Held: r.gen0.held, foundUW: r.champion.genome.folds.some(([a, b]) => a === 'U' && b === 'W'), firstBest: r.history.find((h) => h.best.key.includes('UW'))?.gen ?? null, memo: r.memo };
}

const main = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/pilot.mjs');
if (main && process.argv.includes('--write')) {
  const { writeFileSync, existsSync } = await import('node:fs');
  const out = new URL('../data/pilot.json', import.meta.url);
  if (existsSync(out)) { console.error('data/pilot.json exists'); process.exit(1); }
  const { ms, ...result } = pilot();
  writeFileSync(out, JSON.stringify({ kind: 'kard-evolve-pilot', v: 1, config: CONFIG, pilot: PILOT, result }, null, 1) + '\n');
  console.log('wrote data/pilot.json · ' + result.champion + ' · found U→W: ' + result.foundUW);
} else if (main && process.argv.includes('--check')) {
  const { readFileSync } = await import('node:fs');
  const { ms, ...result } = pilot();
  const same = JSON.stringify(JSON.parse(readFileSync(new URL('../data/pilot.json', import.meta.url), 'utf8')).result) === JSON.stringify(result);
  console.log(same ? 'the pilot re-runs to exactly its committed result' : 'the pilot does NOT re-run to its committed result');
  process.exit(same ? 0 : 1);
} else if (main) console.log(JSON.stringify(pilot(), null, 1));
