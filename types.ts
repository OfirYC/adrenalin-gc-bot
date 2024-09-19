import makeWASocket, {
  AnyMessageContent,
  proto,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

export type WAWebsocket = ReturnType<typeof makeWASocket>;
export type AuthState = Awaited<ReturnType<typeof useMultiFileAuthState>>;

export type Message = proto.IWebMessageInfo[];

export type GetText = (key: proto.IMessageKey, msg: proto.IMessage) => string;

export type SendMessage = (
  jid: string,
  content: AnyMessageContent,
  ...args: any
) => void;

export abstract class Plugin {
  abstract process(key: proto.IMessageKey, msg: proto.IMessage): Promise<void>;
  protected socket: WAWebsocket;
  protected getText: GetText;
  protected sendMessage: SendMessage;

  init(socket: WAWebsocket, getText: GetText, sendMessage: SendMessage): void {
    this.socket = socket;
    this.getText = getText;
    this.sendMessage = sendMessage;
  }

  constructor(socket: WAWebsocket, getText: GetText, sendMessage: SendMessage) {
    this.socket = socket;
    this.getText = getText;
    this.sendMessage = sendMessage;
  }
}
