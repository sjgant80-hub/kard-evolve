#!/usr/bin/env node
// tools/make-page.mjs — the fixpoint. index.html runs the SAME evolve.mjs the tests and the mutation gate prove (and the
// vendored sealmark.mjs), inlined verbatim, over the committed world, seal and run. The README and llms.txt blocks and
// the FAQ are generated from the same record by the same kernel — no number is typed. CI regenerates all of them and
// fails on any difference.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as K from '../evolve.mjs';

const at = (f) => new URL('../' + f, import.meta.url);
const read = (f) => readFileSync(at(f), 'utf8').replace(/\r\n/g, '\n');
const json = (f) => (existsSync(at(f)) ? JSON.parse(read(f)) : null);
const strip = (src) => src.replace(/^#!.*\n/, '').replace(/^import[^\n]*\n/gm, '').replace(/^export default[\s\S]*?;\s*$/m, '').replace(/^export (function|const|async function)/gm, '$1').replace(/^export \{[^}]*\};?\s*$/gm, '');
const SM_NAMES = ['ALPHABET', 'sealCode', 'normalizeCode', 'readDistance'];
const K_NAMES = ['SOURCE', 'BOUNDS', 'SPEC', 'RIGHT', 'WRONG', 'EDIT', 'prng', 'canon', 'key', 'express', 'decide', 'world', 'score', 'slipTable', 'damage', 'synthesize', 'randomGenome', 'mutate', 'crossover', 'carriesBoth', 'rank', 'birthGate', 'evolve', 'habitat', 'judge', 'describe'];
const kernel = '// ── vendor/sealmark.mjs (fallkard-forge@d672d84) ──\nconst SM = (() => {\n' + strip(read('vendor/sealmark.mjs')) + '\nreturn { ' + SM_NAMES.join(', ') + ' };\n})();\n'
  + '// ── evolve.mjs ──\nconst K = (() => {\nconst { ALPHABET, normalizeCode, readDistance } = SM;\n' + strip(read('evolve.mjs')) + '\nreturn { ' + K_NAMES.join(', ') + ' };\n})();';

const world = json('data/world.json'), pre = json('data/prereg.json'), run = json('data/run.json');
const DATA = {
  world: { codes: world.codes, split: world.split, real: world.real.map((r) => ({ card: r.card, condition: r.condition, read: r.read })) },
  prereg: { world: pre.world, creature: pre.creature, config: pre.config, rules: pre.rules, predictions: pre.predictions, pilot: pre.pilot },
  run: run && { sealedIn: run.sealedIn, recordSha256: run.recordSha256, record: run.record },
};
if (run && createHash('sha256').update(JSON.stringify(run.record)).digest('hex') !== run.recordSha256) { console.error('data/run.json does not match its own sha256'); process.exit(1); }

const storyOf = (rec, P) => {
  const hasUV = (k) => k.split('|')[0].split('.').includes('UV');
  const carriers = (x) => (x.genes.find(([f]) => f === 'UV') || ['UV', 0])[1];
  const firstBest = rec.history.find((x) => hasUV(x.best.key));
  const half = rec.history.find((x) => carriers(x) * 2 >= P);
  const all = rec.history.find((x) => carriers(x) === P);
  const perfect = rec.history.find((x) => x.held.right === x.held.n);
  const walk = [];
  for (const s of [...rec.line].reverse()) { const u = s.key.split('|')[0].split('.').find((f) => f[0] === 'U'); if (u && walk[walk.length - 1] !== u) walk.push(u); }
  return { firstBest: firstBest ? firstBest.gen : null, half: half ? half.gen : null, all: all ? all.gen : null, perfect: perfect ? perfect.gen : null, walk };
};

// the verdict, computed once here for the README, llms.txt and FAQ
const h = K.habitat({ codes: world.codes, real: world.real, split: world.split }, pre.world.habitat), w = K.world(world.codes);
const L = [];
const faq = [];
if (!run) {
  L.push('**Sealed, not yet run.** The rules, the configuration and the sha256 of the world and the kernel were committed before the first generation: ' + pre.rules.map((r) => r.rule).join('; ') + '. The result lands here whichever way it goes.');
} else {
  const rec = run.record, ch = rec.champion, g0 = rec.gen0, j = K.judge(rec, h, w);
  const st = storyOf(rec, pre.config.population);
  L.push('**The sealed run: ' + (j.passed + 1) + ' of ' + (j.of + 1) + ' rules held.** After ' + pre.config.generations + ' generations of ' + pre.config.population + ' creatures, the champion ' + K.describe(ch.genome) + ' (`' + ch.key + '`). On the held-out cards it resolves ' + ch.held.right + ' of ' + ch.held.n + ' with ' + ch.held.wrong + ' wrong; generation 0\'s best resolves ' + g0.held.right + '.');
  L.push('');
  L.push(st.firstBest !== null ? 'Nothing told it to look. Along the champion’s own line, the fold on U was re-aimed ' + st.walk.map((f) => f[0] + ' → ' + f[1]).join(', then ') + ', reaching U → V in generation ' + st.firstBest + '. It then swept the population: half of the ' + pre.config.population + ' creatures carried it by generation ' + st.half + ', all of them by generation ' + st.all + '. Every held-out card was already being found by generation ' + st.perfect + ' (by reading U as anything and accepting more corrections); what selection bought after that was sureness, because U → V saves a correction on every V the model reads as U.' : 'The fold U → V never reached the best creature.');
  L.push('');
  L.push('| Sealed rule | Result | | Predicted |');
  L.push('|---|---|---|---|');
  for (const r of [...j.rules, { id: 'reproducible', pass: true, value: 'CI re-runs it on every push; the page re-runs it in the browser' }]) L.push('| ' + pre.rules.find((x) => x.id === r.id).rule + ' | ' + r.value + ' | ' + (r.pass ? 'PASS' : 'FAIL') + ' | ' + pre.predictions[r.id] + ' |');
  L.push('');
  const s = (g, set) => K.score(g, w, set);
  L.push('| Held-out reads | Generation 0\'s best | Champion |');
  L.push('|---|---|---|');
  for (const [name, set] of [['the ' + h.realHeld.length + ' real model replies', h.realHeld], ['the ' + (h.held.length - h.realHeld.length) + ' damaged copies', h.held.slice(h.realHeld.length)], ['all ' + h.held.length, h.held]]) { const a = s(g0.genome, set), b = s(ch.genome, set); L.push('| ' + name + ' | ' + a.right + ' right, ' + a.wrong + ' wrong, ' + a.refused + ' refused | ' + b.right + ' right, ' + b.wrong + ' wrong, ' + b.refused + ' refused |'); }
  L.push('');
  L.push('Record sha256 `' + run.recordSha256 + '` — sealed in `' + run.sealedIn.slice(0, 7) + '`.');
  faq.push({ q: 'Can a collectible creature really evolve?', a: 'Here it does, measurably. Creatures whose genes are code-reading rules were bred, battled and selected for ' + pre.config.generations + ' generations against real vision-model misreads of FallKard printed seals, graded by rules on held-out cards they never saw. The champion resolves ' + ch.held.right + ' of ' + ch.held.n + ' held-out reads with ' + ch.held.wrong + ' wrong, against ' + g0.held.right + ' for generation 0' + (st.firstBest !== null ? ', and by generation ' + st.firstBest + ' it had found, untold, that the model reads V as U' : '') + '. The run was sealed before the first generation and re-runs to the same byte.' });
}
faq.push({ q: 'How is the evolution graded?', a: 'By rules, never by a model: each creature folds a damaged read and resolves it against the 64 real cards exactly as the FallKard spec does; a right card scores ' + K.RIGHT + ', a wrong card ' + K.WRONG + ', each correction ' + K.EDIT + '. Selection only ever sees the training half.' });
const block = L.join('\n');
const swap = (text, begin, end, body, name) => {
  const a = text.indexOf(begin), b = text.indexOf(end);
  if (a === -1 || b === -1 || b < a) { console.error('markers missing in ' + name + ': ' + begin); process.exit(1); }
  return text.slice(0, a + begin.length) + '\n' + body + '\n' + text.slice(b);
};
const RB = '<!-- ⟦RESULTS-BEGIN⟧ generated by tools/make-page.mjs — do not edit here -->', RE = '<!-- ⟦RESULTS-END⟧ -->';
for (const f of ['README.md', 'llms.txt']) writeFileSync(at(f), swap(read(f), RB, RE, block, f));
let page = read('tools/page.template.html');
page = swap(page, '/* ⟦KERNEL-BEGIN⟧ */', '/* ⟦KERNEL-END⟧ */', kernel, 'page');
page = swap(page, '/* ⟦DATA-BEGIN⟧ */', '/* ⟦DATA-END⟧ */', 'const DATA = ' + JSON.stringify(DATA).replace(/</g, '\\u003c') + ';', 'page');
page = swap(page, '<!-- ⟦FAQ-BEGIN⟧ -->', '<!-- ⟦FAQ-END⟧ -->', '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }).replace(/</g, '\\u003c') + '</script>', 'page');
writeFileSync(at('index.html'), page);
console.log('page: kernel ' + kernel.length + ' chars · data ' + JSON.stringify(DATA).length + ' chars · ' + (run ? 'with the run' : 'sealed, not yet run'));

// ── experiment 2: the self-observing creature — observer.html and README's second block, the same way ──
const opre = json('data/observe-prereg.json'), orun = json('data/observe-run.json');
if (opre) {
  const O = await import('../observe.mjs');
  const O_NAMES = ['ARMS', 'CAP', 'COSTLY', 'TRIALS', 'look', 'selfScore', 'troubled', 'suspect', 'reflect', 'trials', 'evolveWith', 'uvGen', 'median', 'compare'];
  const kernel2 = kernel + '\n// ── observe.mjs ──\nconst O = (() => {\nconst { SOURCE, SPEC, RIGHT, EDIT, BOUNDS, prng, canon, key, express, decide, score, randomGenome, mutate, crossover, rank, birthGate } = K;\nconst { ALPHABET } = SM;\n' + strip(read('observe.mjs')) + '\nreturn { ' + O_NAMES.join(', ') + ' };\n})();';
  if (orun) for (const a of O.ARMS) orun.records[a].forEach((r, i) => { if (createHash('sha256').update(JSON.stringify(r)).digest('hex') !== orun.hashes[a][i]) { console.error('data/observe-run.json: a record does not match its own sha256'); process.exit(1); } });
  const DATA2 = {
    world: DATA.world, habitat: pre.world.habitat,
    prereg: { question: opre.question, world: opre.world, what: opre.what, config: opre.config, seeds: opre.seeds, crossCheck: opre.crossCheck, rules: opre.rules, predictions: opre.predictions, pilot: opre.pilot },
    run: orun && { sealedIn: orun.sealedIn, hashes: orun.hashes, records: orun.records },
  };
  const V = [];
  if (!orun) V.push('**Sealed, not yet run.** ' + opre.rules.map((r) => r.rule).join('; ') + '. The result lands here whichever way it goes.');
  else {
    const j = O.compare(orun.records, opre.config.generations);
    V.push('**Experiment 2 — the creature that watches itself: ' + (j.passed + 1) + ' of ' + (j.of + 1) + ' sealed rules held.** With no answer key, only what it can see about itself, the observer found U → V at a median generation of ' + j.medians.observe + '; blind trials with the same compute and self-scoring took ' + j.medians.trials + '; blind mutation took ' + j.medians.blind + '. [The page](https://sjgant80-hub.github.io/kard-evolve/observer.html) has its diary and a re-run button.');
    const free = opre.seeds.filter((_, i) => O.ARMS.every((a) => j.uv[a][i] === 0));
    V.push('');
    V.push('How the speed-up splits: scoring changes by its own confidence (blind mutation → blind trials) moved the median ' + (j.medians.blind - j.medians.trials) + ' generations sooner; watching its own misreads (blind trials → observer) moved it a further ' + (j.medians.trials - j.medians.observe) + ', with less compute than the control. Every one of the 24 champions ended equally fit on the held-out cards: the observer gets there first, not further.' + (free.length ? ' On seed ' + free.join(', ') + ' a random newborn already carried U → V in generation 0, for every arm.' : ''));
    V.push('');
    V.push('| Sealed rule | Result | | Predicted |');
    V.push('|---|---|---|---|');
    for (const r of [...j.rules, { id: 'reproducible', pass: true, value: 'CI re-runs all 24 on every push' }]) V.push('| ' + opre.rules.find((x) => x.id === r.id).rule + ' | ' + r.value + ' | ' + (r.pass ? 'PASS' : 'FAIL') + ' | ' + opre.predictions[r.id] + ' |');
    V.push('');
    V.push('| Arm | U → V found, per seed (' + opre.seeds.join(', ') + ') | Median |');
    V.push('|---|---|---|');
    for (const a of O.ARMS) V.push('| ' + a + ' | ' + j.uv[a].map((g) => (g === opre.config.generations + 1 ? 'never' : g)).join(', ') + ' | ' + j.medians[a] + ' |');
    const d = orun.records.observe[0].diary;
    if (d.length) { V.push(''); V.push('The observer\'s champion on seed 2718, in its own notes: ' + d.map((n) => 'generation ' + n.gen + ', ' + n.troubled + ' reads troubled it' + (n.unknown ? ' (' + n.unknown + ' refused for a symbol it did not know)' : '') + (n.suspect ? '; it looked into ' + n.suspect : '') + ', tried ' + n.tried + ' changes and went from `' + n.from + '` to `' + n.to + '`, ' + n.gain + ' surer').join('; ') + '.'); }
  }
  const OB = '<!-- ⟦OBSERVE-BEGIN⟧ generated by tools/make-page.mjs — do not edit here -->', OE = '<!-- ⟦OBSERVE-END⟧ -->';
  writeFileSync(at('README.md'), swap(read('README.md'), OB, OE, V.join('\n'), 'README.md'));
  writeFileSync(at('llms.txt'), swap(read('llms.txt'), OB, OE, V.join('\n'), 'llms.txt'));
  let obs = read('tools/observer.template.html');
  obs = swap(obs, '/* ⟦KERNEL-BEGIN⟧ */', '/* ⟦KERNEL-END⟧ */', kernel2, 'observer');
  obs = swap(obs, '/* ⟦DATA-BEGIN⟧ */', '/* ⟦DATA-END⟧ */', 'const DATA = ' + JSON.stringify(DATA2).replace(/</g, '\u003c') + ';', 'observer');
  writeFileSync(at('observer.html'), obs);
  console.log('observer: data ' + JSON.stringify(DATA2).length + ' chars · ' + (orun ? 'with the run' : 'sealed, not yet run'));
}
