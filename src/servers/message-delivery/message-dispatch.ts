import { ConnectionId } from "../../aliases.js";

export enum MessageDispatchType {
  Single,
  FanOut,
}

export interface MessageDispatchSingle<Sendable> {
  type: MessageDispatchType.Single;
  message: Sendable;
  connectionId: ConnectionId;
}

export interface MessageDispatchFanOut<Sendable> {
  type: MessageDispatchType.FanOut;
  message: Sendable;
  connectionIds: ConnectionId[];
}

export type MessageDispatch<Sendable> =
  | MessageDispatchSingle<Sendable>
  | MessageDispatchFanOut<Sendable>;
