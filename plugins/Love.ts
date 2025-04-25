import { proto, AnyMessageContent } from "@whiskeysockets/baileys";
import { GetText, Plugin, SendMessage, WAWebsocket } from "../types";
import { containsTrigger } from "../utils";

const LOVE_OF_MY_LIFE = "972546872292@s.whatsapp.net";

export class ILoveYouMore extends Plugin {
  #triggers;

  constructor(socket: WAWebsocket, getText: GetText, sendMessage: SendMessage) {
    super(socket, getText, sendMessage);
    this.#triggers = ["יותר", 'אוהבת'];
  }

  async process(key: proto.IMessageKey, message: proto.IMessage) {
    const text = this.getText(key, message);

    if (!containsTrigger(text, this.#triggers)) {
      return;
    }

    if (!key.remoteJid) {
      return;
    }

    const sender = key.remoteJid;

    if (!sender) {
      console.error("NO SENDER", key, message);
      return;
    }

    if (sender != LOVE_OF_MY_LIFE) {
      return;
    }

    try {
      this.sendMessage(
        // @ts-ignore
        sender,
        {
          text: `אני אוהב אותך יותר ❤️`,
        },
        { quoted: { key, message } }
      );
    } catch (err) {
      console.log("ERROR in TagEveryone:", err);
    }
  }
}
