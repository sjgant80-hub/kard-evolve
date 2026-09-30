// ════════════════════════════════════════════════════════════════════════════════════════════════
// evolve.mjs · KARD-EVOLVE — creatures that evolve, measurably, and that anyone can re-run.
//
// The first step of the kard-creatures vision. A creature here is a READER of damaged seal codes (FallKard's printed
// seal, CARD-SPEC §7.1). Its genome is a handful of genes:
//   · folds — "read character X as Y", X any of 36 letters and digits, Y any of the 32 code symbols; nothing in this
//     file favours any particular fold;
//   · three thresholds — how many edits it will accept, how far ahead of the runner-up the best card must be, and how
//     many unreadable symbols it tolerates.
// Its phenotype is what it does: fold the read, then resolve it against the deck exactly as the spec does. Its fitness
// is measured, never assigned: 100 for every read it resolves to the right card, −400 for every wrong card, −2 for
// every correction it needed along the way, 0 for a refusal. A sure read beats a lucky one.
//
// Evolution is real selection: creatures battle (the fitter on the same reads wins), winners breed (a child takes genes
// from both, and is only born if it passes the birth gate), children mutate, the best survive. Everything runs off one
// seeded generator, so the same seed and the same world give the same champion, byte for byte, on anyone's machine.
//
// Pure: no I/O, no clock, no Math.random. Uses the vendored, gated sealmark kernel (vendor/sealmark.mjs).
// ════════════════════════════════════════════════════════════════════════════════════════════════
import { ALPHABET, normalizeCode, readDistance } from './vendor/sealmark.mjs';

export const SOURCE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';      // what a fold may read: every letter and digit
export const BOUNDS = { maxEdits: [0, 6], margin: [1, 6], maxUnknown: [0, 8], folds: 8 };
export const SPEC = { folds: [], maxEdits: 3, margin: 3, maxUnknown: 4 };   // the spec's own reader, CARD-SPEC §7.1
// fitness, in whole numbers: a right card is worth RIGHT, a wrong card costs WRONG, and every correction the creature
// had to make to get there costs EDIT — so of two readers that both find the card, the surer one is fitter.
export const RIGHT = 100, WRONG = -400, EDIT = -2;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const inside = (v, [lo, hi]) => isInt(v) && v >= lo && v <= hi;
const FROM = /^[0-9A-Z]$/;
const TO = new RegExp('^[' + ALPHABET + ']$');
const code0 = (c) => c.charCodeAt(0);

// prng(seed) — mulberry32: 32-bit integer steps only, so every machine draws the same sequence.
export function prng(seed) {
  let s = (Number.isInteger(seed) ? seed : 0) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, n) => Math.floor(rng() * n);
const coin = (rng) => pick(rng, 2) === 0;

// canon(g) — a genome in its one true form: folds de-duplicated by what they read (first wins), sorted, capped;
// thresholds inside their bounds. Anything that is not a genome is null.
export function canon(g) {
  if (!isObj(g) || !Array.isArray(g.folds) || !inside(g.maxEdits, BOUNDS.maxEdits) || !inside(g.margin, BOUNDS.margin) || !inside(g.maxUnknown, BOUNDS.maxUnknown)) return null;
  const seen = new Set(), folds = [];
  for (const f of g.folds) {
    if (!Array.isArray(f) || f.length !== 2 || typeof f[0] !== 'string' || typeof f[1] !== 'string' || !FROM.test(f[0]) || !TO.test(f[1]) || f[0] === f[1]) return null;
    if (!seen.has(f[0])) { seen.add(f[0]); folds.push([f[0], f[1]]); }
  }
  if (folds.length > BOUNDS.folds) return null;
  folds.sort((a, b) => SOURCE.indexOf(a[0]) - SOURCE.indexOf(b[0]));
  return { folds, maxEdits: g.maxEdits, margin: g.margin, maxUnknown: g.maxUnknown };
}

// key(g) — a genome as one short string, for ordering, memory and hashing.
export function key(g) {
  const c = canon(g);
  return c === null ? null : c.folds.map((f) => f[0] + f[1]).join('.') + '|' + c.maxEdits + c.margin + c.maxUnknown;
}

// express(read, g) — the creature's reading of a damaged code: its folds, one pass, then the spec's normalisation.
export function express(read, g) {
  const c = canon(g);
  if (c === null || typeof read !== 'string') return null;
  const map = Object.fromEntries(c.folds);
  return normalizeCode([...read.toUpperCase()].map((ch) => map[ch] || ch).join(''));
}

