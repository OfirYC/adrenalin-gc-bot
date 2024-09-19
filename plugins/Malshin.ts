import { proto, AnyMessageContent } from "@whiskeysockets/baileys";
import { GetText, Plugin, SendMessage, WAWebsocket } from "../types";

const { containsTrigger } = require("../utils");

export class Malshin extends Plugin {
  #blacklistedWords = [
    "אריה",
    "אריות",
    "עד מתי",
    "כמה עוד",
    "למה מלכתחילה",
    "עייף",
    "עייפים",
    "מלך",
    "מלכים",
    "nhkv dasdfa",
    "מילה אסורה כלשהי",
  ];

  constructor(socket: WAWebsocket, getText: GetText, sendMessage: SendMessage) {
    super(socket, getText, sendMessage);
  }

  async process(key: proto.IMessageKey, message: proto.IMessage) {
    if (!key.remoteJid) {
      return;
    }

    const text = this.getText(key, message);

    const terminatorID = "972532200486@s.whatsapp.net";

    if (containsTrigger(text, this.#blacklistedWords)) {
      this.sendMessage(
        key.remoteJid,
        {
          text: `@${terminatorID.slice(0, 12)} מילה אסורה ^^^`,
          mentions: [terminatorID],
        },
        { quoted: { key, message } }
      );
    }
  }
}
