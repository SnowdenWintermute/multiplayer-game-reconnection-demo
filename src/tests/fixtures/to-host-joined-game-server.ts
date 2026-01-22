import { expect } from "vitest";
import { MessageFromServerType } from "../../messages/from-server.js";
import { QUERY_PARAMS } from "../../servers/base-server.js";
import { LobbyServer } from "../../servers/lobby-server/index.js";
import { testGameSetupToInitialConnectionInstructionsIssued } from "./to-initial-connection-instructions-issued.js";

export async function testGameSetupToHostJoinGameServer(
  lobbyServer: LobbyServer
) {
  const {
    hostClient,
    hostConnectionInstructions,
    joinerClient,
    joinerConnectionInstructions,
  } = await testGameSetupToInitialConnectionInstructionsIssued(lobbyServer);

  const hostClientQueryParams = {
    name: QUERY_PARAMS.SESSION_CLAIM_TOKEN,
    value:
      hostConnectionInstructions.data.connectionInstructions
        .encryptedSessionClaimToken,
  };

  hostClient.initializeSocket(
    hostConnectionInstructions.data.connectionInstructions.url,
    [hostClientQueryParams]
  );
  const clientGetsGameOnGameServerJoin = hostClient.awaitMessageFromServer(
    MessageFromServerType.GameFullUpdate
  );
  await hostClient.connect();

  const hostGameDataOnJoin = await clientGetsGameOnGameServerJoin;
  expect(hostGameDataOnJoin.data.game).toBeDefined();

  return {
    hostClient,
    joinerClient,
    joinerConnectionInstructions,
    hostConnectionInstructions:
      hostConnectionInstructions.data.connectionInstructions,
    hostClientQueryParams,
  };
}
