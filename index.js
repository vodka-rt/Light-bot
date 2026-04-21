if (global.botStarted) process.exit();
global.botStarted = true;

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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo OK"))
  .catch((e) => console.log("Mongo erro:", e.message));

const MODELS = [
  "google/gemma-7b-it:free",
  "mistralai/mistral-7b-instruct:free"
];

async function perguntarIA(pergunta) {
  for (const model of MODELS) {
    try {
      console.log("→ tentando modelo:", model);

      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          max_tokens: 120,
          messages: [
            { role: "system", content: "Responda em português, curto (1–2 frases)." },
            { role: "user", content: pergunta }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );

      const reply = res.data?.choices?.[0]?.message?.content;
      if (reply) return reply;

    } catch (err) {
      console.log("✖ erro no modelo:", model);

      if (err.response) {
        console.log("status:", err.response.status);
        console.log("data:", err.response.data);
      } else {
        console.log("msg:", err.message);
      }
    }
  }

  return null;
}

client.once("ready", () => {
  console.log("Bot online:", client.user.tag);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // teste rápido (sem IA)
  if (message.content === "!ping") {
    return message.channel.send("pong");
  }

  // só responde se for mencionado
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(pergunta);

    if (!resposta) {
      return message.channel.send("IA não respondeu. Verifica a API.");
    }

    await message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    message.channel.send("erro");
  }
});

client.login(process.env.TOKEN);
