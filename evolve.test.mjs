// evolve.test.mjs — proof-of-play for the creatures: genomes, reading, fitness, the world's damage, breeding, and a
// whole evolution that must come out identical every time it is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE, BOUNDS, SPEC, RIGHT, WRONG, EDIT, prng, canon, key, express, decide, world, score, slipTable, damage, synthesize,
  randomGenome, mutate, crossover, carriesBoth, rank, birthGate, evolve, habitat, judge, describe,
} from './evolve.mjs';
import { ALPHABET, sealCode, resolveCode } from './vendor/sealmark.mjs';

const SEALS = ['3f9a0c21d4e87b65a10f2c3d4e5f60718293a4b5c6d7e8f90112233445566778', 'c07e11aa92b3445d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5', 'e1' + 'd'.repeat(62)];
const CODES = SEALS.map(sealCode);        // 7YD0-R8EM-X1XP-B88F · R1Z1-3AMJ-PD25-TVKZ · W7EX-VQEX-VQEX-VQEX
const G = (folds, maxEdits = 3, margin = 3, maxUnknown = 4) => ({ folds, maxEdits, margin, maxUnknown });

test('prng: mulberry32, the published sequence, the same on every machine', () => {
  const r = prng(1);
  assert.equal(r(), 0.6270739405881613);
  assert.equal(r(), 0.002735721180215478);
  const a = prng(42), b = prng(42), c = prng(43);
  const xs = Array.from({ length: 5 }, a), ys = Array.from({ length: 5 }, b);
  assert.deepEqual(xs, ys);
  assert.notDeepEqual(xs, Array.from({ length: 5 }, c));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.deepEqual(Array.from({ length: 3 }, prng('x')), Array.from({ length: 3 }, prng(0)));
  assert.deepEqual(Array.from({ length: 3 }, prng(-1)), Array.from({ length: 3 }, prng(4294967295)));
});

test('the gene pool: every letter and digit can be read as any code symbol; the spec reader is generation 0', () => {
  assert.equal(SOURCE.length, 36);
  assert.deepEqual(BOUNDS, { maxEdits: [0, 6], margin: [1, 6], maxUnknown: [0, 8], folds: 8 });
  assert.deepEqual(SPEC, { folds: [], maxEdits: 3, margin: 3, maxUnknown: 4 });
  assert.deepEqual([RIGHT, WRONG, EDIT], [100, -400, -2]);
});

test('canon and key: one true form for every genome, nothing for a non-genome', () => {
  assert.deepEqual(canon(G([['U', 'V'], ['A', 'B'], ['U', 'W']])), G([['A', 'B'], ['U', 'V']]));
  assert.equal(key(G([['U', 'V'], ['A', 'B']], 5, 2, 0)), 'AB.UV|520');
  assert.equal(key(SPEC), '|334');
  assert.equal(canon(G(Array.from({ length: 8 }, (_, i) => [SOURCE[i], 'Z']))).folds.length, 8);
  for (const bad of [
    null, [], 'x', G('x'), G([['UV']]), G([['U', 'V', 'W']]), G([['u', 'V']]), G([['U', 'U']]), G([['U', 'I']]), G([['#', 'V']]), G([[5, 'V']]), G([['U', 5]]), G([['UU', 'V']]), G([['U', 'VV']]),
    G([], -1), G([], 7), G([], 3, 0), G([], 3, 7), G([], 3, 3, -1), G([], 3, 3, 9), G([], 1.5), G(Array.from({ length: 9 }, (_, i) => [SOURCE[i], 'Z'])),
  ]) { assert.equal(canon(bad), null); assert.equal(key(bad), null); }
  // bounds are inclusive
  for (const ok of [G([], 0, 1, 0), G([], 6, 6, 8)]) assert.notEqual(canon(ok), null);
});

