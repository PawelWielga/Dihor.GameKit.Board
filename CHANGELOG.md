# Changelog

## Unreleased

## 0.1.0-preview.2 - 2026-09-21

- Adds consumer-provided appearance themes, entity overrides, presentation-state variants and async renderer asset integration.
- Adds readable piece labels/icons to the FlatBoard3DPieces and Full3D reference renderers.
- Adds renderer-neutral topology-connection presentation derived from actual topology neighbors.
- Renders reusable topology links in TopDown demo, FlatBoard3DPieces and Full3D without changing movement or occupancy semantics.
- Improves renderer target lifecycle and defers async asset refresh while movement animation is active.


- Initialized `Dihor.GameKit.Board` as part of the Dihor.GameKit family.
- Reserved npm package identity `@dihor/gamekit-board`.
- Established the framework-agnostic architecture direction for board topology and piece movement.
- Added the first core domain API: `Board`, `Space`, `Piece`, placements, snapshots and explicit board-state errors.

## 0.1.0-preview.1 - 2026-09-20

- First packaged prerelease of `@dihor/gamekit-board`.
- Includes board topology, movement, occupancy, transport-neutral movement events and renderer-neutral presentation APIs.
- Includes the optional Three.js hybrid and full-3D reference renderers.
- Distributed as an MIT-licensed npm-compatible `.tgz` asset through GitHub Prereleases.
