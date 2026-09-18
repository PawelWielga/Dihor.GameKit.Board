# AGENTS.md

Instructions for coding agents working in `Dihor.GameKit.Board`.

## Project purpose

`Dihor.GameKit.Board` is a reusable, framework-agnostic TypeScript library for modelling game boards and moving pieces across them.

It belongs to the same library family as `Dihor.GameKit.Dice`. Keep naming, packaging, documentation quality and engineering conventions consistent across the Dihor.GameKit repositories where the domain allows it.

## Architecture boundaries

The intended structure is:

```text
src/
├── core/       # Board, Space, Piece, Position and domain results
├── topology/   # Graph, linear, square-grid and future topology implementations
├── movement/   # Movement calculation, paths and movement rules
├── events/     # Versioned transport-neutral board/movement event contracts
└── index.ts    # Intentionally small recommended package root
```

### `core`

- Owns framework-independent domain models.
- Must not import rendering engines, DOM/browser-only APIs or networking transports.
- Board state and logical movement results are authoritative.
- Must be unit-testable without a renderer.

### `topology`

- Describes which spaces exist and how they connect.
- Do not assume every board is a rectangular grid.
- Arbitrary graph topology is the general model.
- Linear/looping boards and grids are convenience topologies built on explicit connectivity.

### `movement`

- Owns movement calculation, validation and visited-space paths.
- A multi-space move must preserve the ordered path of visited spaces, not only the start and end.
- Movement rules should be composable and game-specific policies should not be hard-coded into the library.
- Rendering or animation timing must not affect movement legality.

### `events`

- Owns JSON-friendly, transport-neutral event contracts.
- Must not depend on WebSockets, WebRTC, SignalR or another concrete transport.
- Event contracts should carry authoritative board/movement state needed by consumers.
- Version incompatible payload changes explicitly.

## Rendering boundary

The library does not own rendering.

Consumers may present the same logical movement using Three.js, Flutter, Unity, HTML/CSS or another renderer. Rendering receives board state and movement paths from this library and decides how to animate them.

Do not introduce a rendering dependency into the core package merely to support a demo.

## Multiplayer boundary

Networking is outside this repository.

A host-authoritative game may serialize board/movement events and transport them using `Dihor.GameKit.Networking` or another transport. Clients must not reinterpret an authoritative movement event based on local animation.

## External references and originality

Public repositories, examples, articles and demos may be inspected to learn general concepts, algorithms and architectural patterns.

Rules:

- Do not copy external source code into this repository.
- Do not copy external assets.
- Do not port distinctive implementations line-for-line.
- Implement project code independently from requirements and architecture defined here and in GitHub Issues.
- Verify license and attribution requirements before intentionally adding third-party code or assets.

## Dependencies

- Prefer no runtime dependency when a small project-owned implementation is reasonable.
- If a dependency is justified, prefer maintained packages with permissive licenses such as MIT, Apache-2.0 or BSD.
- Do not add paid commercial dependencies.
- Do not let implementation-specific dependencies leak into domain types.

## Performance

- Board operations should remain practical for real-time game use.
- Avoid unnecessary allocations in frequently executed movement/path operations.
- Prefer explicit bounded algorithms over unbounded searches.
- Future pathfinding implementations must document complexity and termination behavior.

## Testing

Tests should cover behavior rather than implementation details.

At minimum, add tests for:

- topology connectivity,
- invalid/missing spaces,
- piece placement and occupancy,
- movement paths,
- movement rule acceptance/rejection,
- edge cases such as loops and zero-distance movement,
- event serialization when event contracts are introduced.

## GitHub workflow

- Work from GitHub Issues.
- Prefer one focused issue per PR.
- Keep PRs reviewable and do not silently expand scope.
- Reference the issue in the PR description.
- Do not merge with known correctness problems.
- GitHub Actions are allowed in this repository.
- Maintain `main` as the release/stable branch and `dev` as the integration branch.

## Code quality

- Use TypeScript for project source.
- Prefer explicit domain types over loosely shaped objects.
- Avoid `any` unless there is a documented interoperability reason.
- Keep the recommended package root intentionally small.
- Prefer composition over large classes with mixed responsibilities.
- Document coordinate-system and topology assumptions.
- Fail explicitly for impossible or invalid moves rather than silently changing requested behavior.

## Naming

Use terminology that remains valid across different board types.

Preferred vocabulary:

- `Board` for board state and piece ownership,
- `Space` for a logical location on a board,
- `Piece` for an entity occupying a space,
- `Topology` for the graph of spaces/connections,
- `MovementPath` for ordered visited spaces,
- `MovementRule` for reusable validation/policy components.

Avoid using `Tile` or `Cell` as the universal domain term because not every supported board is grid-based.
