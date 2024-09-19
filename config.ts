// Contains the default configuration for Bot & Plugins
// Any attribute not given in the configuration will take its default value

export const botConfig = {
  authFolder: "auth",
  selfReply: false,
  logMessages: true,
};

export const pluginsConfig = {
  mirror: {
    prefix: "!mirror!",
  },
  roles: {
    dataFile: "./roles.json",
    prefix: "!role ",
    updateOnAdd: false,
    updateOnRemove: false,
  },
  tagEveryone: {
    membersLimit: 100,
    trigger: "all",
  },
};
