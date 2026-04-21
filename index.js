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

// ===== MODEL =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  lastReply: String
}));

// ===== CONTROLE DE DUPLICAÇÃO =====
const processedMessages = new Set();

// ===== MODELOS =====
const MODELS = [
  "nousresearch/nous-hermes-2-mixtral",
  "openai/gpt-3.5-turbo"
];

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, lastReply: "" });

  const systemPrompt = `
Você é um bot de Discord.

REGRAS:
- Responda em português
- Máx 2 frases
- Seja direto
- Não repita resposta

EMOJIS:
<:OguriSmile:1496200764153139401>
<:OguriUpset:1496200839423856651>
<:OguriBless:1496200908952965321>
<:OguriAnxious:1496200706841907423>
<:OguriAnnoyed:1496200280314744842>
<:OguriMunch:1496200598318743674>

- Use no máximo 1
- Não use sempre
- Nunca escreva :emoji:
`;

  for (let model of MODELS) {
    try {
      console.log("Tentando:", model);

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

      // limpa tradução bugada
      if (reply.includes("(") && reply.includes(")")) {
        reply = reply.split("(")[0].trim();
      }

      // evita repetir
      if (reply === user.lastReply) {
        reply = "Pode reformular?";
      }

      user.lastReply = reply;
      await user.save();

      return reply; // 🔥 PARA AQUI (1 resposta só)

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

// ===== LISTENER ÚNICO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔥 trava duplicação por mensagem
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 10000);

  console.log("Mensagem:", message.content);

  // só responde se marcar o bot
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    console.log("Resposta:", resposta);

    return message.channel.send(resposta); // 🔥 1 envio só

  } catch (err) {
    console.log("ERRO FINAL:", err);
    return message.channel.send("erro");
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
