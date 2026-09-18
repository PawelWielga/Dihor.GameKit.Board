import type {
  Piece,
  PieceId,
  Space,
  SpaceId,
} from "../core/index.js";
import type { PresentationPoint3 } from "./contracts.js";

export const AppearanceState = Object.freeze({
  Selected: "selected",
  Highlighted: "highlighted",
  Reachable: "reachable",
  Blocked: "blocked",
  Occupied: "occupied",
  Active: "active",
} as const);

export type AppearanceState =
  (typeof AppearanceState)[keyof typeof AppearanceState];

export interface AppearanceLabel {
  readonly text?: string;
  readonly color?: string;
  readonly opacity?: number;
  readonly visible?: boolean;
}

export interface AppearanceVisual {
  readonly color?: string;
  readonly opacity?: number;
  readonly icon?: string;
  readonly texture?: string;
  readonly material?: string;
  readonly assetKey?: string;
  readonly scale?: number | PresentationPoint3;
  readonly rotation?: number | PresentationPoint3;
  readonly offset?: PresentationPoint3;
  readonly label?: AppearanceLabel;
}

export interface AppearanceDefinition extends AppearanceVisual {
  readonly variants?: Readonly<
    Partial<Record<AppearanceState, AppearanceVisual>>
  >;
}

export interface SpaceAppearance extends AppearanceDefinition {}

export interface PieceAppearance extends AppearanceDefinition {}

export interface AppearanceAssignment<
  TAppearance extends AppearanceDefinition,
> {
  readonly style?: string;
  readonly appearance?: TAppearance;
}

export interface PresentationEntityState {
  readonly selected?: boolean;
  readonly highlighted?: boolean;
  readonly reachable?: boolean;
  readonly blocked?: boolean;
  readonly occupied?: boolean;
  readonly active?: boolean;
}

export interface SpaceAppearanceResolverContext<TSpaceData = unknown> {
  readonly space: Space<TSpaceData>;
  readonly state: PresentationEntityState;
}

export interface PieceAppearanceResolverContext<TPieceData = unknown> {
  readonly piece: Piece<TPieceData>;
  readonly state: PresentationEntityState;
}

export type SpaceAppearanceResolver<TSpaceData = unknown> = (
  context: SpaceAppearanceResolverContext<TSpaceData>,
) => AppearanceAssignment<SpaceAppearance> | SpaceAppearance | undefined;

export type PieceAppearanceResolver<TPieceData = unknown> = (
  context: PieceAppearanceResolverContext<TPieceData>,
) => AppearanceAssignment<PieceAppearance> | PieceAppearance | undefined;

export interface BoardAppearanceTheme {
  readonly name?: string;
  readonly spaceDefault?: SpaceAppearance;
  readonly pieceDefault?: PieceAppearance;
  readonly spaceStyles?: Readonly<Record<string, SpaceAppearance>>;
  readonly pieceStyles?: Readonly<Record<string, PieceAppearance>>;
}

export interface BoardAppearanceConfig<
  TSpaceData = unknown,
  TPieceData = unknown,
> {
  readonly theme?: BoardAppearanceTheme;
  readonly spaces?: Readonly<
    Record<SpaceId, AppearanceAssignment<SpaceAppearance> | SpaceAppearance>
  >;
  readonly pieces?: Readonly<
    Record<PieceId, AppearanceAssignment<PieceAppearance> | PieceAppearance>
  >;
  readonly spaceStates?: Readonly<Record<SpaceId, PresentationEntityState>>;
  readonly pieceStates?: Readonly<Record<PieceId, PresentationEntityState>>;
  readonly resolveSpace?: SpaceAppearanceResolver<TSpaceData>;
  readonly resolvePiece?: PieceAppearanceResolver<TPieceData>;
}

export const DEFAULT_SPACE_APPEARANCE: Readonly<SpaceAppearance> = Object.freeze({
  color: "#d7dde6",
  opacity: 1,
  scale: 1,
  rotation: 0,
  offset: Object.freeze({ x: 0, y: 0, z: 0 }),
});

export const DEFAULT_PIECE_APPEARANCE: Readonly<PieceAppearance> = Object.freeze({
  color: "#4f7cff",
  opacity: 1,
  scale: 1,
  rotation: 0,
  offset: Object.freeze({ x: 0, y: 0, z: 0 }),
});

const STATE_PRECEDENCE: readonly AppearanceState[] = Object.freeze([
  AppearanceState.Occupied,
  AppearanceState.Reachable,
  AppearanceState.Blocked,
  AppearanceState.Highlighted,
  AppearanceState.Selected,
  AppearanceState.Active,
]);

export function resolveSpaceAppearance<TSpaceData = unknown, TPieceData = unknown>(
  space: Space<TSpaceData>,
  config: BoardAppearanceConfig<TSpaceData, TPieceData> = {},
): SpaceAppearance {
  const state = config.spaceStates?.[space.id] ?? {};
  return resolveAppearance(
    DEFAULT_SPACE_APPEARANCE,
    config.theme?.spaceDefault,
    config.theme?.spaceStyles,
    config.spaces?.[space.id],
    config.resolveSpace?.({ space, state }),
    state,
  );
}

