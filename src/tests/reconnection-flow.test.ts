import { describe, afterEach, beforeEach, it, expect } from "vitest";
import { LobbyServer } from "../servers/lobby-server/index.js";
import { IdentityProviderService } from "../servers/services/identity-provider/index.js";
import { PendingReconnectionStoreService } from "../servers/services/pending-reconnection-store/index.js";
import { GameSessionStoreService } from "../servers/services/game-session-store/index.js";
import { WebSocketServer, WebSocket } from "ws";
import { GameServerSessionClaimTokenCodec } from "../servers/lobby-server/game-handoff/game-server-session-claim-token.js";
import { EncryptionHelpers } from "../cryptography/index.js";
import { GameServer } from "../servers/game-server/index.js";
import { GameServerName } from "../aliases.js";
import { MessageFromServer } from "../messages/from-server.js";
import {
  MessageFromClient,
  MessageFromClientType,
} from "../messages/from-client.js";

const TEST_GAME_SERVER_NAME = "Lindblum Test Server" as GameServerName;

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
    const lobbyClient = new WebSocket("ws://localhost:8082");

    lobbyClient.on("message", (rawData) => {
      const asString = rawData.toString();
      const asJson = JSON.parse(asString);
      const typedMessage = asJson as MessageFromServer;

      console.log("lobby client got message:", typedMessage);
    });

    await new Promise<void>((resolve, reject) => {
      lobbyClient.on("open", () => resolve());
      lobbyClient.on("error", (err) => reject(err));
    });

    const gameCreatedUpdate = new Promise<void>((resolve) => {
      lobbyClient.once("message", (rawData) => {
        resolve();
      });
    });

    lobbyClient.send(
      JSON.stringify({ type: MessageFromClientType.CreateGame, gameName: "" })
    );

    await gameCreatedUpdate;
    expect(lobbyServer.gameLifecycleController.noCurrentGames()).toBe(false);
  });

  it("reconnection flow 2", async () => {
    const lobbyClient = new WebSocket("ws://localhost:8082");

    lobbyClient.on("message", (rawData) => {
      const asString = rawData.toString();
      const asJson = JSON.parse(asString);
      const typedMessage = asJson as MessageFromServer;

      console.log("lobby client got message:", typedMessage);
    });

    await new Promise<void>((resolve, reject) => {
      lobbyClient.on("open", () => resolve());
      lobbyClient.on("error", (err) => reject(err));
    });

    lobbyClient.send(
      JSON.stringify({ type: MessageFromClientType.CreateGame, gameName: "" })
    );
    //
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

  const lobbyWebsocketServer = new WebSocketServer({ port: 8082 });
  const lobbyServer = new LobbyServer(
    identityProviderService,
    pendingReconnectionStoreService,
    gameSessionStoreService,
    lobbyWebsocketServer,
    gameServerSessionClaimTokenCodec
  );

  const gameServerWebsocketServer = new WebSocketServer({ port: 8083 });
  const gameServer = new GameServer(
    TEST_GAME_SERVER_NAME,
    pendingReconnectionStoreService,
    gameSessionStoreService,
    gameServerWebsocketServer,
    gameServerSessionClaimTokenCodec
  );

  return { lobbyServer, gameServer };
}
