import { proto, AnyMessageContent } from "@whiskeysockets/baileys";
import { GetText, Plugin, SendMessage, WAWebsocket } from "../types";

const { containsTrigger } = require("../utils");

export class TagEveryone extends Plugin {
  #membersLimit: number;
  #triggers;

  constructor(socket: WAWebsocket, getText: GetText, sendMessage: SendMessage) {
    super(socket, getText, sendMessage);
    this.#membersLimit = 100;
    this.#triggers = ["@all", "@כולם", "@everyone", "@צוות"];
  }

  async process(key: proto.IMessageKey, message: proto.IMessage) {
    const text = this.getText(key, message);

    if (!containsTrigger(text, this.#triggers)) {
      return;
    }

    if (!key.remoteJid) {
      return;
    }

    try {
      const grp = await this.socket.groupMetadata(key.remoteJid);
      const members = grp.participants;

      const mentions: string[] = [];
      const items: string[] = [];

      members.forEach(({ id, admin }) => {
        if (admin) {
          return;
        }
        mentions.push(id);
        items.push("@" + id.slice(0, 12));
      });

      if (members.length < this.#membersLimit) {
        this.sendMessage(
          key.remoteJid,
          { text: `${items.join(", ")}`, mentions },
          { quoted: { key, message } }
        );
      }
    } catch (err) {
      console.log("ERROR in TagEveryone:", err);
    }
  }
}
