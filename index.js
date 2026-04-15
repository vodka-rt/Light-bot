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

// ===== IA SIMPLES (SEM MEMÓRIA) =====
async function perguntarIA(pergunta) {
  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.5,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: `
Você é Cappi.

REGRAS:
- responda em português
- seja natural e direta
- não repita frases
- não mude de assunto
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

    let resposta = res.data?.choices?.[0]?.message?.content || "...";
    return resposta.trim();

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro 😅";
  }
}

// ===== PREFIX COMMANDS (!say / !saybox) =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== !say =====
  if (message.content.startsWith("!say ")) {
    const texto = message.content.slice(5);
    if (!texto) return;

    await message.delete().catch(() => {});
    return message.channel.send(texto);
  }

  // ===== !saybox =====
  if (message.content.startsWith("!saybox ")) {
    const texto = message.content.slice(8);
    if (!texto) return;

    await message.delete().catch(() => {});

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#5865F2")
          .setDescription(texto)
      ]
    });
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ===== IA =====
  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");
    if (!pergunta) return;

    try {
      await interaction.deferReply();

      const resposta = await perguntarIA(pergunta);

      return interaction.editReply({
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

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "deu erro 😅",
        ephemeral: true
      });
    }
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
