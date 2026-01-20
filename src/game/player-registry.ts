import { plainToInstance } from "class-transformer";
import { Username } from "../aliases.js";
import { ERROR_MESSAGES } from "../error-messages.js";
import { MyGamePlayerClass } from "./player.js";
import cloneDeep from "lodash.clonedeep";

export class PlayerRegistry {
  private _players = new Map<Username, MyGamePlayerClass>();
  constructor() {}

  static getDeserialized(raw: PlayerRegistry) {
    const deserialized = plainToInstance(PlayerRegistry, raw);
    deserialized._players = new Map<Username, MyGamePlayerClass>();
    // must object.entries since map serializes to plain object
    for (const [username, player] of Object.entries(raw._players)) {
      deserialized.addPlayer(player);
    }

    return deserialized;
  }

  get players() {
    return cloneDeep(this._players);
  }

  isEmpty() {
    return this.players.size === 0;
  }

  registerPlayerFromLobbyUser(username: Username) {
    this.addPlayer(new MyGamePlayerClass(username));
  }

  addPlayer(player: MyGamePlayerClass) {
    this._players.set(player.username, player);
  }

  removePlayer(username: Username) {
    this._players.delete(username);
  }

  requirePlayer(username: Username) {
    const result = this._players.get(username);
    if (result === undefined) {
      throw new Error(ERROR_MESSAGES.PLAYER.DOES_NOT_EXIST);
    }
    return result;
  }
}
