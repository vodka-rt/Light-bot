const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🟢 Banco conectado");
  } catch (err) {
    console.log("🔴 Erro MongoDB:", err);
  }
}

module.exports = connectDB;
