import makeWASocket, {
  AnyMessageContent,
  DisconnectReason,
  proto,
} from "@whiskeysockets/baileys";
import P from "pino";
import { AuthState, Plugin, WAWebsocket } from "./types";
import { useMongoDBAuthState } from "./mongodb-auth";
export type PluginConstructor = (
  ...params: ConstructorParameters<typeof Plugin>
) => Plugin;

export class Bot {
  #socket: WAWebsocket;
  #messageStore: Record<string, proto.WebMessageInfo> = {};
  #emptyChar = "‎ ";
  #selfReply: boolean;
  #saveCredentials: () => Promise<void>;
  #logMessages: boolean;
  #plugins: Plugin[];

  static async getAuthState() {
    return await useMongoDBAuthState({
      mongodbUri: `mongodb+srv://heroku:${process.env.MONGODB_PASSWORD}@whatsapp-bot.xs8qv.mongodb.net/?retryWrites=true&w=majority&appName=whatsapp-bot`,
      sessionId: "prod_session_id",
      collectionName: "bot_collection",
    });
  }

  constructor(authState: AuthState, plugins: PluginConstructor[], config = {}) {
    this.#selfReply = false;
    this.#logMessages = true;

    const { state, saveCreds } = authState;

    this.#saveCredentials = saveCreds;

    this.#socket = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      getMessage: this.#getMessageFromStore,
      logger: P({ level: "error" }) as any,
    });

    this.#plugins = plugins.map(pluginConstructor =>
      pluginConstructor(this.#socket, this.#getText, this.#sendMessage)
    );

    this.#plugins.forEach(plugin =>
      plugin.init(this.#socket, this.#getText, this.#sendMessage)
    );
  }

  connect(authState: AuthState) {
    const { state, saveCreds } = authState;

    this.#saveCredentials = saveCreds;

    this.#socket = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      getMessage: this.#getMessageFromStore,
      logger: P({ level: "error" }) as any,
    });

    this.#plugins.forEach(plugin =>
      plugin.init(this.#socket, this.#getText, this.#sendMessage)
    );
  }

  async run(authState: AuthState) {
    this.#socket.ev.process(async events => {
      if (events["connection.update"]) {
        const update = events["connection.update"];
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
          // reconnect if not logged out
          if (
            // @ts-ignore
            lastDisconnect?.error?.output?.statusCode ===
            DisconnectReason.loggedOut
          ) {
            console.log("Connection closed. You are logged out.");
          } else if (
            // @ts-ignore
            lastDisconnect?.error?.output?.statusCode ===
            DisconnectReason.timedOut
          ) {
            console.log(
              new Date().toLocaleTimeString(),
              "Timed out. Will retry in 1 minute."
            );
            setTimeout(this.#restart.bind(this), 60 * 1000);
          } else {
            this.#restart(authState);
          }
        }
      }

      if (events["creds.update"]) {
        await this.#saveCredentials();
      }

      if (events["messages.upsert"]) {
        const { messages } = events["messages.upsert"];

        if (this.#logMessages) console.log("msg upsert", messages);

        messages.forEach(async msg => {
          const { key, message } = msg;

          if (!message || this.#getText(key, message).includes(this.#emptyChar))
            return;

          this.#plugins.forEach(plugin => plugin.process(key, message));
        });
      }

      if (events["messaging-history.set"]) {
        console.log(
          "MESSAGING HISTORY",
          events["messaging-history.set"].contacts
        );
      }
    });
  }

  async #restart(authState: AuthState) {
    this.connect(authState);
    await this.run(authState);
  }

  #getMessageFromStore = async (key: proto.IMessageKey) => {
    const { id } = key;
    if (id && !!this.#messageStore[id]) {
      return this.#messageStore[id].message || undefined;
    }
  };

  #getText(key: proto.IMessageKey, message: proto.IMessage) {
    try {
      let text = message.conversation || message.extendedTextMessage?.text;

      if (key.participant) {
        const me = key.participant.slice(0, 12);
        text = text?.replace(/\@me\b/g, `@${me}`);
      }

      return text || "";
    } catch (err) {
      return "";
    }
  }

  #sendMessage = async (
    jid: string,
    content: AnyMessageContent,
    ...args: any
  ) => {
    try {
      if (!this.#selfReply && "text" in content) {
        content.text = content.text + this.#emptyChar;
      }

      const sent = await this.#socket.sendMessage(jid, content, ...args);
      if (sent?.key.id) {
        this.#messageStore[sent.key.id] = sent;
      }
    } catch (err) {
      console.log("Error sending message", err);
    }
  };
}
