// ════════════════════════════════════════════════════════════════════════════════════════════════
// observe.mjs · THE SELF-OBSERVING CREATURE — kard-evolve, experiment 2.
//
// In experiment 1 (evolve.mjs, sealed) creatures changed by blind mutation and the world selected. Here a creature
// can also WATCH ITSELF: it looks at the reads it refused and the reads that cost it many corrections — things it can
// see about itself, never the answer key — works out what troubled it, proposes changes to its own genes, and scores
// them by its own confidence. The world still decides who lives: selection is exactly experiment 1's.
//
// Three ways a child can change, compared on the same world, the same seeds and the same selection:
//   · blind    — experiment 1's one random mutation;
//   · trials   — the control: the same number of candidate changes as the observer, drawn blind, scored by the same
//                self-confidence on the same troubled reads. It has the observer's compute, not its eyes;
//   · observe  — candidates drawn from what troubled it: a symbol it does not know in a read it refused, else the
//                characters of its costly reads, re-aimed to every code symbol; plus a nudge to each threshold.
//
// Pure: no I/O, no clock, no Math.random. Builds on the sealed evolve.mjs without changing it.
// ════════════════════════════════════════════════════════════════════════════════════════════════
import { SOURCE, SPEC, RIGHT, EDIT, BOUNDS, prng, canon, key, express, decide, score, randomGenome, mutate, crossover, rank, birthGate } from './evolve.mjs';
import { ALPHABET } from './vendor/sealmark.mjs';

export const ARMS = ['blind', 'trials', 'observe'];
export const CAP = 48;                                   // how many of its troubled reads a creature looks at
export const COSTLY = 2;                                 // a read that needed this many corrections troubled it
export const TRIALS = 38;                                // the control's candidates: the most the observer ever tries (32 re-aims + 6 nudges)

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const pick = (rng, n) => Math.floor(rng() * n);
const FOLDED = new Set(['O', 'I', 'L']);                 // the spec already reads these (O→0, I and L→1)

// look(g, w, read) — what the creature makes of one read, with no answer key: refused (and why), or the card it
// names, how many corrections it needed, and how far ahead of the runner-up that card was.
export function look(g, w, read) {
  const norm = express(read, g);
  if (norm === null || norm.length === 0) return { refused: true, why: 'unknown' };
  const m = w.measure(norm), card = decide(m.dist, m.unknown, g);
  if (card === -1) return { refused: true, why: 'unsure' };
  return { refused: false, card, corrections: m.dist[card] };
}

// selfScore(g, w, reads) — the creature's own confidence over reads: RIGHT for every read it resolves (it cannot know
// whether the card is right), EDIT for every correction. The same scale as its fitness, without the answer key.
export function selfScore(g, w, reads) {
  if (canon(g) === null || !w || !Array.isArray(reads)) return null;
  let resolved = 0, corrections = 0;
  for (const r of reads) { const s = look(g, w, r && r.read); if (!s.refused) { resolved++; corrections += s.corrections; } }
  return { resolved, corrections, score: RIGHT * resolved + EDIT * corrections };
}

// troubled(g, w, reads, cap) — the reads it refused, or that cost it COSTLY or more corrections; the first cap of them.
export function troubled(g, w, reads, cap = CAP) {
  if (canon(g) === null || !w || !Array.isArray(reads) || !isInt(cap) || cap < 0) return null;
  const out = [];
  for (const r of reads) {
    if (out.length === cap) break;
    if (!isObj(r) || typeof r.read !== 'string') continue;
    const s = look(g, w, r.read);
    if (s.refused || s.corrections >= COSTLY) out.push({ read: r.read, why: s.refused ? s.why : 'costly' });
  }
  return out;
}

// suspect(g, trouble, rng) — the character the observer looks into: a symbol it does not know in a read it refused for
// that reason, drawn in proportion to how often it appears there; failing that, a character of its costly reads, the same
// way. null when nothing troubled it.
export function suspect(g, trouble, rng) {
  if (!Array.isArray(trouble) || typeof rng !== 'function' || canon(g) === null) return null;
  const folds = new Set(canon(g).folds.map(([a]) => a));
  const tally = (rows, keep) => {
    const n = new Map();
    for (const t of rows) if (isObj(t) && typeof t.read === 'string') for (const ch of t.read.toUpperCase()) if (SOURCE.includes(ch) && keep(ch)) n.set(ch, (n.get(ch) || 0) + 1);
    return [...n];
  };
  const unknown = tally(trouble.filter((t) => isObj(t) && t.why === 'unknown'), (ch) => !ALPHABET.includes(ch) && !FOLDED.has(ch) && !folds.has(ch));
  const pool = unknown.length ? unknown : tally(trouble, () => true);
  const total = pool.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return null;
  let r = pick(rng, total);
  return pool.find(([, n]) => { if (r < n) return true; r -= n; return false; })[0];
}

