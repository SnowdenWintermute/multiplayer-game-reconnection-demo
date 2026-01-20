import { describe, afterEach, beforeEach, it, expect } from "vitest";
import { LobbyServer } from "../servers/lobby-server/index.js";
import { GameServer } from "../servers/game-server/index.js";
import { GameName } from "../aliases.js";
import { MessageFromServerType } from "../messages/from-server.js";
import { MessageFromClientType } from "../messages/from-client.js";
import { TestClient } from "./test-client.js";
import { invariant } from "../utils/index.js";
import { MyGameClass } from "../game/index.js";
import {
  localServerUrl,
  setUpTestServers,
  TEST_LOBBY_PORT,
} from "./test-servers-setup.js";
import { QUERY_PARAMS } from "../servers/base-server.js";

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
    const hostClient = new TestClient("game host");
    hostClient.initializeSocket(localServerUrl(TEST_LOBBY_PORT));
    await hostClient.connect();

    const gameHostFullUpdate = await hostClient.sendMessageAndAwaitReplyType(
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

    const joinerClient = new TestClient("game joiner");
    joinerClient.initializeSocket(localServerUrl(TEST_LOBBY_PORT));
    await joinerClient.connect();

    const joinerFullUpdate = await joinerClient.sendMessageAndAwaitReplyType(
      {
        type: MessageFromClientType.JoinGame,
        data: { gameName: gameUpdate.game.name },
      },
      MessageFromServerType.GameFullUpdate
    );

    const joinerGame = joinerFullUpdate.data.game;
    expect(joinerGame).toBeDefined();
    invariant(joinerGame !== null);

    const deserializedJoinerGame = MyGameClass.getDeserialized(joinerGame);
    expect(deserializedJoinerGame.playerRegistry.players.size).toBe(2);

    const hostReadiedMessage = await hostClient.sendMessageAndAwaitReplyType(
      { type: MessageFromClientType.ToggleReadyToStartGame, data: undefined },
      MessageFromServerType.PlayerToggledReadyToStartGame
    );

    expect(hostReadiedMessage.data.username).toBe(hostClient.username);

    const hostConnectionInstructionsMessage = hostClient.awaitMessageFromServer(
      MessageFromServerType.GameServerConnectionInstructions
    );

    const joinerReadiedMessage =
      await joinerClient.sendMessageAndAwaitReplyType(
        { type: MessageFromClientType.ToggleReadyToStartGame, data: undefined },
        MessageFromServerType.GameServerConnectionInstructions
      );

    const hostConnectionInstructions = await hostConnectionInstructionsMessage;

    hostClient.socket.close();
    joinerClient.socket.close();

    hostClient.initializeSocket(
      hostConnectionInstructions.data.connectionInstructions.url
    );
    // don't allow connecting without token
    await expect(hostClient.connect()).rejects.toThrow();

    const hostClientQueryParams = {
      name: QUERY_PARAMS.SESSION_CLAIM_TOKEN,
      value:
        hostConnectionInstructions.data.connectionInstructions
          .encryptedSessionClaimToken,
    };

    // successful connection with token
    hostClient.initializeSocket(
      hostConnectionInstructions.data.connectionInstructions.url,
      [hostClientQueryParams]
    );
    const clientGetsGameOnGameServerJoin = hostClient.awaitMessageFromServer(
      MessageFromServerType.GameFullUpdate
    );
    await hostClient.connect();

    const message = await clientGetsGameOnGameServerJoin;
    expect(message.data.game).toBeDefined();

    // don't allow reconnecting with same token
    hostClient.initializeSocket(
      hostConnectionInstructions.data.connectionInstructions.url,
      [hostClientQueryParams]
    );
    await expect(hostClient.connect()).rejects.toThrow();
  });
});
