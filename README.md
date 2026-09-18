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

## Planned API direction

```ts
const board = new Board({
  topology: new SquareGrid(8, 8)
});

board.addPiece({
  id: "player-1",
  position: { x: 2, y: 3 }
});

const result = board.moveTo("player-1", { x: 5, y: 3 });

console.log(result.path);
```

For track-style games:

```ts
const result = board.moveBy("player-1", 4);
```

Exact API names may evolve while the first public preview is being implemented.

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

## Rendering direction

Rendering remains separate from the authoritative board model. The reference/demo presentation is planned to support three configurable modes:

- `TopDown` — simple orthographic top-down presentation,
- `FlatBoard3DPieces` — a visually flat orthographic board combined with separately rendered 3D pieces; this is the preferred showcase mode,
- `Full3D` — board and pieces rendered together in a configurable 3D scene.

Switching render modes must not change board state, movement rules or piece positions.

See [Rendering architecture](docs/rendering.md) for the multi-pass camera model and presentation boundary.

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
