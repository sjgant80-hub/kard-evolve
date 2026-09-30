# kard-evolve — agent instructions

Creatures that evolve, measurably: readers of damaged FallKard seal codes, bred, battled and selected against real model misreads, re-runnable to the byte.

## Boundaries

- Keep kard-evolve zero-dependency and deterministic. Do not add runtime dependencies.
- Every change to a source line must be covered by a test that fails when the line changes (witness gate).
- Do not skip, disable, or weaken a test to make the suite green. Fix the code or the test's premise.
- Structure and behaviour are gated by konomify; a change ships only when it stays konomified.
