# Dihor.GameKit.Board

Reusable, framework-agnostic board and piece movement toolkit for games and applications.

> **Dihor.GameKit** family  
> This repository is part of the same GameKit series as [Dihor.GameKit.Dice](https://github.com/PawelWielga/Dihor.GameKit.Dice).

## Purpose

`Dihor.GameKit.Board` owns the logical model of a board and movement of pieces across it. It is intentionally independent from rendering engines, UI frameworks and networking transports.

The library should support different board topologies without forcing every game into a rectangular grid:

- arbitrary graphs of connected spaces,
- linear or looping tracks,
- square grids,
- hex grids in a later extension,
- custom game-specific topologies.

## Core idea

```text
game rules
    |
    v
Dihor.GameKit.Board
    |
    +-- board topology
    +-- pieces and occupancy
    +-- movement validation
    +-- movement path / visited spaces
    +-- transport-neutral events
            |
            v
renderer / game
Three.js / Flutter / Unity / HTML / other
```

The board state and movement result are authoritative. Rendering only presents that state.

A move across several spaces is represented as a path of visited spaces rather than only a start and end position. This allows games to react to events such as passing START, entering terrain, traps, portals or encounters.

## Movement API

A board can be associated with a topology and then perform logical movement:

```ts
const topology = new LinearTopology(["start", "a", "b", "finish"]);
const board = new Board({ topology });

for (const spaceId of topology.getSpaceIds()) {
  board.addSpace({ id: spaceId });
}

board.addPiece({ id: "player-1" }, "start");

const result = board.moveBy("player-1", 3);

console.log(result.path);
// ["start", "a", "b", "finish"]
```

`moveTo()` finds a deterministic shortest path through the topology using
breadth-first search. The search is bounded to spaces exposed by the topology
and has O(V + E) complexity. `moveBy()` is available for ordered topologies
such as `LinearTopology` and records every traversed space, including repeated
spaces on looping tracks.

A zero-distance move succeeds with a path containing only the current space.
Invalid movement is rejected before board placement changes, so movement is
atomic from the consumer's perspective.

## Networking boundary

Board movement events are plain, versioned JSON-friendly objects. After the host
accepts a move, it can turn the authoritative `MovementResult` into an ordered
event stream:

```ts
const result = board.moveBy("player-1", 3);
const events = createMovementEvents(result, {
  movementId: "turn-42-player-1",
});
```

The stream contains `movement.started`, one `movement.space-entered` event
for every space entered after the origin, and `movement.completed`. Events
carry schema/version fields plus authoritative piece position state; start and
completion also carry the complete movement path.

`Dihor.GameKit.Board` does not choose or depend on a transport.
[Dihor.GameKit.Networking](https://github.com/PawelWielga/Dihor.GameKit.Networking)
or a game-specific networking layer is responsible for host/client delivery,
ordering, reliability and reconnect/replay behavior. Renderers should animate
from the authoritative path/state rather than become a source of game state.

## Architecture direction

```text
src/
├── core/       # Board, Space, Piece, Position and domain results
├── topology/   # Graph, linear and grid topology implementations
├── movement/   # Movement calculation and validation rules
├── events/     # Versioned transport-neutral movement contracts
└── index.ts    # Small recommended public API
```

The core must not depend on Three.js, Flutter, Unity, DOM APIs, WebSockets or another concrete presentation/transport technology.

## Dihor.GameKit

The repositories share a common identity and engineering direction:

| Package | Responsibility |
| --- | --- |
| [`Dihor.GameKit.Dice`](https://github.com/PawelWielga/Dihor.GameKit.Dice) | Dice rolls, physics and presentation |
| **`Dihor.GameKit.Board`** | Board topology, pieces and movement |

npm package naming follows the same convention:

```text
@dihor/gamekit-dice
@dihor/gamekit-board
```

## Status

Early development. The initial public API is not stable yet.

## License

MIT
