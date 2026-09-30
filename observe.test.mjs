// observe.test.mjs — the self-observing creature: what it sees of itself, what it suspects, how it changes, and a whole
// three-armed evolution that must reduce, for the blind arm, to experiment 1 byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ARMS, CAP, COSTLY, TRIALS, look, selfScore, troubled, suspect, reflect, trials, evolveWith, uvGen, median, compare } from './observe.mjs';
import { SPEC, prng, world, evolve, key, canon } from './evolve.mjs';
import { sealCode } from './vendor/sealmark.mjs';

const SEALS = ['3f9a0c21d4e87b65a10f2c3d4e5f60718293a4b5c6d7e8f90112233445566778', 'c07e11aa92b3445d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5', 'e1' + 'd'.repeat(62)];
const CODES = SEALS.map(sealCode);        // 7YD0-R8EM-X1XP-B88F · R1Z1-3AMJ-PD25-TVKZ · W7EX-VQEX-VQEX-VQEX
const G = (folds, maxEdits = 3, margin = 3, maxUnknown = 4) => ({ folds, maxEdits, margin, maxUnknown });

test('the constants', () => {
  assert.deepEqual(ARMS, ['blind', 'trials', 'observe']);
  assert.deepEqual([CAP, COSTLY, TRIALS], [48, 2, 38]);
});

