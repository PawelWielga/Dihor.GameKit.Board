export type BoardStateErrorCode =
  | "DUPLICATE_SPACE"
  | "DUPLICATE_PIECE"
  | "UNKNOWN_SPACE"
  | "UNKNOWN_PIECE"
  | "SPACE_OCCUPIED"
  | "OCCUPANCY_REJECTED";

export class BoardStateError extends Error {
  public readonly code: BoardStateErrorCode;

  public constructor(code: BoardStateErrorCode, message: string) {
    super(message);
    this.name = "BoardStateError";
    this.code = code;
  }
}