const nudges = (c) => ['maxEdits', 'margin', 'maxUnknown'].flatMap((name) => [-1, 1].map((d) => ({ ...c, [name]: c[name] + d }))).map(canon).filter((x) => x !== null);
const best = (g, w, trouble, candidates) => {
  let top = { genome: canon(g), score: selfScore(g, w, trouble).score };
  for (const c of candidates) { const s = selfScore(c, w, trouble).score; if (s > top.score) top = { genome: c, score: s }; }
  return top;
};

// reflect(g, w, reads, rng) — the observer's change: look at what troubled it, try every re-aiming of the suspect
// character and a nudge to each threshold, keep the one its own confidence says is best — or stay as it is.
export function reflect(g, w, reads, rng) {
  const c = canon(g), trouble = troubled(c, w, reads);
  if (c === null || trouble === null || typeof rng !== 'function') return null;
  const base = selfScore(c, w, trouble).score;
  const ch = suspect(c, trouble, rng);
  const aims = ch === null ? [] : [...ALPHABET].filter((t) => t !== ch).map((t) => canon({ ...c, folds: [...c.folds.filter(([a]) => a !== ch), [ch, t]] })).filter((x) => x !== null);
  const candidates = [...aims, ...nudges(c)];
  const top = best(c, w, trouble, candidates);
  return { genome: top.genome, looks: (candidates.length + 1) * trouble.length, note: { troubled: trouble.length, unknown: trouble.filter((t) => t.why === 'unknown').length, suspect: ch, tried: candidates.length, from: key(c), to: key(top.genome), gain: top.score - base } };
}

// trials(g, w, reads, rng, k) — the control: k blind mutations, scored by the same self-confidence on the same troubled
// reads; keep the best, or stay as it is.
export function trials(g, w, reads, rng, k) {
  const c = canon(g), trouble = troubled(c, w, reads);
  if (c === null || trouble === null || typeof rng !== 'function' || !isInt(k) || k < 0) return null;
  const base = selfScore(c, w, trouble).score;
  const candidates = Array.from({ length: k }, () => mutate(c, rng));
  const top = best(c, w, trouble, candidates);
  return { genome: top.genome, looks: (k + 1) * trouble.length, note: { troubled: trouble.length, tried: k, from: key(c), to: key(top.genome), gain: top.score - base } };
}

// evolveWith(config, w, train, held, arm) — experiment 1's evolution, with the child's change made by the arm. For arm
// 'blind' the record is experiment 1's, byte for byte (tested). Adds how many reads the creatures looked at, and the
// champion's diary: every self-change along its family line, in its own words.
export function evolveWith(config, w, train, held, arm) {
  const cfg = isObj(config) ? config : {};
  const P = cfg.population, G = cfg.generations, E = cfg.elites, T = cfg.tries;
  if (![P, G, E, T].every(isInt) || P < 2 || G < 1 || E < 1 || E >= P || T < 1 || !w || !Array.isArray(train) || !Array.isArray(held) || train.length === 0 || !ARMS.includes(arm)) return { ok: false, why: 'config, a world, reads to train and test on, and an arm: ' + ARMS.join(', ') };
  const rng = prng(cfg.seed);
  const K = TRIALS;
  let id = 0, looks = 0;
  const born = (g, gen, parents, note) => { const c = canon(g); return { id: id++, gen, parents, note, g: c, k: key(c), fit: score(c, w, train) }; };
  const vary = (g) => {
    if (arm === 'blind') return { genome: mutate(g, rng), note: null };
    const r = arm === 'observe' ? reflect(g, w, train, rng) : trials(g, w, train, rng, K);
    looks += r.looks;
    return r;
  };
  let pop = [born(SPEC, 0, [], null)];
  while (pop.length < P) pop.push(born(randomGenome(rng), 0, [], null));
  const ancestry = new Map(pop.map((c) => [c.id, c]));
  const gen0best = rank(pop)[0];
  const history = [];
  const battle = () => { const x = pop[pick(rng, pop.length)], y = pop[pick(rng, pop.length)]; return rank([x, y])[0]; };
  const code0 = (s) => s.charCodeAt(0);
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
        const v = vary(crossed);
        const c = born(v.genome, gen, [a.id, b.id], v.note);
        if (birthGate(crossed, c, a, b)) child = c;
      }
      next.push(child || rank([a, b])[0]);
    }
    pop = next;
    for (const c of pop) ancestry.set(c.id, c);
    note(gen);
  }
  const champion = rank(pop)[0];
  const line = [];
  for (let c = champion; c; c = c.parents.length ? ancestry.get(rank(c.parents.map((p) => ancestry.get(p)))[0].id) : null) line.push({ id: c.id, gen: c.gen, key: c.k });
  const diary = [];
  for (let c = champion; c; c = c.parents.length ? ancestry.get(rank(c.parents.map((p) => ancestry.get(p)))[0].id) : null) if (c.note && c.note.from !== c.note.to) diary.push({ gen: c.gen, ...c.note });
  const record = {
    ok: true, history, memo: w.memoSize(),
    champion: { id: champion.id, gen: champion.gen, genome: champion.g, key: champion.k, train: champion.fit, held: score(champion.g, w, held) },
    gen0: { id: gen0best.id, genome: gen0best.g, key: gen0best.k, train: gen0best.fit, held: score(gen0best.g, w, held) },
    line,
  };
  return arm === 'blind' ? record : { ...record, arm, looks, diary: diary.reverse() };
}

