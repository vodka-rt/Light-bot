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

// ===== MODELS =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: { type: Array, default: [] }
}));

const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== IA GROQ =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const systemPrompt = {
    role: "system",
    content: `
Você é Cappie, uma garota amigável.

REGRAS:
- Fale em português
- Máx 2 frases
- Seja natural

EMOJIS:
<:OguriSmile:1496200764153139401>
<:OguriUpset:1496200839423856651>
<:OguriBless:1496200908952965321>
<:OguriAnxious:1496200706841907423>
<:OguriAnnoyed:1496200280314744842>
<:OguriMunch:1496200598318743674>

Use no máximo 1 emoji.
`
  };

  user.messages.push({ role: "user", content: pergunta });

  if (user.messages.length > 10) {
    user.messages = user.messages.slice(-10);
  }

  try {
    console.log("Chamando Groq...");

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192", // 🔥 mais estável
        messages: [systemPrompt, ...user.messages],
        max_tokens: 120
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let reply = res.data?.choices?.[0]?.message?.content;

    if (!reply) {
      console.log("Resposta vazia da IA");
      return "Não consegui responder agora.";
    }

    // remove emoji quebrado
    reply = reply.replace(/<:.*?:>/g, "");

    user.messages.push({ role: "assistant", content: reply });
    await user.save();

    return reply;

  } catch (err) {
    console.log("ERRO GROQ COMPLETO:");
    console.log(err.response?.data || err.message);

    return "Tive um probleminha pra responder agora.";
  }
}

// ===== READY =====
client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔒 anti duplicação
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  console.log("Mensagem recebida:", message.content);

  // teste ping
  if (message.content === "!ping") {
    return message.channel.send("pong");
  }

  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;

  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    console.log("Resposta final:", resposta);

    return message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    return message.channel.send("erro");
  }
});

client.login(process.env.TOKEN);
