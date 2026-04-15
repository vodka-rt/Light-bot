const mongoose = require("mongoose");

const guildSchema = new mongoose.Schema({
  guildId: String,
  logChannel: String,
  antiSpam: { type: Boolean, default: false },
  antiRaid: { type: Boolean, default: false }
});

module.exports = mongoose.model("Guild", guildSchema);
