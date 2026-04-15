const mongoose = require("../database");

const giveawaySchema = new mongoose.Schema({
  messageId: String,
  channelId: String,
  prize: String,
  winners: Number,
  endAt: Number,
  users: [String]
});

module.exports = mongoose.model("Giveaway", giveawaySchema);
