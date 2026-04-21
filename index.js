// ===== PROTEÇÃO =====
if (global.__botRunning) process.exit();
global.__botRunning = true;

const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const axios = require("axios");

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

// ===== MODEL COM MEMÓRIA =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: { type: Array, default: [] }
}));

// ===== LOCK =====
const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== MODELOS (SEM FREE BUGADO) =====
const MODELS = [
  "meta-llama/llama-3-8b-instruct",
  "openai/gpt-3.5-turbo"
];

// ===== IA COM MEMÓRIA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const systemPrompt = {
    role: "system",
    content: `
Você é uma garota chamada Cappie.

REGRAS:
- Fale em português
- Resposta curta (1–2 frases)
- Natural, leve e amigável
- Não seja robótica
`
  };

  // adiciona pergunta
  user.messages.push({ role: "user", content: pergunta });

  // limita histórico (importante)
  if (user.messages.length > 10) {
    user.messages = user.messages.slice(-10);
  }

  for (let model of MODELS) {
    try {
      console.log("Tentando:", model);

      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          max_tokens: 120,
          messages: [
            systemPrompt,
            ...user.messages
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      let reply = res.data?.choices?.[0]?.message?.content;
      if (!reply) continue;

      // salva resposta
      user.messages.push({ role: "assistant", content: reply });
      await user.save();

      return reply;

    } catch (err) {
      console.log("Erro modelo:", model);
      if (err.response) console.log(err.response.data);
    }
  }

  return "Tive um probleminha pra responder agora.";
}

// ===== READY =====
client.once("ready", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // lock
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

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
    console.log(err);
    return message.channel.send("erro");
  }
});

client.login(process.env.TOKEN);
