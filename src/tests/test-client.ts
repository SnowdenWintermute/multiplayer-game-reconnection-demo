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

  initializeSocket(
    url: string,
    queryParams: { name: string; value: string }[] = []
  ) {
    let urlWithParams = url;
    queryParams.forEach(({ name, value }, i) => {
      const isFirstParam = i === 0;
      if (isFirstParam) {
        urlWithParams += "?";
      } else {
        urlWithParams += "&";
      }

      urlWithParams += `${name}=${encodeURIComponent(value)}`;
    });

    const socket = new WebSocket(urlWithParams);
    this._socket = socket;
  }

  async connect() {
    const usernameAssignment = this.awaitMessageFromServer(
      MessageFromServerType.ClientUsername
    );

    await new Promise<void>((resolve, reject) => {
      const onOpen = async () => {
        try {
          const usernameMessage = await usernameAssignment;
          this._username = usernameMessage.data.username;
          cleanup();
          resolve();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const onClose = (code: number) => {
        cleanup();
        reject(new Error(`WebSocket closed with code ${code}`));
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.socket.off("open", onOpen);
        this.socket.off("close", onClose);
        this.socket.off("error", onError);
      };

      this.socket.once("open", onOpen);
      this.socket.once("close", onClose);
      this.socket.once("error", onError);
    });
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

  async oldAwaitMessageFromServer<T extends MessageFromServerType>(
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

  async awaitMessageFromServer<T extends MessageFromServerType>(
    expectedReplyType: T
  ): Promise<MessageFromServerOfType<T>> {
    const socket = this.socket;

    return new Promise<MessageFromServerOfType<T>>((resolve, reject) => {
      const onMessage = (rawData: RawData) => {
        const typedMessage = TestClient.getTypedMessage(rawData);
        if (typedMessage.type === expectedReplyType) {
          cleanup();
          resolve(typedMessage as MessageFromServerOfType<T>);
        }
      };

      const onClose = () => {
        cleanup();
        reject(new Error("Socket closed before expected message"));
      };

      const cleanup = () => {
        socket.off("message", onMessage);
        socket.off("close", onClose);
      };

      socket.on("message", onMessage);
      socket.once("close", onClose);
    });
  }

  static getTypedMessage(rawData: RawData) {
    const asString = rawData.toString();
    const asJson = JSON.parse(asString);
    const typedMessage = asJson as MessageFromServer;
    return typedMessage;
  }
}
