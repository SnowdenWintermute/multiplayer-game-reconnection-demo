import { GameId, GameName, MessageDispatchChannelName } from "../aliases.js";
import { ERROR_MESSAGES } from "../error-messages.js";
import { UserId } from "../servers/services/identity-provider/tagged-user-id.js";
import { ReferenceCountedLock } from "../utils/reference-counted-lock.js";
import { PlayerRegistry } from "./player-registry.js";
import { instanceToPlain, plainToInstance } from "class-transformer";

const GAME_CHANNEL_PREFIX = "game-";

export class MyGameClass {
  private _playerRegistry = new PlayerRegistry();
  private _timeHandedOff: number | null = null;
  private _timeStarted: number | null = null;
  private inputLock = new ReferenceCountedLock<UserId>();

  constructor(
    public readonly id: GameId,
    public readonly name: GameName
  ) {}

  get timeHandedOff() {
    return this._timeHandedOff;
  }

  getSerialized() {
    const serialized = instanceToPlain(this) as MyGameClass;
    return serialized;
  }

  static getDeserialized(game: MyGameClass) {
    const deserialized = plainToInstance(MyGameClass, game);
    deserialized._playerRegistry = PlayerRegistry.getDeserialized(
      game.playerRegistry
    );
    deserialized.inputLock = new ReferenceCountedLock<UserId>();

    return deserialized;
  }

  get playerRegistry() {
    return this._playerRegistry;
  }

  setAsHandedOff() {
    this._timeHandedOff = Date.now();
  }

  getChannelName() {
    return `${GAME_CHANNEL_PREFIX}${this.name}` as MessageDispatchChannelName;
  }

  requireGameStartPrerequisites() {
    this.requireNotYetStarted();
  }

  get timeStarted() {
    return this._timeStarted;
  }

  requireNotYetStarted() {
    if (this.timeStarted !== null) {
      throw new Error(ERROR_MESSAGES.GAME.ALREADY_STARTED);
    }
  }

  requireTimeStarted() {
    if (this.timeStarted === null) {
      throw new Error("Expected the game to have been started");
    }
    return this.timeStarted;
  }

  setAsStarted() {
    if (this.timeStarted !== null) {
      throw new Error(ERROR_MESSAGES.GAME.ALREADY_STARTED);
    }
    this._timeStarted = Date.now();
  }
}
