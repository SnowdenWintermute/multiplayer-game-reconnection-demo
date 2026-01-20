import { describe, afterEach, beforeEach, it, expect } from "vitest";
import { LobbyServer } from "../servers/lobby-server/index.js";
import { GameServer } from "../servers/game-server/index.js";
import { GameName } from "../aliases.js";
import { MessageFromServerType } from "../messages/from-server.js";
import { MessageFromClientType } from "../messages/from-client.js";
import { TestClient } from "./test-client.js";
import { invariant } from "../utils/index.js";
import { MyGameClass } from "../game/index.js";
import { setUpTestServers, TEST_LOBBY_PORT } from "./test-servers-setup.js";

function localServerUrl(port: number) {
  return `ws://localhost:${port}`;
}

describe("lobby server", () => {
  let gameServer: GameServer;
  let lobbyServer: LobbyServer;
  beforeEach(async () => {
    const testServers = await setUpTestServers();
    lobbyServer = testServers.lobbyServer;
    gameServer = testServers.gameServer;
  });

  afterEach(async () => {
    lobbyServer.websocketServer.close();
    gameServer.websocketServer.close();
  });

  it("reconnection flow", async () => {
    expect(lobbyServer.gameLifecycleController.noCurrentGames()).toBe(true);
    const gameHostClient = new TestClient("game host");
    await gameHostClient.connect(localServerUrl(TEST_LOBBY_PORT));

    const gameHostFullUpdate =
      await gameHostClient.sendMessageAndAwaitReplyType(
        {
          type: MessageFromClientType.CreateGame,
          data: { gameName: "" as GameName },
        },
        MessageFromServerType.GameFullUpdate
      );

    const gameUpdate = gameHostFullUpdate.data;
    expect(gameUpdate.game).toBeDefined();
    invariant(gameUpdate.game !== null);

    expect(lobbyServer.gameLifecycleController.noCurrentGames()).toBe(false);

    const gameJoinerClient = new TestClient("game joiner");
    await gameJoinerClient.connect(localServerUrl(TEST_LOBBY_PORT));

    const gameJoinerFullUpdate =
      await gameJoinerClient.sendMessageAndAwaitReplyType(
        {
          type: MessageFromClientType.JoinGame,
          data: { gameName: gameUpdate.game.name },
        },
        MessageFromServerType.GameFullUpdate
      );

    const joinerGame = gameJoinerFullUpdate.data.game;
    expect(joinerGame).toBeDefined();
    invariant(joinerGame !== null);

    const deserializedJoinerGame = MyGameClass.getDeserialized(joinerGame);
    expect(deserializedJoinerGame.playerRegistry.players.size).toBe(2);

    const hostReadiedMessage =
      await gameHostClient.sendMessageAndAwaitReplyType(
        { type: MessageFromClientType.ToggleReadyToStartGame, data: undefined },
        MessageFromServerType.PlayerToggledReadyToStartGame
      );

    expect(hostReadiedMessage.data.username).toBe(gameHostClient.username);
  });
});