test('express: the folds in one pass, then the spec\'s own normalisation', () => {
  assert.equal(express('7yd0-r8em-x1xp-b88f', SPEC), '7YD0R8EMX1XPB88F');
  assert.equal(express('6WHU-DDBJ', SPEC), null);                                  // U is not a code symbol
  assert.equal(express('6WHU-DDBJ', G([['U', 'V']])), '6WHVDDBJ');
  assert.equal(express('6whu', G([['U', 'V']])), '6WHV');                          // case-blind before folding
  assert.equal(express('UV', G([['U', 'V'], ['V', 'W']])), 'VW');                  // one pass: U→V is not then V→W
  assert.equal(express('OIL', SPEC), '011');
  assert.equal(express('O', G([['O', 'Q']])), 'Q');                                // a fold reads first
  assert.equal(express('A?B', SPEC), 'A?B');
  for (const [r, g] of [[null, SPEC], [5, SPEC], ['A', null], ['A', G([['U', 'U']])]]) assert.equal(express(r, g), null);
});

test('decide: the spec\'s resolution rule, the same answer as sealmark\'s resolveCode', () => {
  assert.equal(decide([5, 0, 9], 0, SPEC), 1);
  assert.equal(decide([0, 2, 9], 0, SPEC), -1);                                    // runner-up within the margin
  assert.equal(decide([0, 3, 9], 0, SPEC), 0);                                     // exactly the margin away
  assert.equal(decide([4, 9, 9], 0, SPEC), -1);                                    // too many edits
  assert.equal(decide([3, 9, 9], 0, SPEC), 0);
  assert.equal(decide([1, 1, 9], 0, G([], 3, 1)), -1);                             // a tie is never a pick
  assert.equal(decide([9, 7, 1], 0, SPEC), 2);
  assert.equal(decide([2], 0, SPEC), 0);                                           // a deck of one needs no margin
  assert.equal(decide([0, 9], 4, SPEC), 0);
  assert.equal(decide([0, 9], 5, SPEC), -1);                                       // too many unreadable
  for (const bad of [[[], 0, SPEC], [null, 0, SPEC], [[0], 0.5, SPEC], [[0], 0, null]]) assert.equal(decide(...bad), -1);
  // against resolveCode itself, across thresholds and reads
  const reads = ['7YD0-R8EM-X1XP-B88F', '7YD0-R8EM-X1XP-B8??', '7YD0-R8EM-X1XP-BZZZ', 'W7EX-VQEX-VQEX-VQEZ', 'R1Z1-3AMJ-PD25-TVK', 'R1Z1-3AMJ-PD25-TVKZZ', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', '????-R8EM-X1XP-B88F'];
  const w = world(CODES);
  for (const read of reads) for (const e of [0, 2, 3, 6]) for (const m of [1, 3, 6]) for (const u of [0, 4]) {
    const g = G([], e, m, u), ours = decide(w.measure(express(read, g)).dist, w.measure(express(read, g)).unknown, g);
    const theirs = resolveCode(read, SEALS, { maxEdits: e, margin: m, maxUnknown: u });
    assert.equal(ours, theirs.ok ? theirs.index : -1, read + ' ' + e + m + u);
  }
});

test('world: remembers each read once; score counts right, wrong, refused and every correction', () => {
  assert.equal(world([]), null);
  assert.equal(world(null), null);
  assert.equal(world(['A', 5]), null);
  assert.equal(world(['A', '']), null);
  const w = world(CODES);
  assert.equal(w.size, 3);
  const reads = [
    { read: CODES[0], card: 0 },                                  // right, 0 edits
    { read: '7YD0-R8EM-X1XP-B8ZF', card: 0 },                     // right, 1 edit
    { read: 'W7EX-VQEX-VQEX-VQEZ', card: 1 },                     // names card 2: wrong, 1 edit
    { read: '6WHU-DDBJ-HCEM-6DVB', card: 1 },                     // U: refused
    { read: CODES[0], card: 0 },                                  // the same read again: remembered
    null,
  ];
  assert.deepEqual(score(SPEC, w, reads), { fitness: RIGHT * 3 + WRONG * 1 + EDIT * 2, right: 3, wrong: 1, refused: 2, edits: 2, n: 6 });
  assert.equal(w.memoSize(), 3);
  assert.equal(score(SPEC, w, [{ read: '', card: 0 }]).refused, 1);
  for (const bad of [[null, w, reads], [SPEC, null, reads], [SPEC, w, null]]) assert.equal(score(...bad), null);
});

test('slipTable: the confusions actually seen, counted, most common first', () => {
  const reads = [
    { read: '7YD0-R8EM-X1XP-B88F', card: 0 },                     // exact: nothing
    { read: '7YD0-R8EM-X1XP-B880', card: 0 },                     // F→0
    { read: '7yd0-r8em-x1xp-b880', card: 0 },                     // F→0 again (case-blind)
    { read: 'W7EX-UQEX-VQEX-VQEX', card: 2 },                     // V→U
    { read: 'SHORT', card: 0 },                                   // not aligned: ignored
    { read: 5, card: 0 }, null, { read: 'X', card: 9 },
  ];
  assert.deepEqual(slipTable(reads, CODES), [['F', '0', 2], ['V', 'U', 1]]);
  assert.deepEqual(slipTable([{ read: 'B', card: 0 }, { read: 'A', card: 1 }], ['A', 'B']), [['A', 'B', 1], ['B', 'A', 1]]);
  assert.equal(slipTable(null, CODES), null);
  assert.equal(slipTable([], null), null);
});

test('damage and synthesize: measured slips, at distinct positions, only where possible, reproducible', () => {
  const table = [['V', 'U', 3], ['Q', '0', 1]];
  const d = damage('W7EX-VQEX-VQEX-VQEX', table, 5, prng(9));
  assert.equal(d.length, 19);
  const diffs = [...d].map((ch, i) => (ch === 'W7EX-VQEX-VQEX-VQEX'[i] ? null : 'W7EX-VQEX-VQEX-VQEX'[i] + ch)).filter(Boolean);
  assert.equal(diffs.length, 5);
  assert.ok(diffs.every((x) => x === 'VU' || x === 'Q0'));
  assert.equal(damage('W7EX-VQEX-VQEX-VQEX', table, 5, prng(9)), d);
  assert.equal(damage('7YD0-R8EM-X1XP-B88F', table, 3, prng(1)), '7YD0-R8EM-X1XP-B88F');  // no V or Q: nothing possible
  assert.equal(damage('VVQ', table, 9, prng(2)).length, 3);
  assert.equal([...damage('VVQ', table, 9, prng(2))].filter((c, i) => c !== 'VVQ'[i]).length, 3);   // capped by what is possible
  assert.equal(damage('VQ', [['V', 'U', 1]], 2, prng(3)), 'UQ');
  assert.equal(damage('VQ', table, 0, prng(3)), 'VQ');
  // proportional: with V→U weighted 3 to Q→0's 1, the first slip on 'VQ' lands on V about three times in four
  let onV = 0;
  const r = prng(5);
  for (let i = 0; i < 400; i++) if (damage('VQ', table, 1, r)[0] === 'U') onV++;
  assert.ok(onV > 260 && onV < 340, 'V was hit ' + onV + ' of 400');
  for (const bad of [[5, table, 1, prng(1)], ['VQ', null, 1, prng(1)], ['VQ', [null], 1, prng(1)], ['VQ', [['V', 'U']], 1, prng(1)], ['VQ', [['VV', 'U', 1]], 1, prng(1)], ['VQ', [['V', 'UU', 1]], 1, prng(1)], ['VQ', [['V', 'U', 0]], 1, prng(1)], ['VQ', [['V', 'U', 1.5]], 1, prng(1)], ['VQ', [[1, 'U', 1]], 1, prng(1)], ['VQ', [['V', 2, 1]], 1, prng(1)], ['VQ', table, 1.5, prng(1)], ['VQ', table, 1, null]]) assert.equal(damage(...bad), null);
  const s = synthesize(CODES, [2, 0], table, 4, 11);
  assert.equal(s.length, 8);
  assert.deepEqual(s.map((x) => x.card), [2, 2, 2, 2, 0, 0, 0, 0]);
  assert.ok(s.every((x) => x.slips >= 1 && x.slips <= 5));
  assert.deepEqual(synthesize(CODES, [2, 0], table, 4, 11), s);
  assert.notDeepEqual(synthesize(CODES, [2], table, 4, 12), synthesize(CODES, [2], table, 4, 11));
  assert.deepEqual(synthesize(CODES, [0], table, 0, 1), []);
  for (const bad of [[null, [0], table, 1, 1], [CODES, null, table, 1, 1], [CODES, [9], table, 1, 1], [CODES, [0], null, 1, 1], [CODES, [0], [null], 1, 1], [CODES, [0], table, -1, 1], [CODES, [0], table, 1.5, 1]]) assert.equal(synthesize(...bad), null);
});

test('randomGenome and mutate: always a valid genome, every kind of change reachable, bounds respected', () => {
  const r = prng(20260930);
  assert.deepEqual(randomGenome(r), G([['T', '6'], ['W', 'V']], 6, 6, 1));
  const seen = { gain: false, lose: false, aim: false, edits: false, margin: false, unknown: false };
  const rr = prng(3);
  for (let i = 0; i < 400; i++) {
    const g = randomGenome(rr);
    assert.notEqual(canon(g), null);
    assert.ok(g.folds.length <= 2);
    const m = mutate(g, rr);
    assert.notEqual(canon(m), null);
    if (m.folds.length > g.folds.length) seen.gain = true;
    if (m.folds.length < g.folds.length) seen.lose = true;
    if (m.folds.length === g.folds.length && m.folds.length && key(m).split('|')[0] !== key(g).split('|')[0]) seen.aim = true;
    if (m.maxEdits !== g.maxEdits) seen.edits = true;
    if (m.margin !== g.margin) seen.margin = true;
    if (m.maxUnknown !== g.maxUnknown) seen.unknown = true;
    for (const t of ['maxEdits', 'margin', 'maxUnknown']) assert.ok(Math.abs(m[t] - g[t]) <= 1);
  }
  assert.deepEqual(seen, { gain: true, lose: true, aim: true, edits: true, margin: true, unknown: true });
  // at a bound, a nudge stays inside it
  for (let i = 0; i < 200; i++) { const m = mutate(G([], 6, 6, 8), prng(i)); assert.ok(m.maxEdits <= 6 && m.margin <= 6 && m.maxUnknown <= 8); }
  for (let i = 0; i < 200; i++) { const m = mutate(G([], 0, 1, 0), prng(i)); assert.ok(m.maxEdits >= 0 && m.margin >= 1 && m.maxUnknown >= 0); }
  // a full genome cannot grow past the cap
  const full = G(Array.from({ length: 8 }, (_, i) => [SOURCE[i], 'Z']));
  for (let i = 0; i < 100; i++) assert.ok(mutate(full, prng(i)).folds.length <= 8);
  assert.equal(mutate(null, prng(1)), null);
});

test('crossover and carriesBoth: a child is made only of its parents, and carries both lines', () => {
  const A = G([['U', 'V'], ['Q', '0']], 5, 2, 0), B = G([['G', '6']], 3, 4, 7);
  const pool = new Set([...A.folds, ...B.folds].map((f) => f.join('')));
  for (let i = 0; i < 200; i++) {
    const c = crossover(A, B, prng(i));
    assert.notEqual(canon(c), null);
    assert.ok(c.folds.every((f) => pool.has(f.join(''))));
    assert.ok([5, 3].includes(c.maxEdits) && [2, 4].includes(c.margin) && [0, 7].includes(c.maxUnknown));
  }
  assert.equal(crossover(A, null, prng(1)), null);
  assert.equal(carriesBoth(G([['U', 'V']], 3, 4, 7), A, B), true);                 // a fold from A, thresholds from B
  assert.equal(carriesBoth(G([], 5, 2, 0), A, B), false);                          // all A
  assert.equal(carriesBoth(G([['G', '6']], 3, 4, 7), A, B), false);                // all B
  assert.equal(carriesBoth(G([], 5, 4, 1), A, B), true);                           // one threshold from each
  assert.equal(carriesBoth(SPEC, SPEC, SPEC), true);                               // twins give what they share
  assert.equal(carriesBoth(G([], 1, 1, 1), A, B), false);                          // nothing from either
  for (const bad of [[null, A, B], [A, null, B], [A, B, null]]) assert.equal(carriesBoth(...bad), false);
});

test('evolve: a whole history, identical on every run, never worse than where it started', () => {
  const reads = [
    ...CODES.map((c, card) => ({ read: c, card })),
    { read: 'W7EX-UQEX-UQEX-VQEX', card: 2 }, { read: 'W7EX-VQEX-UQEX-UQEX', card: 2 }, { read: '7YD0-R8EM-X1XP-B88F', card: 0 },
    { read: 'R1Z1-3AMJ-PD25-TUKZ', card: 1 }, { read: 'R1Z1-3AMJ-PD25-T?KZ', card: 1 },
  ];
  const cfg = { seed: 7, population: 8, generations: 6, elites: 2, tries: 2 };
  const a = evolve(cfg, world(CODES), reads, reads), b = evolve(cfg, world(CODES), reads, reads);
  assert.equal(a.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.equal(a.history.length, 7);
  assert.deepEqual(a.history.map((h) => h.gen), [0, 1, 2, 3, 4, 5, 6]);
  for (let i = 1; i < a.history.length; i++) assert.ok(a.history[i].best.fitness >= a.history[i - 1].best.fitness, 'elites never lose ground');
  assert.ok(a.champion.train.fitness >= a.gen0.train.fitness);
  assert.equal(a.champion.key, key(a.champion.genome));
  assert.equal(a.line[0].id, a.champion.id);
  assert.equal(a.line[a.line.length - 1].gen, 0);
  assert.ok(a.line.every((x, i) => i === 0 || x.gen <= a.line[i - 1].gen));
  assert.ok(a.memo > 0);
  // a different seed is a different history
  assert.notDeepEqual(JSON.parse(JSON.stringify(evolve({ ...cfg, seed: 8 }, world(CODES), reads, reads).history)), JSON.parse(JSON.stringify(a.history)));
  // generation 0 includes the spec's own reader
  const one = evolve({ ...cfg, population: 2, generations: 1, elites: 1 }, world(CODES), reads, reads);
  assert.ok(one.history[0].best.key === '|334' || one.gen0.train.fitness >= score(SPEC, world(CODES), reads).fitness);
  for (const bad of [
    [{ ...cfg, population: 1 }], [{ ...cfg, generations: 0 }], [{ ...cfg, elites: 0 }], [{ ...cfg, elites: 8 }], [{ ...cfg, tries: 0 }], [{ ...cfg, population: 2.5 }], [null],
  ]) assert.match(evolve(bad[0], world(CODES), reads, reads).why, /config/);
  assert.match(evolve(cfg, null, reads, reads).why, /config/);
  assert.match(evolve(cfg, world(CODES), [], reads).why, /config/);
  assert.match(evolve(cfg, world(CODES), reads, null).why, /config/);
});

test('describe: a genome in plain words', () => {
  assert.equal(describe(G([['U', 'V']], 4, 2, 0)), 'reads U as V; accepts up to 4 edits when no other card is within 2 more, with at most 0 unreadable');
  assert.equal(describe(G([], 1, 1, 1)), 'folds nothing; accepts up to 1 edit when no other card is within 1 more, with at most 1 unreadable');
  assert.equal(describe(null), null);
});

test('fuzz: the creature kernel never throws on garbage', () => {
  const junk = [undefined, null, 0, -1, NaN, '', 'x', [], {}, [null], [[]], { folds: 5 }, () => 1, SPEC];
  for (const a of junk) for (const b of junk) assert.doesNotThrow(() => {
    canon(a); key(a); express(a, b); decide(a, 0, b); world(a); score(a, b, a); slipTable(a, b); damage(a, b, 1, prng(1));
    synthesize(a, b, a, 1, 1); mutate(a, prng(1)); crossover(a, b, prng(1)); carriesBoth(a, b, a); evolve(a, b, a, b); describe(a);
  });
});

test('habitat: training and held-out worlds from the real reads; the damage is learned from training cards only', () => {
  const data = {
    codes: CODES,
    real: [
      { card: 0, read: '7YD0-R8EM-X1XP-B880' },            // training: F→0
      { card: 1, read: 'R1Z1-3AMJ-PD25-TVKZ' },            // training: exact
      { card: 2, read: 'W7EX-UQEX-VQEX-VQEX' },            // held out: V→U — must NOT reach the damage table
    ],
    split: { train: [0, 1], held: [2] },
  };
  const h = habitat(data, { perCard: 3, trainSeed: 1, heldSeed: 2 });
  assert.equal(h.ok, true);
  assert.deepEqual(h.table, [['F', '0', 1]]);
  assert.equal(h.train.length, 2 + 2 * 3);
  assert.equal(h.held.length, 1 + 1 * 3);
  assert.deepEqual(h.train.slice(0, 2), [{ read: '7YD0-R8EM-X1XP-B880', card: 0 }, { read: 'R1Z1-3AMJ-PD25-TVKZ', card: 1 }]);
  assert.deepEqual(h.realHeld, [{ read: 'W7EX-UQEX-VQEX-VQEX', card: 2 }]);
  assert.ok(h.held.slice(1).every((r) => r.card === 2 && r.read === CODES[2]));    // no F in W7EX…: no damage possible
  assert.ok(h.train.slice(2).some((r) => r.card === 0 && r.read.endsWith('0')));   // F→0 applied to card 0's copies
  assert.deepEqual(habitat(data, { perCard: 3, trainSeed: 1, heldSeed: 2 }), h);
  assert.match(habitat({ ...data, split: { train: [0, 2], held: [2] } }, { perCard: 1, trainSeed: 1, heldSeed: 2 }).why, /cannot be in training and held out/);
  assert.match(habitat({ ...data, split: { train: [0, 9], held: [2] } }, { perCard: 1, trainSeed: 1, heldSeed: 2 }).why, /needs a code/);
  for (const [d, c] of [[null, { perCard: 1, trainSeed: 1, heldSeed: 2 }], [data, null], [data, { perCard: 1.5, trainSeed: 1, heldSeed: 2 }], [data, { perCard: 1, trainSeed: 'x', heldSeed: 2 }], [data, { perCard: 1, trainSeed: 1 }],
    [{ ...data, real: [{ card: 'x', read: 'A' }] }, { perCard: 1, trainSeed: 1, heldSeed: 2 }], [{ ...data, real: [null] }, { perCard: 1, trainSeed: 1, heldSeed: 2 }], [{ ...data, split: { train: [0] } }, { perCard: 1, trainSeed: 1, heldSeed: 2 }]]) assert.match(habitat(d, c).why, /data \{ codes/);
});

test('judge: the four sealed rules the record decides, each at its edge', () => {
  const w = world(CODES);
  const h = { ok: true, realHeld: [{ read: 'W7EX-UQEX-VQEX-VQEX', card: 2 }, { read: CODES[0], card: 0 }] };
  const rec = (genome, held, g0held) => ({ ok: true, champion: { genome, held }, gen0: { held: { wrong: 0, n: 5, ...g0held } } });
  const UV = G([['U', 'V']]);
  const j = judge(rec(UV, { fitness: 10, wrong: 0, n: 5 }, { fitness: 9 }), h, w);
  assert.deepEqual(j.rules.map((r) => [r.id, r.pass]), [['beats-gen0', true], ['u-to-v', true], ['never-wrong', true], ['real-held', true]]);
  assert.deepEqual([j.passed, j.of, j.champReal.right, j.specReal.right], [4, 4, 2, 1]);
  assert.equal(j.rules[3].value, '2 vs 1 of 2, 0 wrong');
  assert.equal(judge(rec(UV, { fitness: 9, wrong: 0, n: 5 }, { fitness: 9 }), h, w).rules[0].pass, false);        // equal is not beating
  assert.equal(judge(rec(G([['U', 'W']]), { fitness: 10, wrong: 0, n: 5 }, { fitness: 9 }), h, w).rules[1].pass, false);
  assert.match(judge(rec(G([['V', 'U']]), { fitness: 10, wrong: 0, n: 5 }, { fitness: 9 }), h, w).why, /record/);            // U is no code symbol: not a genome
  assert.equal(judge(rec(UV, { fitness: 10, wrong: 1, n: 5 }, { fitness: 9 }), h, w).rules[2].pass, false);
  assert.equal(judge(rec(SPEC, { fitness: 10, wrong: 0, n: 5 }, { fitness: 9 }), h, w).rules[3].pass, false);     // no better than the spec on real reads
  // a champion that reads better but names a wrong card on a real read fails real-held
  const h2 = { ok: true, realHeld: [...h.realHeld, { read: CODES[0], card: 1 }] };
  assert.equal(judge(rec(UV, { fitness: 10, wrong: 0, n: 5 }, { fitness: 9 }), h2, w).rules[3].pass, false);
  const good = rec(UV, { fitness: 10, wrong: 0, n: 5 }, { fitness: 9 });
  for (const bad of [[null, h, w], [{ ok: false }, h, w], [rec(UV, {}, { fitness: 9 }), h, w], [rec(UV, { fitness: 1, wrong: 0, n: 1 }, {}), h, w], [rec(UV, { fitness: 1.5, wrong: 0, n: 1 }, { fitness: 1, wrong: 0, n: 1 }), h, w], [{ ...good, champion: { ...good.champion, genome: null } }, h, w], [good, null, w], [good, { ok: false }, w], [good, { ok: true }, w], [good, h, null]]) assert.match(judge(...bad).why, /record/);
});

test('evolve: every generation records the genes spreading through it', () => {
  const reads = [...CODES.map((c, card) => ({ read: c, card })), { read: 'W7EX-UQEX-UQEX-VQEX', card: 2 }];
  const a = evolve({ seed: 3, population: 10, generations: 4, elites: 2, tries: 2 }, world(CODES), reads, reads);
  for (const h of a.history) {
    assert.ok(Array.isArray(h.genes) && h.genes.length <= 6);
    assert.ok(h.genes.every(([f, n]) => /^[0-9A-Z][0-9A-Z]$/.test(f) && n >= 1 && n <= 10));
    assert.ok(h.genes.every(([, n], i) => i === 0 || n <= h.genes[i - 1][1]));
  }
});

test('rank: fitness first, then fewer folds; alike creatures keep their order', () => {
  const c = (fitness, folds, k, id) => ({ id, fit: { fitness }, g: { folds: Array.from({ length: folds }, () => ['A', 'B']) }, k });
  const pop = [c(5, 0, 'b', 1), c(9, 2, 'z', 2), c(9, 1, 'y', 3), c(9, 1, 'x', 4), c(9, 1, 'x', 5), c(-1, 0, 'a', 6)];
  assert.deepEqual(rank(pop).map((x) => x.id), [3, 4, 5, 2, 1, 6]);
  assert.deepEqual(rank([c(1, 0, 'x', 1), c(1, 0, 'x', 2)]).map((x) => x.id), [1, 2]);
  assert.deepEqual(rank([c(1, 0, 'x', 2), c(1, 0, 'x', 1)]).map((x) => x.id), [2, 1]);
  assert.deepEqual(rank([c(1, 0, 'b', 1), c(1, 0, 'a', 2)]).map((x) => x.id), [1, 2]);
  assert.deepEqual(rank([c(1, 0, 'a', 1), c(1, 0, 'b', 2)]).map((x) => x.id), [1, 2]);
  assert.deepEqual(rank([]), []);
  for (const bad of [null, [null], [{ fit: { fitness: 1.5 }, g: { folds: [] }, k: 'a' }], [{ fit: { fitness: 1 }, g: { folds: 5 }, k: 'a' }], [{ fit: { fitness: 1 }, g: { folds: [] }, k: 5 }], [{ fit: null, g: { folds: [] }, k: 'a' }], [{ fit: { fitness: 1 }, g: null, k: 'a' }]]) assert.equal(rank(bad), null);
});

test('birthGate: both lines carried, and no weaker than the weaker parent — equal is enough', () => {
  const A = { g: G([['U', 'V']], 5, 2, 0), fit: { fitness: 50 } }, B = { g: G([['G', '6']], 3, 4, 7), fit: { fitness: 80 } };
  const both = G([['U', 'V']], 3, 4, 7);
  assert.equal(birthGate(both, { fit: { fitness: 50 } }, A, B), true);
  assert.equal(birthGate(both, { fit: { fitness: 49 } }, A, B), false);
  assert.equal(birthGate(both, { fit: { fitness: 90 } }, A, B), true);
  assert.equal(birthGate(G([], 5, 2, 0), { fit: { fitness: 90 } }, A, B), false);               // carries only A
  for (const bad of [[both, null, A, B], [both, { fit: { fitness: 1.5 } }, A, B], [both, { fit: { fitness: 50 } }, null, B], [both, { fit: { fitness: 50 } }, A, { g: B.g }]]) assert.equal(birthGate(...bad), false);
});

test('damage: the weighted pick lands exactly where the draw says', () => {
  const table = [['V', 'U', 3], ['Q', '0', 1]];
  const at = (x) => () => x;                                                     // a stub draw
  assert.equal(damage('VQ', table, 1, at(0 / 4)), 'UQ');                         // draws 0,1,2 land on V (weight 3)
  assert.equal(damage('VQ', table, 1, at(2.5 / 4)), 'UQ');
  assert.equal(damage('VQ', table, 1, at(3 / 4)), 'V0');                         // draw 3 is Q's
  assert.equal(damage('VQ', table, 2, at(3 / 4)), 'U0');                         // then V is all that is left
});

test('slipTable orders ties by the true character, then by what was read', () => {
  assert.deepEqual(slipTable([{ read: 'Z', card: 0 }, { read: '0', card: 0 }], ['F']), [['F', '0', 1], ['F', 'Z', 1]]);
  assert.deepEqual(slipTable([{ read: 'Y', card: 0 }, { read: 'Y', card: 0 }, { read: 'Y', card: 0 }, { read: 'B', card: 1 }], ['Z', 'A']), [['Z', 'Y', 3], ['A', 'B', 1]]);
});

test('mutate and crossover, pinned: the same draw gives the same child on every machine', () => {
  const base = G([['U', 'V'], ['Q', '0']]);
  assert.deepEqual([7, 12, 1, 20, 4, 5].map((s) => key(mutate(base, prng(s)))), ['2Z.Q0.UV|334', 'UV|334', 'QG.UV|334', 'Q0.UV|344', 'Q0.UV|234', 'Q0.U7|334']);
  assert.deepEqual([1, 2, 3].map((s) => key(crossover(G([['U', 'V'], ['Q', '0']], 5, 2, 0), G([['G', '6']], 3, 4, 7), prng(s)))), ['UV|340', 'G6.UV|347', 'G6.UV|540']);
});

test('evolve: the population holds its size, one try is enough, and a small history is pinned to the byte', async () => {
  const { createHash } = await import('node:crypto');
  const reads = [
    ...CODES.map((c, card) => ({ read: c, card })),
    { read: 'W7EX-UQEX-UQEX-VQEX', card: 2 }, { read: 'W7EX-VQEX-UQEX-UQEX', card: 2 }, { read: '7YD0-R8EM-X1XP-B88F', card: 0 },
    { read: 'R1Z1-3AMJ-PD25-TUKZ', card: 1 }, { read: 'R1Z1-3AMJ-PD25-T?KZ', card: 1 },
  ];
  const rec = evolve({ seed: 7, population: 8, generations: 6, elites: 2, tries: 2 }, world(CODES), reads, reads);
  assert.ok(rec.history.every((h) => h.size === 8));
  assert.equal(createHash('sha256').update(JSON.stringify(rec)).digest('hex'), 'a2b33750eedc3ee484a82b73b5c92e2436101c84a464c6265f04cbb983696fbd');
  assert.equal(rec.champion.key, '|334');
  const once = evolve({ seed: 7, population: 8, generations: 3, elites: 2, tries: 1 }, world(CODES), reads, reads);
  assert.equal(once.ok, true);
  assert.ok(once.history.every((h) => h.size === 8));
});
