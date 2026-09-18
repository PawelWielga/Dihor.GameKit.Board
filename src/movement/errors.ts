export type MovementErrorCode =
  | "TOPOLOGY_REQUIRED"
  | "UNKNOWN_TOPOLOGY_SPACE"
  | "NO_PATH"
  | "UNSUPPORTED_TOPOLOGY"
  | "OUT_OF_BOUNDS"
  | "INVALID_DISTANCE"
  | "INVALID_TOPOLOGY";

export class MovementError extends Error {
  public constructor(
    public readonly code: MovementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MovementError";
  }
}
