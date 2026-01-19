import { Milliseconds } from "../aliases.js";

export class HeartbeatTask {
  public lastRunMs: Milliseconds = 0 as Milliseconds;

  constructor(
    public readonly intervalMs: Milliseconds,
    public readonly run: () => void | Promise<void>
  ) {}
}

export class HeartbeatScheduler<K> {
  private interval: NodeJS.Timeout | null = null;
  private readonly tasks = new Map<K, HeartbeatTask>();

  constructor(private readonly tickMs: Milliseconds) {}

  register(key: K, task: HeartbeatTask): void {
    this.tasks.set(key, task);
  }

  unregister(key: K): void {
    this.tasks.delete(key);
  }

  start(): void {
    if (this.interval !== null) {
      return;
    }

    this.interval = setInterval(() => {
      void this.tick();
    }, this.tickMs);
  }

  private async tick(): Promise<void> {
    const now = Date.now() as Milliseconds;

    for (const [_key, task] of this.tasks) {
      if (now - task.lastRunMs >= task.intervalMs) {
        task.lastRunMs = now;
        try {
          await task.run();
        } catch (error) {
          console.error("error in heartbeat:", error);
        }
      }
    }
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
