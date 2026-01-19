import { GameName } from "../../aliases.js";
import { ERROR_MESSAGES } from "../../error-messages.js";
import { MyGameClass } from "../../game/index.js";
import { ArrayUtils } from "../../utils/array.js";

export class GameRegistry {
  private games = new Map<GameName, MyGameClass>();

  registerGame(game: MyGameClass) {
    const gameExists = this.games.get(game.name) !== undefined;
    if (gameExists) {
      throw new Error(
        "Tried to add a game to a lobby but a game by that name already existed"
      );
    }
    this.games.set(game.name, game);
  }

  unregisterGame(gameName: GameName) {
    this.games.delete(gameName);
  }

  getGameOption(gameName: GameName) {
    return this.games.get(gameName);
  }

  requireGame(gameName: GameName) {
    const gameOption = this.getGameOption(gameName);
    if (gameOption === undefined) {
      console.trace();
      throw new Error(ERROR_MESSAGES.GAME.NOT_FOUND);
    }

    return gameOption;
  }
}
