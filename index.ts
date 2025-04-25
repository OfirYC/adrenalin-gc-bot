import { Bot, PluginConstructor } from "./Bot";

import { TagEveryone } from "./plugins/TagEveryone";
import { botConfig } from "./config";
import { Malshin } from "./plugins/Malshin";
import { SidreiHagaa } from "./plugins/SidreiHagaa";
import { ILoveYouMore } from "./plugins/Love";
(async () => {
  const authState = await Bot.getAuthState();
  const plugins: PluginConstructor[] = [
    (...args) => new TagEveryone(...args),
    // (...args) => new Malshin(...args),
    (...args) => new SidreiHagaa(...args),
    // (...args) => new ILoveYouMore(...args),
  ];

  const bot = new Bot(authState, plugins, botConfig);
  bot.connect(authState);
  await bot.run(authState);
})();
