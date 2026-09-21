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

A renderer may expose asynchronous cleanup through `dispose(): void | Promise<void>`.
Consumers that own a renderer should await the returned promise when possible.
Three.js renderers wait for renderer-owned asset resources and the asset provider
to finish cleanup before disposal completes. Repeated disposal is idempotent,
and cleanup failures are propagated to the caller instead of being detached.

```ts
await renderer.dispose?.();
```

## External appearance configuration

Space and piece visuals are configured outside the authoritative board. A
`BoardAppearanceConfig` can provide global defaults, reusable named styles,
per-entity overrides, resolver functions and temporary presentation state.

```ts
const appearance = {
  theme: {
    name: "neon",
    spaceDefault: { color: "#202534", opacity: 1 },
    pieceDefault: { color: "#7c9cff", scale: 1 },
    spaceStyles: {
      reward: {
        color: "#16c784",
        icon: "star",
      },
    },
  },
  spaces: {
    bonus: {
      style: "reward",
      appearance: {
        label: { text: "BONUS" },
      },
    },
  },
  pieces: {
    "player-1": {
      appearance: {
        color: "#ff5c7a",
        assetKey: "piece.player.red",
      },
    },
  },
  pieceStates: {
    "player-1": {
      active: true,
      selected: true,
    },
  },
} satisfies BoardAppearanceConfig;

renderer.render(canvas, {
  snapshot: board.snapshot(),
  layout,
  appearance,
});
```

Resolver functions can select appearance from entity data without putting
renderer details into `Space`, `Piece` or `Board`:

```ts
const appearance: BoardAppearanceConfig<{ terrain: string }> = {
  resolveSpace: ({ space }) =>
    space.data?.terrain === "water"
      ? { color: "#2f80ed", texture: "water" }
      : undefined,
};
```

Appearance resolution is deterministic. Values are merged in this order:

1. built-in fallback,
2. theme default,
3. static entity named style,
4. static entity appearance override,
5. resolver-selected named style,
6. resolver appearance override,
7. active presentation-state variants.

When several presentation states are active, variant precedence is
`occupied < reachable < blocked < highlighted < selected < active`.

Changing `BoardAppearanceConfig`, replacing the theme or toggling temporary
presentation state never mutates topology, occupancy, movement state or entity
data. Unknown named styles are ignored and built-in defaults remain available.

Portable descriptors intentionally use strings and renderer-neutral transforms.
`assetKey`, `texture`, `material` and `icon` are logical references; concrete asset
loading and renderer-specific resources belong to renderer adapters.

## Renderer asset providers

Portable appearance descriptors use logical keys. Renderer adapters resolve
those keys through a `RendererAssetProvider<TResource>` instead of storing
engine objects in `Board`, `Space` or `Piece`.

`RendererAssetCache` defines the loading lifecycle shared by renderer
adapters:

- the first request starts the provider load,
- repeated requests for the same kind/key reuse one cached load/result,
- a synchronous placeholder can be returned while an async load is pending,
- missing or failed loads can resolve to a configured fallback,
- `peek()` exposes the current loading/ready/fallback/error state,
- `dispose()` waits for active loads, disposes owned cached resources once and
  then disposes the provider,
- concurrent or repeated `dispose()` calls share the same cleanup lifecycle,
- cleanup attempts continue through all owned resources and the provider, while
  failures are surfaced to the caller.

By default the cache identity is `kind:key`. A provider may use an explicit
`cacheKey` when several logical entities should share one renderer resource.

```ts
const assets = new RendererAssetCache(provider, {
  placeholder: () => placeholderVisual,
  fallback: (request) => ({
    resource: createFallbackVisual(request),
    dispose: () => disposeFallbackVisual(request),
  }),
  onSettled: () => requestRender(),
});

const handle = assets.request({
  key: "piece.knight",
  kind: RendererAssetKind.Model,
  entity: "piece",
});

// Render immediately with handle.current.resource when present.
// Re-render when handle.ready settles.
```

The cache owns only resources returned through
`RendererAssetLoadResult.dispose`. Placeholder ownership remains with the
consumer, which avoids accidentally disposing a shared global placeholder.

### Three.js assets

The optional `@dihor/gamekit-board/three` entry point defines
`ThreeBoardAssetProvider`. It can return textures, materials, model factories,
piece factories or space factories without exposing Three.js from the package
root.

Appearance declares whether `assetKey` represents an entity-specific visual
factory or a generic 3D model. The default is `AppearanceAssetKind.Visual`,
which maps to `RendererAssetKind.PieceVisual` or
`RendererAssetKind.SpaceVisual` depending on the entity. Setting
`AppearanceAssetKind.Model` makes the renderer request
`RendererAssetKind.Model` directly, with no speculative or duplicate provider
load.

For example, an application can load a GLB/glTF model under the same logical key
used by `PieceAppearance.assetKey`:

```ts
import {
  AppearanceAssetKind,
  RendererAssetKind,
} from "@dihor/gamekit-board";
import type {
  ThreeBoardAssetProvider,
  ThreeModelAsset,
} from "@dihor/gamekit-board/three";

const appearance = {
  pieces: {
    knight: {
      appearance: {
        assetKey: "piece.knight",
        assetKind: AppearanceAssetKind.Model,
      },
    },
  },
};

const provider: ThreeBoardAssetProvider = {
  async load(request) {
    if (
      request.key !== "piece.knight" ||
      request.kind !== RendererAssetKind.Model
    ) {
      return undefined;
    }

    const model = await loadKnightModel();

    const resource: ThreeModelAsset = {
      type: "model",
      create: () => model.clone(true),
    };

    return {
      resource,
      dispose: () => disposeModelResources(model),
    };
  },
};
```

