export interface RendererTargetOwner<TTarget> {
  disposeTarget(target: TTarget): void;
}

interface ActiveRendererTarget<TTarget> {
  readonly owner: RendererTargetOwner<TTarget>;
  readonly target: TTarget;
}

export class RendererTargetLifecycle<TTarget> {
  #active?: ActiveRendererTarget<TTarget>;

  public get target(): TTarget | undefined {
    return this.#active?.target;
  }

  public get hasActiveTarget(): boolean {
    return this.#active !== undefined;
  }

  public activate(
    owner: RendererTargetOwner<TTarget>,
    target: TTarget,
  ): void {
    if (this.#active?.owner === owner && this.#active.target === target) {
      return;
    }

    this.disposeActive();
    this.#active = { owner, target };
  }

  public disposeActive(): void {
    const active = this.#active;
    if (!active) {
      return;
    }

    this.#active = undefined;
    active.owner.disposeTarget(active.target);
  }
}
