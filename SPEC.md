# kard-evolve — specification

## Purpose

Creatures that evolve, measurably: readers of damaged FallKard seal codes, bred, battled and selected against real model misreads, re-runnable to the byte.

## Contract

- **birthGate** — part of the kard-evolve public surface; deterministic, total (never throws).
- **canon** — part of the kard-evolve public surface; deterministic, total (never throws).
- **carriesBoth** — part of the kard-evolve public surface; deterministic, total (never throws).
- **crossover** — part of the kard-evolve public surface; deterministic, total (never throws).
- **damage** — part of the kard-evolve public surface; deterministic, total (never throws).
- **decide** — part of the kard-evolve public surface; deterministic, total (never throws).
- **describe** — part of the kard-evolve public surface; deterministic, total (never throws).
- **evolve** — part of the kard-evolve public surface; deterministic, total (never throws).
- **express** — part of the kard-evolve public surface; deterministic, total (never throws).
- **habitat** — part of the kard-evolve public surface; deterministic, total (never throws).
- **judge** — part of the kard-evolve public surface; deterministic, total (never throws).
- **key** — part of the kard-evolve public surface; deterministic, total (never throws).
- **mutate** — part of the kard-evolve public surface; deterministic, total (never throws).
- **prng** — part of the kard-evolve public surface; deterministic, total (never throws).
- **randomGenome** — part of the kard-evolve public surface; deterministic, total (never throws).
- **rank** — part of the kard-evolve public surface; deterministic, total (never throws).
- **score** — part of the kard-evolve public surface; deterministic, total (never throws).
- **slipTable** — part of the kard-evolve public surface; deterministic, total (never throws).
- **synthesize** — part of the kard-evolve public surface; deterministic, total (never throws).
- **world** — part of the kard-evolve public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits kard-evolve only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.
