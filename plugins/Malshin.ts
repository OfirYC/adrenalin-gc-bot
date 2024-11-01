import { proto, AnyMessageContent } from "@whiskeysockets/baileys";
import { GetText, Plugin, SendMessage, WAWebsocket } from "../types";
import { containsTrigger } from "../utils";

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
      if (key.fromMe) {
        const censored = censorBlacklistedWords(text, this.#blacklistedWords);
        this.sendMessage(key.remoteJid, { edit: key, text: censored });
      } else {
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
}

function censorBlacklistedWords(str: string, blacklistedWords: string[]) {
  // Create a regex pattern from the blacklisted words
  const pattern = new RegExp(blacklistedWords.join("|"), "gi");

  // Replace matched words with censored versions
  return str.replace(pattern, match => {
    const length = match.length;

    if (length <= 3) {
      // For words with 3 or fewer characters, replace all but the first character
      return "*".repeat(length - 1) + match[length - 1];
    } else {
      // For longer words, replace the middle characters with asterisks
      const firstChar = match[0];
      const lastChar = match[length - 1];
      const middleCensor = "*".repeat(length - 2); // Censor all middle characters
      return `${firstChar}${middleCensor}${lastChar}`;
    }
  });
}
