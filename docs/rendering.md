# Rendering architecture

`Dihor.GameKit.Board` keeps board state, topology and movement independent from rendering. Rendering is a presentation concern that consumes authoritative board state and movement paths.

This document defines the direction for the reference/demo renderer and any future optional rendering adapter.

## Goals

- keep the domain model independent from Three.js, DOM APIs, Unity, Flutter and other rendering engines,
- allow the same board state to be presented in multiple visual styles,
- support a flat, highly readable board while preserving visibly 3D pieces,
- retain a configurable full-3D mode where both the board and pieces are rendered in a 3D scene,
- allow switching render modes without changing board state or game rules.

## Render modes

The presentation layer should expose a small render-mode API equivalent to:

```ts
export enum BoardRenderMode {
  TopDown = "top-down",
  FlatBoard3DPieces = "flat-board-3d-pieces",
  Full3D = "full-3d"
}
```

The exact TypeScript shape may evolve, but these three capabilities are intentional.

### `TopDown`

A simple orthographic top-down presentation.

Use cases:

- diagnostics,
- simple games,
- accessibility/readability focused layouts,
- low-cost fallback rendering.

The board and pieces are viewed from above without perspective distortion.

### `FlatBoard3DPieces`

The preferred reference/demo presentation.

The renderer uses separate rendering passes/cameras:

1. **Board pass**: render the board with an orthographic, visually flat projection.
2. **Piece pass**: render pieces as real 3D meshes with visible volume, lighting and shadows.
3. **Composition**: combine both passes while keeping piece positions aligned with logical board spaces.

The result should look like a flat digital board with physical 3D pieces standing on it.

Important requirements:

- the board must remain visually flat and readable,
- pieces must retain visible 3D volume,
- lighting and shadows may reinforce depth,
- board-space-to-render-space mapping must be deterministic,
- resizing/aspect-ratio changes must preserve alignment,
- the renderer must never decide whether movement is valid.

### `Full3D`

Render the board and pieces in the same 3D scene.

The presentation layer may expose camera controls such as:

- perspective/orthographic projection where supported,
- position,
- target,
- tilt,
- rotation,
- zoom/distance.

This mode is useful for games that want a physical-table or diorama-style presentation.

## Separation from the domain model

Render mode is **not board state**.

The core model should continue to expose concepts such as:

```text
Board
Space
Piece
Placement
MovementPath
MovementResult
```

A renderer consumes these concepts and maps them into presentation coordinates.

For example, a piece occupying logical space `A4` remains on `A4` regardless of whether the user switches from `FlatBoard3DPieces` to `Full3D`.

```text
authoritative board state
        |
        v
presentation mapping
        |
        +--> TopDown
        |
        +--> FlatBoard3DPieces
        |
        +--> Full3D
```

Changing render mode must not mutate the board, recalculate legal movement or alter game rules.

## Hybrid rendering details

For `FlatBoard3DPieces`, the reference implementation should prefer an explicit multi-pass pipeline instead of trying to fake the effect with one camera.

A conceptual pipeline:

```text
Board state
    |
    +--> board projection ------> orthographic board pass ---+
    |                                                        |
    +--> piece transforms -----> 3D piece pass --------------+--> composed frame
```

The implementation must define one shared board-to-screen mapping so that both passes remain synchronized.

Shadows should visually connect pieces to the board without making shadow data part of gameplay state.

## Demo behavior

The interactive demo should eventually provide a render-mode selector containing:

- Top Down,
- Flat Board + 3D Pieces,
- Full 3D.

`FlatBoard3DPieces` should be the preferred/default showcase mode once the 3D renderer is implemented.

Switching modes should preserve:

- selected topology,
- spaces,
- pieces,
- piece positions,
- movement history/current path where applicable.

Only presentation-specific camera configuration may change.

## Engine independence

The first 3D reference renderer may use Three.js, but the core package must not gain a Three.js dependency because of it.

If rendering grows beyond the demo, prefer an optional adapter/package boundary over coupling the core to one engine.
