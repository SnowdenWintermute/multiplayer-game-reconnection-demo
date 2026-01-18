import { ConnectionId, MessageDispatchChannelName } from "../../aliases.js";
import { UserSessionRegistry } from "../sessions/user-session-registry.js";
import {
  MessageDispatchFanOut,
  MessageDispatchSingle,
  MessageDispatchType,
} from "./message-dispatch.js";

export class MessageDispatchFactory<Sendable> {
  constructor(private readonly userSessionRegistry: UserSessionRegistry) {}

  createSingle(
    to: ConnectionId,
    message: Sendable
  ): MessageDispatchSingle<Sendable> {
    return {
      type: MessageDispatchType.Single,
      connectionId: to,
      message,
    };
  }

  createFanOut(
    inChannel: MessageDispatchChannelName,
    message: Sendable,
    options?: {
      excludedIds?: ConnectionId[];
      excludedChannels?: MessageDispatchChannelName[];
    }
  ): MessageDispatchFanOut<Sendable> {
    const excludedIds = options?.excludedIds || [];

    const excludedChannels = options?.excludedChannels || [];
    const connectionIdsFromExcludedChannels: ConnectionId[] = [];
    for (const excludedChannel of excludedChannels) {
      connectionIdsFromExcludedChannels.push(
        ...this.userSessionRegistry.in(excludedChannel)
      );
    }

    const connectionIds = this.userSessionRegistry
      .in(inChannel) // Returns all connectionIds whose sessions are currently subscribed to the given channel. Multiple entries may belong to the same user.
      .filter((id) => !excludedIds.includes(id))
      .filter((id) => !connectionIdsFromExcludedChannels.includes(id));

    return {
      type: MessageDispatchType.FanOut,
      connectionIds,
      message,
    };
  }
}
