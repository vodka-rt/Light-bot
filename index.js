// ===== PROTEÇÃO GLOBAL =====
if (global.botStarted) process.exit();
global.botStarted = true;

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const mongoose = require("mongoose");
const axios = require("axios");
const connectDB = require("./database");

const GUILD_ID = "1489697666203123933";

// ===== MODEL =====
const userSchema = new mongoose.Schema({
  userId: String,
  memory: { type: Array, default: [] }
});

const User = mongoose.model("User", userSchema);

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log("ONLINE:", client.user.tag);
});

// ===== ANTI DUPLICAÇÃO =====
const lastHandled = new Map();

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await User.findOne({ userId });

  if (!user) {
    user = await User.create({ userId, memory: [] });
  }

  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-3);

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.4,
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content: `
Você é Cappi.

REGRAS:
- responder em português
- resposta curta
- NÃO mudar de assunto
- NÃO listar coisas
- NÃO dar exemplos extras
`
          },
          ...user.memory
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let resposta = res.data?.choices?.[0]?.message?.content || "...";
    resposta = resposta.trim();

    // 🔥 REMOVE RESPOSTA DUPLA
    const separadores = ["\n\n", "1.", "Sobre", "Additionally", "Also"];
    for (let sep of separadores) {
      if (resposta.includes(sep)) {
        resposta = resposta.split(sep)[0];
      }
    }

    if (resposta.length > 300) {
      resposta = resposta.slice(0, 300) + "...";
    }

    return resposta;

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro 😅";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (
    !message.mentions.users.has(client.user.id) ||
    message.mentions.users.size > 1
  ) return;

  const key = message.author.id + "_" + message.content;
  const now = Date.now();

  if (lastHandled.has(key)) {
    if (now - lastHandled.get(key) < 4000) return;
  }

  lastHandled.set(key, now);

  const pergunta = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  if (!pergunta) return;

  const resposta = await perguntarIA(message.author.id, pergunta);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setDescription(resposta)
    ]
  });
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    const resposta = await perguntarIA(interaction.user.id, pergunta);

    return interaction.editReply({
      embeds: [new EmbedBuilder().setDescription(resposta)]
    });
  }
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Conversar com a Cappi")
    .addStringOption(o =>
      o.setName("pergunta")
        .setDescription("Pergunta")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== START =====
(async () => {
  await connectDB();

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  await client.login(process.env.TOKEN);
})();
