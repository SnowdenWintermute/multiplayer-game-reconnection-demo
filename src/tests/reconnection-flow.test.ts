import { describe, afterEach, beforeEach, it, expect } from "vitest";
import { LobbyServer } from "../servers/lobby-server/index.js";
import { IdentityProviderService } from "../servers/services/identity-provider/index.js";
import { PendingReconnectionStoreService } from "../servers/services/pending-reconnection-store/index.js";
import { GameSessionStoreService } from "../servers/services/game-session-store/index.js";
import { WebSocketServer } from "ws";
import { GameServerSessionClaimTokenCodec } from "../servers/lobby-server/game-handoff/game-server-session-claim-token.js";
import { EncryptionHelpers } from "../cryptography/index.js";
import { GameServer } from "../servers/game-server/index.js";
import { GameName, GameServerName } from "../aliases.js";
import { MessageFromServerType } from "../messages/from-server.js";
import { MessageFromClientType } from "../messages/from-client.js";
import { TestClient } from "./test-client.js";
import { invariant } from "../utils/index.js";
import { MyGameClass } from "../game/index.js";

const TEST_GAME_SERVER_NAME = "Lindblum Test Server" as GameServerName;
const TEST_LOBBY_PORT = 8082;
const TEST_GAME_SERVER_PORT = 8083;

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

async function setUpTestServers() {
  const identityProviderService = new IdentityProviderService();
  const pendingReconnectionStoreService = new PendingReconnectionStoreService();
  const gameSessionStoreService = new GameSessionStoreService();
  const testSecret = await EncryptionHelpers.createSecret();
  const gameServerSessionClaimTokenCodec = new GameServerSessionClaimTokenCodec(
    testSecret
  );

  const lobbyWebsocketServer = new WebSocketServer({ port: TEST_LOBBY_PORT });
  const lobbyServer = new LobbyServer(
    identityProviderService,
    pendingReconnectionStoreService,
    gameSessionStoreService,
    lobbyWebsocketServer,
    gameServerSessionClaimTokenCodec
  );

  const gameServerWebsocketServer = new WebSocketServer({
    port: TEST_GAME_SERVER_PORT,
  });
  const gameServer = new GameServer(
    TEST_GAME_SERVER_NAME,
    pendingReconnectionStoreService,
    gameSessionStoreService,
    gameServerWebsocketServer,
    gameServerSessionClaimTokenCodec
  );

  return { lobbyServer, gameServer };
}