test('look: what a creature makes of one read, with no answer key', () => {
  const w = world(CODES);
  assert.deepEqual(look(SPEC, w, CODES[0]), { refused: false, card: 0, corrections: 0 });
  assert.deepEqual(look(SPEC, w, '7YD0-R8EM-X1XP-B8ZZ'), { refused: false, card: 0, corrections: 2 });
  assert.deepEqual(look(SPEC, w, 'W7EX-UQEX-VQEX-VQEX'), { refused: true, why: 'unknown' });        // U is not a symbol
  assert.deepEqual(look(SPEC, w, ''), { refused: true, why: 'unknown' });
  assert.deepEqual(look(SPEC, w, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'), { refused: true, why: 'unsure' });
  assert.deepEqual(look(G([['U', 'V']]), w, 'W7EX-UQEX-VQEX-VQEX'), { refused: false, card: 2, corrections: 0 });
});

test('selfScore: its own confidence — every resolution counts as right, every correction costs', () => {
  const w = world(CODES);
  const reads = [{ read: CODES[0], card: 2 }, { read: '7YD0-R8EM-X1XP-B8ZZ', card: 0 }, { read: 'W7EX-UQEX-VQEX-VQEX', card: 2 }, null, { read: 5 }];
  assert.deepEqual(selfScore(SPEC, w, reads), { resolved: 2, corrections: 2, score: 196 });   // the wrong label on read 0 is invisible to it
  assert.deepEqual(selfScore(G([['U', 'V']]), w, reads), { resolved: 3, corrections: 2, score: 296 });
  for (const bad of [[null, w, reads], [SPEC, null, reads], [SPEC, w, null]]) assert.equal(selfScore(...bad), null);
});

test('troubled: the reads it refused or that cost it ' + COSTLY + ' or more corrections, in order, capped', () => {
  const w = world(CODES);
  const reads = [
    { read: CODES[0] },                                   // clean
    { read: '7YD0-R8EM-X1XP-B88Z' },                      // one correction: not troubled
    { read: '7YD0-R8EM-X1XP-B8ZZ' },                      // two: costly
    { read: 'W7EX-UQEX-VQEX-VQEX' },                      // unknown symbol
    { read: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' },                      // unsure
    null, { read: 7 },
  ];
  assert.deepEqual(troubled(SPEC, w, reads), [{ read: '7YD0-R8EM-X1XP-B8ZZ', why: 'costly' }, { read: 'W7EX-UQEX-VQEX-VQEX', why: 'unknown' }, { read: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', why: 'unsure' }]);
  assert.equal(troubled(SPEC, w, reads, 2).length, 2);
  assert.deepEqual(troubled(SPEC, w, reads, 0), []);
  for (const bad of [[null, w, reads], [SPEC, null, reads], [SPEC, w, null], [SPEC, w, reads, -1], [SPEC, w, reads, 1.5]]) assert.equal(troubled(...bad), null);
});

test('suspect: an unknown symbol in a read refused for it first; else a character of its costly reads', () => {
  const t = [{ read: 'UUO-L?', why: 'unknown' }, { read: 'AB', why: 'costly' }];
  assert.equal(suspect(SPEC, t, prng(1)), 'U');                                                  // O and L are already read by the spec
  assert.equal(suspect(G([['U', 'V']]), [{ read: 'UA', why: 'unknown' }, { read: 'B', why: 'costly' }], () => 0), 'U');   // U is folded: only A is an alphabet char… so the pool falls back
  assert.equal(suspect(G([['U', 'V']]), [{ read: 'U', why: 'unknown' }, { read: 'BB', why: 'costly' }], () => 0), 'U');
  // weighted by count: two B to one A, a draw of 0 or 1 lands on B, 2 on A (first seen order: B then A)
  const costly = [{ read: 'BBA', why: 'costly' }];
  assert.equal(suspect(SPEC, costly, () => 0), 'B');
  assert.equal(suspect(SPEC, costly, () => 1.5 / 3), 'B');
  assert.equal(suspect(SPEC, costly, () => 2 / 3), 'A');
  // unknown refusals outrank costly reads even when rarer
  assert.equal(suspect(SPEC, [{ read: 'BBBBBBBB', why: 'costly' }, { read: 'U', why: 'unknown' }], () => 0.99), 'U');
  // an 'unsure' refusal names no unknown symbol
  assert.equal(suspect(SPEC, [{ read: 'U', why: 'unsure' }, { read: 'A', why: 'costly' }], () => 0), 'U');
  assert.equal(suspect(SPEC, [], prng(1)), null);
  assert.equal(suspect(SPEC, [{ read: '-?', why: 'costly' }], prng(1)), null);
  for (const bad of [[SPEC, null, prng(1)], [SPEC, t, null], [null, t, prng(1)]]) assert.equal(suspect(...bad), null);
  assert.equal(suspect(SPEC, [null, { read: 5 }, { read: 'Q', why: 'costly' }], () => 0), 'Q');
});

test('reflect: shown reads where V came back as U, the observer finds U → V from its own confidence alone', () => {
  const w = world(CODES);
  const reads = [{ read: 'W7EX-UQEX-VQEX-VQEX' }, { read: 'W7EX-VQEX-UQEX-UQEX' }, { read: CODES[0] }];
  const r = reflect(SPEC, w, reads, prng(3));
  assert.equal(key(r.genome), 'UV|334');
  assert.deepEqual(r.note, { troubled: 2, unknown: 2, suspect: 'U', tried: 38, from: '|334', to: 'UV|334', gain: 200 });
  assert.equal(r.looks, 39 * 2);
  // an existing fold on the suspect is re-aimed, not duplicated
  const re = reflect(G([['U', 'W']], 1, 3, 4), w, [{ read: 'W7EX-UQEX-UQEX-UQEX' }], prng(3));
  assert.equal(key(re.genome), 'UV|134');
  // nothing troubling it: it stays as it is
  const calm = reflect(SPEC, w, [{ read: CODES[0] }], prng(3));
  assert.deepEqual([key(calm.genome), calm.looks, calm.note.gain, calm.note.suspect], ['|334', 0, 0, null]);
  // a threshold nudge wins when that is what its own reads ask for
  const tight = reflect(G([], 1, 3, 4), w, [{ read: '7YD0-R8EM-X1XP-B8ZZ' }], prng(3));
  assert.equal(key(tight.genome), '|234');
  for (const bad of [[null, w, reads, prng(1)], [SPEC, null, reads, prng(1)], [SPEC, w, null, prng(1)], [SPEC, w, reads, null]]) assert.equal(reflect(...bad), null);
});

test('trials: the same self-confidence, blind candidates', () => {
  const w = world(CODES);
  const reads = [{ read: 'W7EX-UQEX-VQEX-VQEX' }, { read: CODES[0] }];
  const r = trials(SPEC, w, reads, prng(5), 10);
  assert.equal(r.looks, 11 * 1);
  assert.equal(r.note.tried, 10);
  assert.ok(r.note.gain >= 0);
  assert.notEqual(canon(r.genome), null);
  assert.equal(key(trials(SPEC, w, reads, prng(5), 0).genome), '|334');
  assert.deepEqual(trials(SPEC, w, reads, prng(5), 10), r);
  for (const bad of [[null, w, reads, prng(1), 1], [SPEC, w, reads, null, 1], [SPEC, w, reads, prng(1), -1], [SPEC, w, reads, prng(1), 1.5], [SPEC, null, reads, prng(1), 1]]) assert.equal(trials(...bad), null);
});

const READS = [
  ...CODES.map((c, card) => ({ read: c, card })),
  { read: 'W7EX-UQEX-UQEX-VQEX', card: 2 }, { read: 'W7EX-VQEX-UQEX-UQEX', card: 2 }, { read: '7YD0-R8EM-X1XP-B8ZZ', card: 0 },
  { read: 'R1Z1-3AMJ-PD25-TUKZ', card: 1 }, { read: 'R1Z1-3AMJ-PD25-T?KZ', card: 1 },
];
const CFG = { seed: 7, population: 8, generations: 6, elites: 2, tries: 2 };

test('evolveWith: the blind arm IS experiment 1, byte for byte', () => {
  const a = evolveWith(CFG, world(CODES), READS, READS, 'blind'), b = evolve(CFG, world(CODES), READS, READS);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('evolveWith: the other arms keep a diary, count their looks, and are reproducible to the byte', () => {
  for (const arm of ['trials', 'observe']) {
    const a = evolveWith(CFG, world(CODES), READS, READS, arm), b = evolveWith(CFG, world(CODES), READS, READS, arm);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(a.arm, arm);
    assert.ok(a.looks > 0);
    assert.ok(Array.isArray(a.diary) && a.diary.every((d) => d.from !== d.to && Number.isInteger(d.gen)));
    assert.ok(a.diary.every((d, i) => i === 0 || d.gen >= a.diary[i - 1].gen));
    assert.ok(a.history.every((h) => h.size === 8));
  }
  const o = evolveWith(CFG, world(CODES), READS, READS, 'observe');
  assert.equal(createHash('sha256').update(JSON.stringify(o)).digest('hex'), OBSERVE_GOLDEN);
  assert.equal(o.champion.key, OBSERVE_CHAMPION);
  for (const bad of [[CFG, world(CODES), READS, READS, 'psychic'], [CFG, null, READS, READS, 'observe'], [{ ...CFG, tries: 0 }, world(CODES), READS, READS, 'observe'], [null, world(CODES), READS, READS, 'observe'], [CFG, world(CODES), [], READS, 'observe'], [CFG, world(CODES), READS, null, 'observe']]) assert.match(evolveWith(...bad).why, /arm/);
});

test('uvGen and median', () => {
  const rec = (keys) => ({ history: keys.map((k, gen) => ({ gen, best: { key: k } })) });
  assert.equal(uvGen(rec(['|334', 'U7|334', 'UV|334', 'UV|334'])), 2);
  assert.equal(uvGen(rec(['|334', 'AB.UV|334'])), 1);
  assert.equal(uvGen(rec(['|334', 'VU|334', 'UW|334'])), null);
  for (const bad of [null, {}, { history: 'x' }, { history: [null, { best: null }, { best: { key: 5 } }] }]) assert.equal(uvGen(bad), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([5]), 5);
  for (const bad of [[], null, [1, 'x'], [NaN]]) assert.equal(median(bad), null);
});

test('compare: the six sealed rules the records decide, each at its edge', () => {
  const rec = (uvAt, fitness, wrong = 0) => ({ ok: true, champion: { held: { fitness, wrong } }, history: [{ gen: 0, best: { key: '|334' } }, ...(uvAt === null ? [] : [{ gen: uvAt, best: { key: 'UV|334' } }])] });
  const runs = (obs, blind, tri) => ({ observe: obs, blind, trials: tri });
  const eight = (f) => Array.from({ length: 8 }, (_, i) => f(i));
  const base = runs(eight(() => rec(1, 100)), eight(() => rec(14, 100)), eight(() => rec(3, 100)));
  const c = compare(base, 60);
  assert.deepEqual(c.rules.map((r) => [r.id, r.pass]), [['observer-finds-uv', true], ['faster-than-blind', true], ['faster-than-trials', true], ['not-worse', true], ['never-wrong', true]]);
  assert.deepEqual(c.medians, { blind: 14, trials: 3, observe: 1 });
  // observer-finds-uv: 7 of 8 by generation 10 passes, 6 does not; generation 10 itself counts, 11 does not
  assert.equal(compare(runs(eight((i) => rec(i < 7 ? 10 : 11, 100)), base.blind, base.trials), 60).rules[0].pass, true);
  assert.equal(compare(runs(eight((i) => rec(i < 6 ? 1 : null, 100)), base.blind, base.trials), 60).rules[0].pass, false);
  // never found counts as generations + 1
  assert.deepEqual(compare(runs(eight(() => rec(null, 100)), base.blind, base.trials), 60).medians.observe, 61);
  // faster: equal medians are not faster
  assert.equal(compare(runs(eight(() => rec(3, 100)), base.blind, base.trials), 60).rules[2].pass, false);
  assert.equal(compare(runs(eight(() => rec(14, 100)), base.blind, base.trials), 60).rules[1].pass, false);
  // not-worse: equal fitness counts; 7 of 8 passes, 6 does not
  assert.equal(compare(runs(eight((i) => rec(1, i < 7 ? 100 : 99)), base.blind, base.trials), 60).rules[3].pass, true);
  assert.equal(compare(runs(eight((i) => rec(1, i < 6 ? 100 : 99)), base.blind, base.trials), 60).rules[3].pass, false);
  // never-wrong: one wrong card anywhere fails it
  const oneWrong = compare(runs(eight((i) => rec(1, 100, i === 3 ? 1 : 0)), base.blind, base.trials), 60).rules[4];
  assert.deepEqual([oneWrong.pass, oneWrong.value], [false, '1 wrong across 8 champions']);
  assert.equal(compare(runs([rec(1, 100)], [rec(2, 100)], [rec(3, 100)]), 60).rules[0].pass, true);           // one seed: 1 of 1
  for (const bad of [[null, 60], [runs([], [], []), 60], [runs(eight(() => rec(1, 100)), base.blind, [rec(1, 1)]), 60], [runs([null], [rec(1, 1)], [rec(1, 1)]), 60], [runs([{ ok: true, champion: {} }], [rec(1, 1)], [rec(1, 1)]), 60], [base, 0], [base, 1.5]]) assert.match(compare(...bad).why, /one record per seed/);
});

test('fuzz: the observer never throws on garbage', () => {
  const junk = [undefined, null, 0, '', 'x', [], {}, [null], [{}], [{ read: 5 }], { folds: 5 }, () => 1, SPEC];
  const w = world(CODES);
  for (const a of junk) for (const b of junk) assert.doesNotThrow(() => {
    look(a, w, b); selfScore(a, w, b); troubled(a, w, b); suspect(a, b, prng(1)); suspect(SPEC, b, () => 0);
    reflect(a, w, b, prng(1)); trials(a, w, b, prng(1), 2); evolveWith(a, w, b, b, 'observe'); uvGen(a); median(a); compare(a, 60); compare({ observe: a, blind: b, trials: a }, 60);
  });
});

const OBSERVE_GOLDEN = 'd97cf9cedab8d72dd3fae11d283545ccafc7f1893fdd9bd36c7da1ca90b1e348', OBSERVE_CHAMPION = 'UV|227';

test('evolveWith: every configuration limit at its edge', () => {
  const run = (cfg, extra = {}) => evolveWith({ ...CFG, generations: 1, ...cfg }, extra.w === undefined ? world(CODES) : extra.w, extra.train || READS, extra.held === undefined ? READS : extra.held, 'observe');
  assert.equal(run({ population: 2, elites: 1 }).ok, true);
  assert.match(run({ population: 1, elites: 1 }).why, /arm/);
  assert.equal(run({ generations: 1 }).ok, true);
  assert.match(run({ generations: 0 }).why, /arm/);
  assert.equal(run({ elites: 1 }).ok, true);
  assert.match(run({ elites: 0 }).why, /arm/);
  assert.equal(run({ elites: 7 }).ok, true);                                                     // one below the population
  assert.match(run({ elites: 8 }).why, /arm/);                                                   // equal to it
  assert.equal(run({ tries: 1 }).ok, true);
  assert.match(run({ tries: 0 }).why, /arm/);
  for (const k of ['population', 'generations', 'elites', 'tries']) assert.match(run({ [k]: 2.5 }).why, /arm/);
  assert.match(run({}, { w: null }).why, /arm/);
  assert.match(run({}, { train: [] }).why, /arm/);
  assert.match(run({}, { held: 'x' }).why, /arm/);
  assert.equal(run({}, { held: [] }).ok, true);
});
