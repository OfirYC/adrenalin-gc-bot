import { proto, AnyMessageContent } from "@whiskeysockets/baileys";
import { GetText, Plugin, SendMessage, WAWebsocket } from "../types";
import { containsTrigger } from "../utils";

const ADRENALIN_GC_ID = "120363024375490421@g.us";

const ADRENALIN_ADMINS_IDS = new Set([
  "972532200486@s.whatsapp.net",
  "972525300584@s.whatsapp.net",
  "972502228097@s.whatsapp.net",
  "972583656560@s.whatsapp.net",
  "972559727617@s.whatsapp.net",
]);

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

    const sender = key.participant;

    if (!sender) {
      console.error("NO SENDER", key, message);
      return;
    }

    try {
      const grp = await this.socket.groupMetadata(key.remoteJid);

      if (!key.fromMe && grp.id == ADRENALIN_GC_ID && !ADRENALIN_ADMINS_IDS.has(sender)) {
        console.error("Sender unallowed to tag everyone!");
        return;
      } else {
        console.log("SER SER SER")
      }

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
