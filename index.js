// ===== PROTEÇÃO GLOBAL =====
if (global.__botRunning) {
  console.log("Já está rodando, encerrando duplicado");
  process.exit(0);
}
global.__botRunning = true;

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
  .catch(() => console.log("Erro Mongo"));

// ===== MODELS =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  lastReply: String
}));

// 🔒 LOCK GLOBAL (anti duplicação)
const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== MODELOS CORRETOS =====
const MODELS = [
  "openai/gpt-3.5-turbo",
  "meta-llama/llama-3-8b-instruct"
];

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, lastReply: "" });

  const systemPrompt = `
Você é um bot de Discord natural.

REGRAS:
- Responda em português
- Máx 2 frases
- Seja direto
- Não invente assunto
- Não repita resposta

EMOJIS:
Use SOMENTE:

<:OguriSmile:1496200764153139401>
<:OguriUpset:1496200839423856651>
<:OguriBless:1496200908952965321>
<:OguriAnxious:1496200706841907423>
<:OguriAnnoyed:1496200280314744842>
<:OguriMunch:1496200598318743674>

- Use no máximo 1 emoji
- Não use sempre
- Nunca escreva :emoji:
`;

  for (let model of MODELS) {
    try {
      console.log("Tentando modelo:", model);

      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          max_tokens: 120,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: pergunta }
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

      // remove emoji quebrado
      reply = reply.replace(/<:.*?:>/g, "");

      // evita repetição
      if (reply === user.lastReply) {
        reply = "Pode reformular?";
      }

      user.lastReply = reply;
      await user.save();

      return reply;

    } catch (err) {
      console.log("Erro modelo:", model);

      if (err.response) {
        console.log("DATA:", err.response.data);
      }
    }
  }

  return "Não consegui responder agora.";
}

// ===== READY =====
client.once("ready", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔒 lock Mongo (impede múltiplas respostas)
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  console.log("Mensagem:", message.content);

  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    console.log("Resposta:", resposta);

    await message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    await message.channel.send("erro");
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
