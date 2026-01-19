import { ConnectionId } from "../../aliases.js";
import { WebSocket } from "ws";

export class OutgoingMessageGateway<Sendable extends Object> {
  private transportEndpoints = new Map<ConnectionId, WebSocket>();

  private encode(raw: Sendable) {
    return JSON.stringify(raw);
  }

  registerEndpoint(id: ConnectionId, endpoint: WebSocket): void {
    this.transportEndpoints.set(id, endpoint);
  }

  unregisterEndpoint(connectionId: ConnectionId): void {
    this.transportEndpoints.delete(connectionId);
  }

  submitToConnection(connectionId: ConnectionId, message: Sendable): void {
    const endpoint = this.transportEndpoints.get(connectionId);
    if (!endpoint) {
      throw new Error(
        `expected connection id ${connectionId} had no associated ConnectionEndpoint`
      );
    }

    endpoint.send(this.encode(message));
  }

  submitToConnections(connectionIds: ConnectionId[], message: Sendable): void {
    for (const id of connectionIds) {
      this.submitToConnection(id, message);
    }
  }
}
