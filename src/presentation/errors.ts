export type PresentationErrorCode =
  | "DUPLICATE_SPACE"
  | "UNKNOWN_SPACE"
  | "MISSING_SPACE_POSITION";

export class PresentationError extends Error {
  public constructor(
    public readonly code: PresentationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PresentationError";
  }
}
