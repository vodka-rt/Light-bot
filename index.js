// ===== PROTEÇÃO GLOBAL (1 processo) =====
if (global.__botRunning) {
  console.log("Já está rodando, encerrando duplicado");
  process.exit(0);
}
global.__botRunning = true;

const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const axios = require("axios");

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== BANCO =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo OK"))
  .catch(e => console.log("Erro Mongo:", e.message));

// ===== MODELS =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: { type: Array, default: [] }
}));

// 🔒 LOCK DISTRIBUÍDO (funciona mesmo com 2 instâncias)
const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== MODELOS ESTÁVEIS =====
const MODELS = [
  "openai/gpt-3.5-turbo" // funciona sempre (precisa crédito)
];

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const system = {
    role: "system",
    content: "Responda em português, natural, curto (1–2 frases)."
  };

  user.messages.push({ role: "user", content: pergunta });

  // limita histórico
  if (user.messages.length > 8) {
    user.messages = user.messages.slice(-8);
  }

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODELS[0],
        max_tokens: 120,
        messages: [system, ...user.messages]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const reply = res.data?.choices?.[0]?.message?.content || null;

    if (!reply) return "Não consegui responder agora.";

    user.messages.push({ role: "assistant", content: reply });
    await user.save();

    return reply;

  } catch (err) {
    console.log("Erro IA:", err.response?.data || err.message);
    return "Não consegui responder agora.";
  }
}

// ===== READY =====
client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔒 LOCK (se outra instância pegou, sai)
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  // 🔥 DEBUG: mostra quem respondeu
  console.log("Processando mensagem:", message.id);

  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    // 🔥 ENVIO ÚNICO
    await message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    await message.channel.send("erro");
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