// decide(dist, unknown, g) — the spec's resolution rule, given the read's edit distance to every card.
// Returns the index of the card, or -1 for a refusal.
export function decide(dist, unknown, g) {
  if (!Array.isArray(dist) || dist.length === 0 || !isInt(unknown) || !isObj(g)) return -1;
  if (unknown > g.maxUnknown) return -1;
  const best = Math.min(...dist), at = dist.indexOf(best);
  const second = Math.min(...dist.filter((_, i) => i !== at));      // no runner-up at all is Infinity: never within the margin
  if (best > g.maxEdits) return -1;
  return second - best < g.margin ? -1 : at;
}

// world(codes) — a place creatures live: the deck they resolve against, and a memory of every read's distances, so a
// read two creatures fold the same way is only measured once.
export function world(codes) {
  if (!Array.isArray(codes) || codes.length === 0 || codes.some((c) => typeof c !== 'string' || c.length === 0)) return null;
  const flat = codes.map((c) => c.replace(/-/g, ''));
  const memo = new Map();
  const measure = (norm) => {
    if (!memo.has(norm)) memo.set(norm, { dist: flat.map((c) => readDistance(norm, c)), unknown: (norm.match(/\?/g) || []).length });
    return memo.get(norm);
  };
  return { size: flat.length, measure, memoSize: () => memo.size };
}

// score(g, w, reads) — fitness on a set of reads [{ read, card }]: RIGHT per right card, WRONG per wrong card, EDIT per
// correction used on every card it named, nothing for a refusal.
export function score(g, w, reads) {
  const c = canon(g);
  if (c === null || !w || !Array.isArray(reads)) return null;
  let right = 0, wrong = 0, refused = 0, edits = 0;
  for (const r of reads) {
    const norm = express(r && r.read, c);
    const m = norm === null || norm.length === 0 ? null : w.measure(norm);
    const card = m === null ? -1 : decide(m.dist, m.unknown, c);
    if (card === -1) { refused++; continue; }
    edits += m.dist[card];
    if (card === r.card) right++;
    else wrong++;
  }
  return { fitness: RIGHT * right + WRONG * wrong + EDIT * edits, right, wrong, refused, edits, n: reads.length };
}

// ── the world's damage: measured, then re-applied ─────────────────────────────────────────────────────
// slipTable(reads, codes) — the confusions actually observed: for every read as long as its card's code, each position
// where they differ is one (true → read). Counted, most common first. reads: [{ read, card }].
export function slipTable(reads, codes) {
  if (!Array.isArray(reads) || !Array.isArray(codes)) return null;
  const count = new Map();
  for (const r of reads) {
    const code = r && codes[r.card], read = r && typeof r.read === 'string' ? r.read.toUpperCase() : null;
    if (typeof code !== 'string' || read === null || read.length !== code.length) continue;
    [...code].forEach((ch, i) => { if (read[i] !== ch) { const k = ch + read[i]; count.set(k, (count.get(k) || 0) + 1); } });
  }
  return [...count].map(([k, n]) => [k[0], k[1], n]).sort((a, b) => b[2] - a[2] || code0(a[0]) - code0(b[0]) || code0(a[1]) - code0(b[1]));
}

// a slip table is rows of [true character, character read, how often] — anything else is not one
const isTable = (t) => Array.isArray(t) && t.every((row) => Array.isArray(row) && row.length === 3 && typeof row[0] === 'string' && row[0].length === 1 && typeof row[1] === 'string' && row[1].length === 1 && isInt(row[2]) && row[2] > 0);

// damage(code, table, k, rng) — the code with up to k of the measured slips, each at a different position, each
// drawn in proportion to how often it was seen. A slip whose true character the code does not hold is not possible.
export function damage(code, table, k, rng) {
  if (typeof code !== 'string' || !isTable(table) || !isInt(k) || typeof rng !== 'function') return null;
  const out = [...code], used = new Set();
  for (let s = 0; s < k; s++) {
    const open = table.flatMap(([from, to, n]) => [...code].map((ch, i) => (ch === from && !used.has(i) ? { i, to, n } : null)).filter(Boolean));
    const total = open.reduce((a, o) => a + o.n, 0);
    if (total === 0) break;
    let r = pick(rng, total);                                         // a whole number below the total always lands
    const chosen = open.find((o) => { if (r < o.n) return true; r -= o.n; return false; });
    out[chosen.i] = chosen.to;
    used.add(chosen.i);
  }
  return out.join('');
}

