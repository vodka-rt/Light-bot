const mongoose = require("mongoose");

async function conectar() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🟢 Banco conectado");
  } catch (err) {
    console.log("❌ Erro no banco:", err);
  }
}

module.exports = conectar;
