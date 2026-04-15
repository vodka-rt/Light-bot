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
  username: String,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  memory: { type: Array, default: [] }
});

const User = mongoose.model("User", userSchema);

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds] // 🔥 NÃO PRECISA MAIS MESSAGE INTENT
});

client.once("clientReady", () => {
  console.log("ONLINE:", client.user.tag);
});

// ===== XP =====
function xpNeeded(level) {
  return (level + 1) ** 2 * 100;
}

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await User.findOne({ userId });

  if (!user) {
    user = await User.create({
      userId,
      username: "User",
      memory: []
    });
  }

  if (pergunta.toLowerCase().includes("reiniciar conversa")) {
    user.memory = [];
    await user.save();
    return "ok, reiniciei a conversa 😄";
  }

  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-4);

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
- português
- resposta curta
- natural
- não repetir
- não mudar de assunto
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

    user.memory.push({ role: "assistant", content: resposta });
    await user.save();

    return resposta;

  } catch (err) {
    console.error(err);
    return "deu erro 😅";
  }
}

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  let user = await User.findOne({ userId: interaction.user.id });

  if (!user) {
    user = await User.create({
      userId: interaction.user.id,
      username: interaction.user.username
    });
  }

  // ===== IA =====
  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    // XP
    user.xp += 10;

    if (user.xp >= xpNeeded(user.level)) {
      user.level++;
      await interaction.followUp(`🎉 Você subiu para o nível ${user.level}!`);
    }

    await user.save();

    const resposta = await perguntarIA(user.userId, pergunta);

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
  }

  // ===== RANK =====
  if (interaction.commandName === "rank") {
    const users = await User.find().sort({ xp: -1 }).limit(10);

    const desc = users.map((u, i) =>
      `#${i + 1} <@${u.userId}> - ${u.xp} XP`
    ).join("\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 Ranking")
          .setDescription(desc)
      ]
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
    ),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Ver ranking do servidor")

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