// synthesize(codes, cards, table, perCard, seed) — deliberately damaged reads: for each card index in cards, perCard
// copies of its code, each with 1–5 measured slips.
export function synthesize(codes, cards, table, perCard, seed) {
  if (!Array.isArray(codes) || !Array.isArray(cards) || cards.some((c) => typeof codes[c] !== 'string') || !isTable(table) || !isInt(perCard) || perCard < 0) return null;
  const rng = prng(seed), out = [];
  for (const card of cards) for (let v = 0; v < perCard; v++) {
    const k = 1 + pick(rng, 5);
    out.push({ read: damage(codes[card], table, k, rng), card, slips: k });
  }
  return out;
}

// randomGenome(rng) — a newborn of generation 0: thresholds anywhere in bounds, up to two random folds.
export function randomGenome(rng) {
  const span = ([lo, hi]) => lo + pick(rng, hi - lo + 1);
  const folds = Array.from({ length: pick(rng, 3) }, () => randomFold(rng));
  return canon({ folds, maxEdits: span(BOUNDS.maxEdits), margin: span(BOUNDS.margin), maxUnknown: span(BOUNDS.maxUnknown) });
}
function randomFold(rng) {
  const from = SOURCE[pick(rng, SOURCE.length)];
  const choices = [...ALPHABET].filter((s) => s !== from);
  return [from, choices[pick(rng, choices.length)]];
}

// mutate(g, rng) — one random change: gain a fold, lose one, re-aim one, or nudge a threshold by one.
export function mutate(g, rng) {
  const c = canon(g);
  if (c === null) return null;
  const folds = c.folds.map((f) => [...f]);
  const t = { maxEdits: c.maxEdits, margin: c.margin, maxUnknown: c.maxUnknown };
  const op = pick(rng, 4);
  if (op === 0) folds.push(randomFold(rng));
  else if (op === 1 && folds.length) folds.splice(pick(rng, folds.length), 1);
  else if (op === 2 && folds.length) { const i = pick(rng, folds.length), choices = [...ALPHABET].filter((s) => s !== folds[i][0]); folds[i][1] = choices[pick(rng, choices.length)]; }
  else {
    const name = ['maxEdits', 'margin', 'maxUnknown'][pick(rng, 3)], [lo, hi] = BOUNDS[name];
    t[name] = Math.min(hi, Math.max(lo, t[name] + (coin(rng) ? -1 : 1)));
  }
  return canon({ folds: folds.slice(0, BOUNDS.folds), ...t });
}

// crossover(a, b, rng) — a child: each parent's folds kept at a coin's toss, each threshold from one parent or the other.
export function crossover(a, b, rng) {
  const A = canon(a), B = canon(b);
  if (A === null || B === null) return null;
  const folds = [...A.folds, ...B.folds].filter(() => coin(rng));
  const from = (name) => (coin(rng) ? A : B)[name];
  return canon({ folds: folds.slice(0, BOUNDS.folds), maxEdits: from('maxEdits'), margin: from('margin'), maxUnknown: from('maxUnknown') });
}

// carriesBoth(child, a, b) — the birth gate's first half: the child (as crossover made it, before any mutation) holds
// at least one gene from EACH parent. A gene is a fold or a threshold value; one both parents hold counts for both.
export function carriesBoth(child, a, b) {
  const C = canon(child), A = canon(a), B = canon(b);
  if (C === null || A === null || B === null) return false;
  const genes = (g) => new Set([...g.folds.map((f) => 'f' + f[0] + f[1]), 'e' + g.maxEdits, 'm' + g.margin, 'u' + g.maxUnknown]);
  const cg = [...genes(C)], ga = genes(A), gb = genes(B);
  return cg.some((x) => ga.has(x)) && cg.some((x) => gb.has(x));
}

// rank(pop) — creatures [{ g, k, fit }] best first: fitness, then fewer folds; creatures alike in both keep their
// population order (the sort is stable, and the population's order is itself fixed by the seed).
export function rank(pop) {
  if (!Array.isArray(pop) || pop.some((c) => !isObj(c) || !isObj(c.fit) || !isInt(c.fit.fitness) || !isObj(c.g) || !Array.isArray(c.g.folds) || typeof c.k !== 'string')) return null;
  return [...pop].sort((x, y) => y.fit.fitness - x.fit.fitness || x.g.folds.length - y.g.folds.length);
}

