# Rendering architecture

Rendering is an optional presentation layer. The logical `Board`, topology,
movement validation, occupancy and events remain authoritative and do not depend
on a renderer.

## Render modes

`BoardRenderMode` defines three presentation modes:

- `TopDown` — flat 2D/top-down presentation,
- `FlatBoard3DPieces` — flat board projection with separately rendered 3D pieces,
- `Full3D` — board and pieces rendered together in a 3D scene.

Changing the render mode must not rebuild the logical board, move a piece,
recalculate a legal path or alter topology.

## Coordinate boundary

Presentation coordinates use a renderer-neutral right-handed 3D point:

```ts
interface PresentationPoint3 {
  x: number;
  y: number;
  z: number;
}
```

The default helpers place the board on the XZ plane and use Y as presentation
height. This makes the same layout usable by a DOM/SVG renderer, Three.js,
Unity, Flutter or another consumer.

Example:

```ts
const topology = new SquareGridTopology(8, 8);
const layout = createSquareGridSpaceLayout(topology, {
  cellSize: 1.25,
  origin: { x: -4.375, y: 0, z: -4.375 },
});

const input = {
  snapshot: board.snapshot(),
  layout,
};

const pieces = mapPiecesToPresentation(input.snapshot, input.layout);
```

`createLinearSpaceLayout()` and `createSquareGridSpaceLayout()` provide
deterministic mappings for built-in topologies. Graphs and custom topologies
can use `createExplicitSpaceLayout()` or `createSpaceLayout()`.

## Renderer contract

A renderer consumes `BoardRenderInput`:

- an authoritative `BoardSnapshot`,
- a presentation-only `SpaceLayout`,
- optionally the latest authoritative `MovementResult`.

The renderer may animate the supplied movement path, but it must never decide
whether the move is legal.

`BoardRenderer<TTarget>` is intentionally generic. A concrete renderer can use
an HTML element, canvas, Three.js scene, Flutter bridge or any other target
without adding that technology to the domain core.

## Presentation-only state

Camera position, target, zoom, projection, viewport, lighting, shadows,
materials and animation timing belong to renderer state/configuration.

They are deliberately not stored in:

- `Board`,
- `BoardSnapshot`,
- topology objects,
- movement rules,
- movement events.

This guarantees that switching presentation mode or changing camera/lighting
cannot change gameplay state.

## FlatBoard3DPieces reference renderer

The optional `@dihor/gamekit-board/three` entry point provides
`FlatBoard3DPiecesRenderer`. Three.js is an optional peer dependency and does
not leak into the domain/core entry points.

```ts
import { FlatBoard3DPiecesRenderer } from "@dihor/gamekit-board/three";

const renderer = new FlatBoard3DPiecesRenderer({
  shadows: true,
  pixelRatio: 2,
});

renderer.render(canvas, {
  snapshot: board.snapshot(),
  layout,
  movement: lastMovement,
});
```

The renderer uses two explicit passes:

1. a flat orthographic board pass,
2. a perspective 3D piece/light/shadow pass.

Each logical space is first projected to the board pass NDC coordinate. The 3D
pass casts that same NDC coordinate onto its ground plane, so piece bases remain
screen-aligned with the flat board even though the piece camera is angled.
Viewport changes recompute both mappings from the same `SpaceLayout`.

`animateMovement()` consumes the already-authorized `MovementResult.path`.
It never calculates legality or mutates the board.

If WebGL creation fails, consumers can catch the render failure and keep a
low-cost 2D renderer. The bundled demo does exactly this and falls back to its
HTML/SVG presentation.

A later `Full3D` renderer reuses the same logical snapshot and layout boundary.
