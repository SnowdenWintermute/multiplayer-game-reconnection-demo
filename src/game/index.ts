import { GameId, GameName, MessageDispatchChannelName } from "../aliases.js";

const GAME_CHANNEL_PREFIX = "game-";

export class MyGameClass {
  private _timeHandedOff: number | null = null;
  constructor(
    public readonly id: GameId,
    public readonly name: GameName
  ) {}

  get timeHandedOff() {
    return this._timeHandedOff;
  }

  setAsHandedOff() {
    this._timeHandedOff = Date.now();
  }

  getChannelName() {
    return `${GAME_CHANNEL_PREFIX}${this.name}` as MessageDispatchChannelName;
  }
}