export function resolvePieceAppearance<TSpaceData = unknown, TPieceData = unknown>(
  piece: Piece<TPieceData>,
  config: BoardAppearanceConfig<TSpaceData, TPieceData> = {},
): PieceAppearance {
  const state = config.pieceStates?.[piece.id] ?? {};
  return resolveAppearance(
    DEFAULT_PIECE_APPEARANCE,
    config.theme?.pieceDefault,
    config.theme?.pieceStyles,
    config.pieces?.[piece.id],
    config.resolvePiece?.({ piece, state }),
    state,
  );
}

function resolveAppearance<TAppearance extends AppearanceDefinition>(
  fallback: Readonly<TAppearance>,
  themeDefault: TAppearance | undefined,
  styles: Readonly<Record<string, TAppearance>> | undefined,
  staticAssignment: AppearanceAssignment<TAppearance> | TAppearance | undefined,
  resolverAssignment: AppearanceAssignment<TAppearance> | TAppearance | undefined,
  state: PresentationEntityState,
): TAppearance {
  let resolved = mergeAppearance(fallback, themeDefault) as TAppearance;
  resolved = applyAssignment(resolved, staticAssignment, styles);
  resolved = applyAssignment(resolved, resolverAssignment, styles);

  for (const stateName of STATE_PRECEDENCE) {
    if (isStateActive(state, stateName)) {
      resolved = mergeAppearance(
        resolved,
        resolved.variants?.[stateName],
      ) as TAppearance;
    }
  }

  return resolved;
}

function applyAssignment<TAppearance extends AppearanceDefinition>(
  current: TAppearance,
  assignment: AppearanceAssignment<TAppearance> | TAppearance | undefined,
  styles: Readonly<Record<string, TAppearance>> | undefined,
): TAppearance {
  if (!assignment) {
    return current;
  }

  if (!isAssignment(assignment)) {
    return mergeAppearance(current, assignment) as TAppearance;
  }

  let resolved = current;
  if (assignment.style) {
    const style = styles?.[assignment.style];
    if (style) {
      resolved = mergeAppearance(resolved, style) as TAppearance;
    }
  }

  return mergeAppearance(resolved, assignment.appearance) as TAppearance;
}

function isAssignment<TAppearance extends AppearanceDefinition>(
  value: AppearanceAssignment<TAppearance> | TAppearance,
): value is AppearanceAssignment<TAppearance> {
  return "style" in value || "appearance" in value;
}

function mergeAppearance(
  base: Readonly<AppearanceDefinition>,
  override: Readonly<AppearanceDefinition | AppearanceVisual> | undefined,
): AppearanceDefinition {
  if (!override) {
    return cloneAppearance(base);
  }

  return {
    ...base,
    ...override,
    offset: mergePoint(base.offset, override.offset),
    label: mergeLabel(base.label, override.label),
    variants: mergeVariants(base.variants, "variants" in override ? override.variants : undefined),
  };
}

function cloneAppearance(
  source: Readonly<AppearanceDefinition>,
): AppearanceDefinition {
  return {
    ...source,
    offset: source.offset ? { ...source.offset } : undefined,
    label: source.label ? { ...source.label } : undefined,
    variants: mergeVariants(undefined, source.variants),
  };
}

function mergePoint(
  base: PresentationPoint3 | undefined,
  override: PresentationPoint3 | undefined,
): PresentationPoint3 | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    x: override?.x ?? base?.x ?? 0,
    y: override?.y ?? base?.y ?? 0,
    z: override?.z ?? base?.z ?? 0,
  };
}

function mergeLabel(
  base: AppearanceLabel | undefined,
  override: AppearanceLabel | undefined,
): AppearanceLabel | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...base,
    ...override,
  };
}

function mergeVariants(
  base: Readonly<Partial<Record<AppearanceState, AppearanceVisual>>> | undefined,
  override: Readonly<Partial<Record<AppearanceState, AppearanceVisual>>> | undefined,
): Readonly<Partial<Record<AppearanceState, AppearanceVisual>>> | undefined {
  if (!base && !override) {
    return undefined;
  }

  const result: Partial<Record<AppearanceState, AppearanceVisual>> = {};
  for (const state of STATE_PRECEDENCE) {
    const baseVariant = base?.[state];
    const overrideVariant = override?.[state];
    if (baseVariant || overrideVariant) {
      result[state] = mergeAppearance(
        baseVariant ?? {},
        overrideVariant,
      );
    }
  }

  return result;
}

function isStateActive(
  state: PresentationEntityState,
  stateName: AppearanceState,
): boolean {
  switch (stateName) {
    case AppearanceState.Selected:
      return state.selected === true;
    case AppearanceState.Highlighted:
      return state.highlighted === true;
    case AppearanceState.Reachable:
      return state.reachable === true;
    case AppearanceState.Blocked:
      return state.blocked === true;
    case AppearanceState.Occupied:
      return state.occupied === true;
    case AppearanceState.Active:
      return state.active === true;
  }
}
