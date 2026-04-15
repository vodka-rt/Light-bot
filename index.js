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

const axios = require("axios");
const connectDB = require("./database");

const GUILD_ID = "1489697666203123933";

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONTROLE DUPLICAÇÃO FORTE =====
const processed = new Set();

// ===== READY =====
client.once("clientReady", () => {
  console.log("BOT ONLINE:", process.pid);
});

// ===== IA SIMPLES =====
async function perguntarIA(pergunta) {
  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.3,
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content: `
Você é Cappi.

Responda:
- sempre em português
- de forma curta e clara
- como uma pessoa normal

NÃO:
- repita a pergunta
- use inglês
- invente coisas
`
          },
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

    return res.data?.choices?.[0]?.message?.content?.trim() || "…";

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro 😅 tenta de novo";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // NÃO responder reply
  if (message.reference) return;

  // só se marcar
  if (!message.mentions.users.has(client.user.id)) return;

  // BLOQUEIO ABSOLUTO
  if (processed.has(message.id)) return;
  processed.add(message.id);
  setTimeout(() => processed.delete(message.id), 10000);

  const pergunta = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  if (!pergunta || pergunta.length < 2) return;

  const resposta = await perguntarIA(pergunta);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setAuthor({
          name: "💬 Cappi",
          iconURL: client.user.displayAvatarURL()
        })
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

    const resposta = await perguntarIA(pergunta);

    return interaction.editReply({
      embeds: [new EmbedBuilder().setDescription(resposta)]
    });
  }
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Falar com a Cappi")
    .addStringOption(o =>
      o.setName("pergunta")
        .setDescription("Digite algo")
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

  console.log("Comandos registrados");

  await client.login(process.env.TOKEN);
})();
