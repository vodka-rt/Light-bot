const mongoose = require("../database");

const guildSchema = new mongoose.Schema({
  guildId: String,

  // canal de logs
  logChannel: String,

  // anti spam
  antiSpam: { type: Boolean, default: false },

  // anti raid
  antiRaid: { type: Boolean, default: false }
});

module.exports = mongoose.model("Guild", guildSchema);
