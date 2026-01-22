import { WebSocketServer } from "ws";
import { IdentityProviderService } from "../../servers/services/identity-provider/index.js";
import { GameSessionStoreService } from "../../servers/services/game-session-store/index.js";
import { GameServerSessionClaimTokenCodec } from "../../servers/lobby-server/game-handoff/game-server-session-claim-token.js";
import { EncryptionHelpers } from "../../cryptography/index.js";
import { GameServerName } from "../../aliases.js";
import { LobbyServer } from "../../servers/lobby-server/index.js";
import { GameServer } from "../../servers/game-server/index.js";
import { GameServerReconnectionForwardingRecordStoreService } from "../../servers/services/game-server-reconnection-forwarding-record/index.js";

const TEST_GAME_SERVER_NAME = "Lindblum Test Server" as GameServerName;
export const TEST_LOBBY_PORT = 8082;
export const TEST_GAME_SERVER_PORT = 8083;
export const TEST_LOBBY_URL = localServerUrl(TEST_LOBBY_PORT);

export function localServerUrl(port: number) {
  return `ws://localhost:${port}`;
}

async function testLeastBusyServerUrlGetter() {
  return localServerUrl(TEST_GAME_SERVER_PORT);
}

export async function setUpTestServers() {
  const identityProviderService = new IdentityProviderService();
  const gameServerReconnectionForwardingRecordStoreService =
    new GameServerReconnectionForwardingRecordStoreService();
  const gameSessionStoreService = new GameSessionStoreService();
  const testSecret = await EncryptionHelpers.createSecret();
  const gameServerSessionClaimTokenCodec = new GameServerSessionClaimTokenCodec(
    testSecret
  );

  const lobbyWebsocketServer = new WebSocketServer({ port: TEST_LOBBY_PORT });
  const lobbyServer = new LobbyServer(
    identityProviderService,
    gameServerReconnectionForwardingRecordStoreService,
    gameSessionStoreService,
    lobbyWebsocketServer,
    gameServerSessionClaimTokenCodec,
    testLeastBusyServerUrlGetter
  );

  const gameServerWebsocketServer = new WebSocketServer({
    port: TEST_GAME_SERVER_PORT,
  });
  const gameServer = new GameServer(
    TEST_GAME_SERVER_NAME,
    gameServerReconnectionForwardingRecordStoreService,
    gameSessionStoreService,
    gameServerWebsocketServer,
    gameServerSessionClaimTokenCodec
  );

  return { lobbyServer, gameServer };
}
