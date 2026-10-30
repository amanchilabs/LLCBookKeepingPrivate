type AccessState = 'ready' | 'transitioning' | 'locked';

interface StorageAccessCoordinatorOptions {
  initiallyReady?: boolean;
}

interface ReadyWaiter {
  resolve(): void;
  reject(error: Error): void;
}

/**
 * Drains active database work and holds all new work until a storage
 * transition has validated one active generation.
 */
export class StorageAccessCoordinator {
  private state: AccessState;
  private inFlight = 0;
  private pendingTransitions = 0;
  private transitionError: Error | undefined;
  private transitionTail: Promise<void> = Promise.resolve();
  private readonly readyWaiters = new Set<ReadyWaiter>();
  private readonly drainedWaiters = new Set<() => void>();

  constructor(options: StorageAccessCoordinatorOptions = {}) {
    this.state = options.initiallyReady ? 'ready' : 'locked';
  }

  async withOperation<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquireOperation();
    try {
      return await operation();
    } finally {
      this.inFlight -= 1;
      if (this.inFlight === 0) {
        for (const resolve of this.drainedWaiters) resolve();
        this.drainedWaiters.clear();
      }
    }
  }

  withExclusiveTransition<T>(transition: () => Promise<T>): Promise<T> {
    this.pendingTransitions += 1;
    this.state = 'transitioning';

    const result = this.transitionTail.then(async () => {
      this.state = 'transitioning';
      try {
        await this.waitForOperationsToDrain();
        const value = await transition();
        this.transitionError = undefined;
        return value;
      } catch (error) {
        this.transitionError = error instanceof Error ? error : new Error('Storage recovery failed.');
        throw error;
      } finally {
        this.pendingTransitions -= 1;
        if (this.pendingTransitions > 0) {
          this.state = 'transitioning';
        } else if (this.transitionError) {
          this.state = 'locked';
          this.rejectReadyWaiters(this.transitionError);
        } else {
          this.state = 'ready';
          this.resolveReadyWaiters();
        }
      }
    });

    this.transitionTail = result.then(() => undefined, () => undefined);
    return result;
  }

  /** Stop new work and lock only after all already-acquired operations settle. */
  lock(error: Error): void {
    void this.withExclusiveTransition(async () => { throw error; }).catch(() => undefined);
  }

  private async acquireOperation(): Promise<void> {
    while (true) {
      if (this.state === 'ready') {
        this.inFlight += 1;
        return;
      }
      if (this.state === 'locked') {
        throw this.transitionError ?? new Error('Financial storage is locked until recovery validates an active generation.');
      }
      await new Promise<void>((resolve, reject) => this.readyWaiters.add({ resolve, reject }));
    }
  }

  private async waitForOperationsToDrain(): Promise<void> {
    if (this.inFlight === 0) return;
    await new Promise<void>((resolve) => this.drainedWaiters.add(resolve));
  }

  private resolveReadyWaiters(): void {
    for (const waiter of this.readyWaiters) waiter.resolve();
    this.readyWaiters.clear();
  }

  private rejectReadyWaiters(error: Error): void {
    for (const waiter of this.readyWaiters) waiter.reject(error);
    this.readyWaiters.clear();
  }
}
