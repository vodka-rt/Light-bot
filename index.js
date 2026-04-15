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

client.once("clientReady", () => {
  console.log("ONLINE:", client.user.tag);
});

// ===== TRAVA ABSOLUTA =====
let lastMessageId = null;

// ===== IA =====
async function perguntarIA(pergunta) {
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

Responda:
- em português
- curto e direto
- como humano

NÃO:
- repetir frases
- usar inglês
- inventar coisas
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
    return "deu erro 😅";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔥 trava TOTAL
  if (message.id === lastMessageId) return;
  lastMessageId = message.id;

  // 🔥 ignora reply
  if (message.reference) return;

  // 🔥 só responde se marcar
  if (!message.mentions.users.has(client.user.id)) return;

  const pergunta = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  if (!pergunta) return;

  const resposta = await perguntarIA(pergunta);

  return message.channel.send({
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

  await client.login(process.env.TOKEN);
})();
