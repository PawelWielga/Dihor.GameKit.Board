# PartyBeam First MVP Board roadmap

## Role

Dihor.GameKit.Board is the reusable board/topology/movement/rendering toolkit used by Grimcellar.

For PartyBeam First MVP, Board is a dependency of the richer second validation game. It is not a place to add Grimcellar-specific rules.

Status snapshot: 2026-09-21.

## Current baseline

Grimcellar consumes `@dihor/gamekit-board 0.1.0-preview.2`.

The First MVP capabilities required by Grimcellar are already present, including:

- arbitrary/square-grid topology;
- piece placement and movement;
- multiple/co-located pieces;
- movement paths/events;
- consumer-provided appearance;
- topology-connection rendering;
- automatic layout/framing used by the current Grimcellar implementation.

## Ordered PartyBeam First MVP work

### BOARD-MVP-01 - freeze preview.2 as the Grimcellar baseline

1. Keep Grimcellar pinned to the current approved prerelease.
2. Do not add new Board features merely because open generic issues exist.
3. Do not copy Board behavior into Grimcellar.
4. Preserve the authoritative logical-board -> presentation boundary.

### BOARD-MVP-02 - validate the real Grimcellar workload

During Grimcellar MVP-09 verify:

- the complete 80-tile dungeon can be represented/rendered;
- player placement matches authoritative game state;
- movement paths remain correct across repeated turns;
- 2-4 players can occupy the same logical space without corrupting state;
- shared-tile presentation remains understandable;
- renderer lifecycle survives normal PartyBeam GameSession start/end.

This validation must occur inside real PartyBeam, not only in the Board demo.

### BOARD-MVP-03 - defect-only patch loop

If E2E exposes a generic Board defect:

1. reproduce it here;
2. create a focused Board issue;
3. implement the generic fix on the normal Board development flow;
4. add regression coverage;
5. publish the next prerelease only when Grimcellar must consume changed package bytes;
6. update Grimcellar pin and rerun affected scenarios.

Do not solve reusable Board defects inside Grimcellar.

### BOARD-MVP-04 - defer non-blocking open work

Current generic issues such as renderer resource ownership/model appearance/cache identity remain important library work, but they do not block PartyBeam First MVP unless the actual Grimcellar E2E path triggers them.

Do not delay the ecosystem MVP for speculative Board API expansion, new topology types or rendering polish.

## First MVP DONE criteria for Board

Board is complete for PartyBeam First MVP when:

- Grimcellar uses the packaged library with no local duplicate implementation;
- the official Grimcellar package passes both PC/laptop and Android TV E2E board scenarios;
- no known Board correctness/resource defect breaks those required scenarios;
- any necessary patch is released and pinned reproducibly.

## Post-MVP

After the PartyBeam ecosystem MVP is proven, resume generic Board hardening, richer asset/rendering work and new topology/features according to the Board backlog rather than Grimcellar-specific pressure.
