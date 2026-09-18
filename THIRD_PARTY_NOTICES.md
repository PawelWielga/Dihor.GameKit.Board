# Third-party notices

Dihor.GameKit.Board core logic has no rendering-engine runtime dependency.

The optional `@dihor/gamekit-board/three` reference renderer integrates with:

- Three.js 0.186.0 — MIT License, https://threejs.org/

Three.js is declared as an optional peer dependency so consumers that only use
board topology, movement, events or renderer-neutral presentation contracts do
not need a concrete rendering engine.

Development tooling is installed through npm and remains subject to the licenses
of its respective packages.
