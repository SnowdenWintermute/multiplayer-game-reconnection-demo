import { MessageDispatchChannelName, ConnectionId } from "../../aliases.js";

export abstract class ConnectionSession {
  private channelsSubscribedTo = new Set<MessageDispatchChannelName>();

  constructor(public readonly connectionId: ConnectionId) {}

  isSubscribedToChannel(channelName: MessageDispatchChannelName) {
    return this.channelsSubscribedTo.has(channelName);
  }

  subscribeToChannel(channelName: MessageDispatchChannelName) {
    if (this.channelsSubscribedTo.has(channelName)) {
      throw new Error(
        "Tried to subscribe to a channel but was already subscribed to it"
      );
    }
    this.channelsSubscribedTo.add(channelName);
  }

  unsubscribeFromChannel(channelName: MessageDispatchChannelName) {
    if (!this.channelsSubscribedTo.has(channelName)) {
      throw new Error(
        "Tried to unsubscribe to a channel but was not subscribed to it"
      );
    }
    this.channelsSubscribedTo.delete(channelName);
  }
}