// ── the comparison ─────────────────────────────────────────────────────────────────────────────────────
// uvGen(record) — the first generation whose best creature reads U as V, or null.
export function uvGen(record) {
  if (!isObj(record) || !Array.isArray(record.history)) return null;
  const h = record.history.find((x) => isObj(x) && isObj(x.best) && typeof x.best.key === 'string' && x.best.key.split('|')[0].split('.').includes('UV'));
  return h ? h.gen : null;
}

// median(xs) — the middle value; for an even count, the mean of the middle two.
export function median(xs) {
  if (!Array.isArray(xs) || xs.length === 0 || xs.some((x) => typeof x !== 'number' || Number.isNaN(x))) return null;
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// compare(runs, generations) — the six rules sealed in data/observe-prereg.json that the records decide (the seventh,
// reproducibility, is decided by re-running). runs: { blind: [record…], trials: [record…], observe: [record…] }, one
// record per seed in the same seed order. A U → V never found counts as generation generations + 1.
export function compare(runs, generations) {
  const ok = isObj(runs) && ARMS.every((a) => Array.isArray(runs[a]) && runs[a].length > 0 && runs[a].length === runs.blind.length && runs[a].every((r) => isObj(r) && r.ok === true && isObj(r.champion) && isObj(r.champion.held))) && isInt(generations) && generations > 0;
  if (!ok) return { ok: false, why: 'one record per seed for each arm, and the number of generations' };
  const n = runs.blind.length, never = generations + 1;
  const uv = Object.fromEntries(ARMS.map((a) => [a, runs[a].map((r) => { const g = uvGen(r); return g === null ? never : g; })]));
  const med = Object.fromEntries(ARMS.map((a) => [a, median(uv[a])]));
  const held = (a, i) => runs[a][i].champion.held.fitness;
  const byTen = uv.observe.filter((g) => g <= 10).length;
  const notWorse = runs.observe.filter((_, i) => held('observe', i) >= held('blind', i)).length;
  const wrong = runs.observe.reduce((s, r) => s + r.champion.held.wrong, 0);
  const allSure = runs.observe.every((r) => r.champion.held.wrong === 0);
  const rules = [
    { id: 'observer-finds-uv', pass: byTen * 8 >= n * 7, value: byTen + ' of ' + n + ' seeds by generation 10' },
    { id: 'faster-than-blind', pass: med.observe < med.blind, value: 'median generation ' + med.observe + ' vs ' + med.blind },
    { id: 'faster-than-trials', pass: med.observe < med.trials, value: 'median generation ' + med.observe + ' vs ' + med.trials },
    { id: 'not-worse', pass: notWorse * 8 >= n * 7, value: notWorse + ' of ' + n + ' seeds at least as fit on held-out' },
    { id: 'never-wrong', pass: allSure, value: wrong + ' wrong across ' + n + ' champions' },
  ];
  return { ok: true, rules, passed: rules.filter((r) => r.pass).length, of: rules.length, uv, medians: med };
}

export default { ARMS, CAP, COSTLY, TRIALS, look, selfScore, troubled, suspect, reflect, trials, evolveWith, uvGen, median, compare };