Full3D spaces use the same `AppearanceAssetKind.Model` contract. Entity-specific
factories remain available with the default visual kind and return
`type: "piece-visual"` or `type: "space-visual"`. Texture and material assets
continue to use their dedicated `texture` and `material` appearance keys.
Renderer adapters remain responsible for applying those resources and for
disposing per-instance scene objects they create.

## Topology connection presentation

Visible links are presentation data derived from the authoritative topology. The
renderer never infers a passage merely because two spaces happen to be adjacent
on screen.

```ts
const connections = createTopologyConnections(board.topology!);

renderer.render(canvas, {
  snapshot: board.snapshot(),
  layout,
  connections,
  connectionAppearance: {
    color: "#6b7280",
    opacity: 0.9,
    width: 0.3,
  },
});
```

`createTopologyConnections()` works with arbitrary graph topologies and
deduplicates reciprocal neighbor relations for rendering. The resulting links
can be mapped through any `SpaceLayout`; missing endpoint positions fail
explicitly instead of drawing a guessed connection.

`FlatBoard3DPiecesRenderer` draws reusable flat passage strips beneath spaces,
while `Full3DRenderer` draws shallow 3D links. The TopDown HTML/SVG demo uses
the same derived connection list. Connection appearance is presentation-only
and does not alter topology, movement legality, occupancy or Board snapshots.

## Appearance behavior across render modes

The same `BoardAppearanceConfig` can be passed to every render mode. Appearance
is resolved from logical IDs and presentation state before renderer-specific
mapping happens.

| Appearance capability | TopDown | FlatBoard3DPieces | Full3D |
| --- | --- | --- | --- |
| space color / opacity | yes | yes | yes |
| space icon / label | yes | ignored gracefully | ignored gracefully |
| space texture | not required by the HTML demo | yes | yes |
| custom space 3D visual | not applicable | ignored gracefully | yes |
| piece color / opacity | yes | yes | yes |
| piece icon / label | yes | yes (label text, icon fallback) | yes (label text, icon fallback) |
| piece scale / rotation / offset | yes | yes | yes |
| custom piece 3D visual / model | not applicable | yes | yes |
| logical material key | not applicable | yes for default pieces | yes for spaces and default pieces |

The hybrid renderer keeps the board in its orthographic flat pass. Space
appearance may change color, opacity, texture, scale or flat rotation, while
pieces remain real 3D objects in the perspective pass. Piece dimensions and
visual offsets are applied after the renderer calculates the logical ground
anchor, so they cannot change occupancy or movement coordinates.

The Full3D renderer applies the same resolved appearance to real scene objects.
Custom space and piece factories receive logical IDs plus the resolved portable
appearance. A missing, failed or incompatible asset falls back to the built-in
tile or pawn instead of changing board logic.

Both Three.js renderers accept an optional `assetProvider`:

```ts
const renderer = new FlatBoard3DPiecesRenderer({
  assetProvider,
});

renderer.render(canvas, {
  snapshot: board.snapshot(),
  layout,
  appearance,
});
```

Async provider results are cached. The renderer initially uses its built-in
visual when a custom asset is still loading and refreshes the presentation when
the resource settles. If an asset settles while `animateMovement()` is active,
that target defers the asset refresh until the authoritative movement path has
finished. The resolved asset is then rendered immediately after the final
animation segment. Starting another movement, explicitly rendering again or
disposing/replacing the target can still cancel the previous presentation
animation.

Animation continues to consume only the authoritative `MovementPath`;
appearance transforms are visual offsets relative to each logical path anchor.

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

## Full3D reference renderer

The same optional Three.js entry point also exports `Full3DRenderer`. It renders
board spaces and pieces in one real 3D scene while consuming exactly the same
`BoardRenderInput` and `SpaceLayout`.

```ts
import { Full3DRenderer } from "@dihor/gamekit-board/three";

const renderer = new Full3DRenderer({
  camera: {
    projection: "perspective",
    position: { x: 6, y: 8, z: 9 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1.1,
  },
});

renderer.render(canvas, {
  snapshot: board.snapshot(),
  layout,
  movement: lastMovement,
});
```

Camera `position` and `target` define angle/tilt. Both perspective and
orthographic projections are supported, along with zoom. Omitting position or
target enables automatic framing from the current presentation layout.

The renderer's `setCameraOptions()` changes presentation only. It does not have
a `Board` reference and cannot move pieces, mutate topology or validate moves.

## Demo mode switching

The demo exposes all three render modes:

- `TopDown` uses the HTML/SVG renderer,
- `FlatBoard3DPieces` is the preferred/default showcase,
- `Full3D` uses the single-scene 3D renderer.

Changing this selector calls only the presentation path. The existing board
instance, topology, placements and latest movement result are retained.

The demo also exposes two appearance themes. Switching themes reuses the same
logical board and demonstrates:

- reusable space styles plus per-space overrides,
- selected, occupied, blocked and highlighted presentation states,
- distinct per-piece appearance,
- a custom 3D visual for the first demo piece,
- a deliberately missing custom visual for the second piece, which falls back
  to the built-in pawn while still applying its material configuration,
- appearance diagnostics containing logical IDs, portable asset/material keys
  and presentation state without exposing Three.js internals.