// birthGate(crossed, child, a, b) — may this child be born? Both lineages carried (checked on the crossover, before
// mutation adds anything), and the child no weaker than the weaker parent. child, a, b: { g, fit }.
export function birthGate(crossed, child, a, b) {
  if (![child, a, b].every((x) => isObj(x) && isObj(x.fit) && isInt(x.fit.fitness))) return false;
  return carriesBoth(crossed, a.g, b.g) && child.fit.fitness >= Math.min(a.fit.fitness, b.fit.fitness);
}

// evolve(config, w, train, held) — the whole history. config: { seed, population, generations, elites, tries }.
// Returns every generation's best (with its held-out score, which selection never sees) and the genes spreading through
// it, the champion, generation 0's best, and the champion's family line back to generation 0.
export function evolve(config, w, train, held) {
  const cfg = isObj(config) ? config : {};
  const P = cfg.population, G = cfg.generations, E = cfg.elites, T = cfg.tries;
  if (![P, G, E, T].every(isInt) || P < 2 || G < 1 || E < 1 || E >= P || T < 1 || !w || !Array.isArray(train) || !Array.isArray(held) || train.length === 0) return { ok: false, why: 'config { seed, population, generations, elites, tries }, a world, and reads to train and test on' };
  const rng = prng(cfg.seed);
  let id = 0;
  const born = (g, gen, parents) => { const c = canon(g); return { id: id++, gen, parents, g: c, k: key(c), fit: score(c, w, train) }; };
  let pop = [born(SPEC, 0, [])];
  while (pop.length < P) pop.push(born(randomGenome(rng), 0, []));
  const ancestry = new Map(pop.map((c) => [c.id, c]));
  const gen0best = rank(pop)[0];
  const history = [];
  const battle = () => { const x = pop[pick(rng, pop.length)], y = pop[pick(rng, pop.length)]; return rank([x, y])[0]; };
  const genes = () => { const n = new Map(); for (const c of pop) for (const [a, b] of c.g.folds) n.set(a + b, (n.get(a + b) || 0) + 1); return [...n].sort((x, y) => y[1] - x[1] || code0(x[0]) - code0(y[0]) || x[0].charCodeAt(1) - y[0].charCodeAt(1)).slice(0, 6); };
  const note = (gen) => { const top = rank(pop)[0]; history.push({ gen, size: pop.length, best: { id: top.id, key: top.k, fitness: top.fit.fitness, right: top.fit.right, wrong: top.fit.wrong }, held: score(top.g, w, held), mean: Math.round((pop.reduce((s, c) => s + c.fit.fitness, 0) / pop.length) * 100) / 100, genes: genes() }); };
  note(0);
  for (let gen = 1; gen <= G; gen++) {
    const next = rank(pop).slice(0, E);
    while (next.length < P) {
      const a = battle(), b = battle();
      let child = null;
      for (let t = 0; t < T && child === null; t++) {
        const crossed = crossover(a.g, b.g, rng);
        const c = born(mutate(crossed, rng), gen, [a.id, b.id]);
        if (birthGate(crossed, c, a, b)) child = c;
      }
      // a coupling that fails the gate bears nothing: the stronger parent carries on in the slot instead
      next.push(child || rank([a, b])[0]);
    }
    pop = next;
    for (const c of pop) ancestry.set(c.id, c);
    note(gen);
  }
  const champion = rank(pop)[0];
  const line = [];
  for (let c = champion; c; c = c.parents.length ? ancestry.get(rank(c.parents.map((p) => ancestry.get(p)))[0].id) : null) line.push({ id: c.id, gen: c.gen, key: c.k });
  return {
    ok: true, history, memo: w.memoSize(),
    champion: { id: champion.id, gen: champion.gen, genome: champion.g, key: champion.k, train: champion.fit, held: score(champion.g, w, held) },
    gen0: { id: gen0best.id, genome: gen0best.g, key: gen0best.k, train: gen0best.fit, held: score(gen0best.g, w, held) },
    line,
  };
}

