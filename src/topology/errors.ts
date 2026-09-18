export type TopologyErrorCode = "DUPLICATE_SPACE" | "UNKNOWN_SPACE";

export class TopologyError extends Error {
  public constructor(
    public readonly code: TopologyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TopologyError";
  }
}
