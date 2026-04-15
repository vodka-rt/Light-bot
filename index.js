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

// ===== CONTROLE ABSOLUTO =====
const processedMessages = new Set();

// ===== READY =====
client.once("clientReady", () => {
  console.log(`✅ ONLINE: ${client.user.tag}`);
});

// ===== IA =====
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
Seu nome é Cappi.

REGRAS:
- Responda SOMENTE em português
- Seja direta e simples
- NÃO repita a pergunta
- NÃO invente coisas
- NÃO use inglês
- NÃO faça roleplay

Responda como uma pessoa normal.
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

    let resposta = res.data?.choices?.[0]?.message?.content || "…";

    resposta = resposta.trim();

    return resposta;

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro 😅 tenta de novo";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  // ❌ ignora bot
  if (message.author.bot) return;

  // ❌ ignora reply
  if (message.reference) return;

  // ❌ ignora se não mencionou
  if (!message.mentions.users.has(client.user.id)) return;

  // 🔥 trava ABSOLUTA
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);

  // limpa depois
  setTimeout(() => processedMessages.delete(message.id), 10000);

  // remove menção
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

  console.log("✅ Comandos registrados");

  await client.login(process.env.TOKEN);
})();