// ── the experiment ─────────────────────────────────────────────────────────────────────────────────────
// habitat(data, cfg) — the world the creatures live in, from the committed real reads: training = the real reads of the
// training cards plus perCard deliberately damaged copies of each; held out = the same for the held-out cards. The
// damage is drawn ONLY from the slips measured on the training cards' real reads, so nothing about the held-out cards
// leaks into training. data: { codes, real: [{ card, read }], split: { train, held } }; cfg: { perCard, trainSeed, heldSeed }.
export function habitat(data, cfg) {
  const ok = isObj(data) && Array.isArray(data.codes) && Array.isArray(data.real) && isObj(data.split) && Array.isArray(data.split.train) && Array.isArray(data.split.held) && isObj(cfg) && isInt(cfg.perCard) && isInt(cfg.trainSeed) && isInt(cfg.heldSeed);
  if (!ok || data.real.some((r) => !isObj(r) || !isInt(r.card) || typeof r.read !== 'string')) return { ok: false, why: 'data { codes, real, split } and cfg { perCard, trainSeed, heldSeed }' };
  const inTrain = new Set(data.split.train), inHeld = new Set(data.split.held);
  if (data.split.train.some((c) => inHeld.has(c))) return { ok: false, why: 'a card cannot be in training and held out' };
  const realTrain = data.real.filter((r) => inTrain.has(r.card)).map((r) => ({ read: r.read, card: r.card }));
  const realHeld = data.real.filter((r) => inHeld.has(r.card)).map((r) => ({ read: r.read, card: r.card }));
  const table = slipTable(realTrain, data.codes);
  const synthTrain = synthesize(data.codes, data.split.train, table, cfg.perCard, cfg.trainSeed), synthHeld = synthesize(data.codes, data.split.held, table, cfg.perCard, cfg.heldSeed);
  if (synthTrain === null || synthHeld === null) return { ok: false, why: 'every card in the split needs a code' };
  return { ok: true, codes: data.codes, table, train: [...realTrain, ...synthTrain], held: [...realHeld, ...synthHeld], realHeld };
}

// judge(record, h, w) — the four rules sealed in data/prereg.json that the record alone can decide, each with the number
// that decided it. (The fifth, that the run is reproducible, is decided by re-running it: CI does, and so can the page.)
export function judge(record, h, w) {
  const ch = isObj(record) ? record.champion : null, g0 = isObj(record) ? record.gen0 : null;
  const held = (x) => isObj(x) && isObj(x.held) && isInt(x.held.fitness) && isInt(x.held.wrong) && isInt(x.held.n);
  if (!isObj(record) || record.ok !== true || !held(ch) || canon(ch.genome) === null || !held(g0) || !isObj(h) || h.ok !== true || !Array.isArray(h.realHeld) || !w) return { ok: false, why: 'a record from evolve and its habitat' };
  const champReal = score(ch.genome, w, h.realHeld), specReal = score(SPEC, w, h.realHeld);
  const rules = [
    { id: 'beats-gen0', pass: ch.held.fitness > g0.held.fitness, value: ch.held.fitness + ' vs ' + g0.held.fitness },
    { id: 'u-to-v', pass: ch.genome.folds.some(([a, b]) => a === 'U' && b === 'V'), value: describe(ch.genome) },
    { id: 'never-wrong', pass: ch.held.wrong === 0, value: ch.held.wrong + ' wrong of ' + ch.held.n },
    { id: 'real-held', pass: champReal.right > specReal.right && champReal.wrong === 0, value: champReal.right + ' vs ' + specReal.right + ' of ' + champReal.n + ', ' + champReal.wrong + ' wrong' },
  ];
  return { ok: true, rules, passed: rules.filter((r) => r.pass).length, of: rules.length, champReal, specReal };
}

// describe(g) — a genome in plain words.
export function describe(g) {
  const c = canon(g);
  if (c === null) return null;
  const folds = c.folds.length ? 'reads ' + c.folds.map(([a, b]) => a + ' as ' + b).join(', ') : 'folds nothing';
  return folds + '; accepts up to ' + c.maxEdits + ' edit' + (c.maxEdits === 1 ? '' : 's') + ' when no other card is within ' + c.margin + ' more, with at most ' + c.maxUnknown + ' unreadable';
}

export default { prng, canon, key, express, decide, world, score, slipTable, damage, synthesize, randomGenome, mutate, crossover, carriesBoth, rank, birthGate, evolve, habitat, judge, describe };
