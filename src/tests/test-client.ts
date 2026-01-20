import { RawData, WebSocket } from "ws";
import { MessageFromClient } from "../messages/from-client.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../messages/from-server.js";
import { Username } from "../aliases.js";

type MessageFromServerOfType<T extends MessageFromServerType> = Extract<
  MessageFromServer,
  { type: T }
>;

export class TestClient {
  private _socket: WebSocket | null = null;
  private _username: Username | null = null;
  constructor(public name: string) {}

  async connect(url: string) {
    const socket = new WebSocket(url);
    this._socket = socket;

    const usernameAssignment = this.awaitMessageFromServer(
      MessageFromServerType.ClientUsername
    );

    await new Promise<void>((resolve, reject) => {
      socket.on("open", () => resolve());
      socket.on("error", (err) => reject(err));
    });

    const usernameMessage = await usernameAssignment;
    this._username = usernameMessage.data.username;
  }

  get username() {
    if (this._username === null) {
      throw new Error("Socket not initialized");
    }
    return this._username;
  }

  get socket() {
    if (this._socket === null) {
      throw new Error("Socket not initialized");
    }
    return this._socket;
  }

  async sendMessageAndAwaitReplyType<T extends MessageFromServerType>(
    message: MessageFromClient,
    expectedReplyType: T
  ): Promise<MessageFromServerOfType<T>> {
    const messageFromServer = this.awaitMessageFromServer(expectedReplyType);
    this.socket.send(JSON.stringify(message));
    return await messageFromServer;
  }

  async awaitMessageFromServer<T extends MessageFromServerType>(
    expectedReplyType: T
  ): Promise<MessageFromServerOfType<T>> {
    return new Promise<MessageFromServerOfType<T>>((resolve) => {
      const handler = (rawData: any) => {
        const typedMessage = TestClient.getTypedMessage(rawData);
        if (typedMessage.type === expectedReplyType) {
          this.socket.off("message", handler);
          resolve(typedMessage as MessageFromServerOfType<T>);
        }
      };

      this.socket.on("message", handler);
    });
  }

  static getTypedMessage(rawData: RawData) {
    const asString = rawData.toString();
    const asJson = JSON.parse(asString);
    const typedMessage = asJson as MessageFromServer;
    return typedMessage;
  }
}
