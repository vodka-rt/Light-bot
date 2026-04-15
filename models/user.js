const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: String,
  xp: { type: Number, default: 0 },
  money: { type: Number, default: 1000 }
});

module.exports = mongoose.model("User", userSchema);
