// ===== PROTEÇÃO GLOBAL =====
if (global.__botRunning) {
  console.log("Duplicado detectado, encerrando");
  process.exit(0);
}
global.__botRunning = true;

console.log("PROCESSO:", process.pid);

// ===== IMPORTS =====
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
  .catch(err => console.log("Erro Mongo:", err.message));

// ===== MODEL MEMÓRIA =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: { type: Array, default: [] }
}));

// ===== LOCK (ANTI DUPLICAÇÃO GLOBAL) =====
const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== MODELO =====
const MODEL = "openai/gpt-3.5-turbo";

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const systemPrompt = {
    role: "system",
    content: `
Você é Cappie.

REGRAS:
- Fale em português
- Respostas curtas (máx 2 frases)
- Natural e leve
- Não repita frases

EMOJIS (use às vezes, no máximo 1):
<:OguriSmile:1496200764153139401>
<:OguriUpset:1496200839423856651>
<:OguriBless:1496200908952965321>
<:OguriAnxious:1496200706841907423>
<:OguriAnnoyed:1496200280314744842>
<:OguriMunch:1496200598318743674>

NUNCA escreva :emoji:
`
  };

  user.messages.push({ role: "user", content: pergunta });

  if (user.messages.length > 10) {
    user.messages = user.messages.slice(-10);
  }

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        max_tokens: 120,
        messages: [systemPrompt, ...user.messages]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let reply = res.data?.choices?.[0]?.message?.content;

    if (!reply) return "Não consegui responder agora.";

    // remove emoji quebrado
    reply = reply.replace(/<:.*?:>/g, "");

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

  // 🔒 trava duplicação global
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  // 🚫 ignora everyone, here, cargos
  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;

  // 👇 só responde se marcar o bot
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    return message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    return message.channel.send("erro");
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
