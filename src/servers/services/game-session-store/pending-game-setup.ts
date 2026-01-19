import { Milliseconds } from "../../../aliases.js";
import { MyGameClass } from "../../../game/index.js";

export class PendingGameSetup {
  // lobby should periodically check for stale game setups and delete them
  private createdAt: number = Date.now();
  private timeToLive = (1000 * 60 * 5) as Milliseconds;
  constructor(public readonly game: MyGameClass) {}
}
