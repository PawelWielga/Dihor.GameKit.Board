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

## Planned reference renderer

The preferred showcase renderer is `FlatBoard3DPieces`:

1. render the board in a flat orthographic pass,
2. render pieces in a separate 3D pass,
3. compose both using the same `SpaceLayout`.

A later `Full3D` renderer will reuse the same logical snapshot and layout
boundary.
