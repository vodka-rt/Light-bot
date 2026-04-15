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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log(`✅ ${client.user.tag} ONLINE`);
});

// ===== XP =====
function xpNeeded(level) {
  return (level + 1) ** 2 * 100;
}

// ===== IA =====
async function perguntarIA(user, pergunta, guildName) {
  if (!user.memory) user.memory = [];

  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-10);

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `
Seu nome é Cappi.

Você é uma IA que conversa como uma pessoa real no Discord.

Regras:
- NÃO invente diálogos
- NÃO faça roleplay
- NÃO repita respostas

Comportamento:
- Amigável, inteligente e natural
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

    user.memory.push({ role: "assistant", content: resposta });

    await user.save();

    return resposta;

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro aqui 😅 tenta de novo";
  }
}

// ===== EVENTO ÚNICO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let user = await User.findOne({ userId: message.author.id });
  if (!user) {
    user = new User({
      userId: message.author.id,
      username: message.author.username
    });
  }

  // XP
  user.xp += 10;
  if (user.xp >= xpNeeded(user.level)) {
    user.level++;
    message.channel.send(`🎉 ${message.author} subiu para o nível ${user.level}!`);
  }

  await user.save();

  // PREFIX
  if (message.content.startsWith("!")) {
    const args = message.content.slice(1).split(" ");
    const cmd = args.shift().toLowerCase();

    if (cmd === "say") return message.channel.send(args.join(" "));
    if (cmd === "saybox") {
      const embed = new EmbedBuilder().setDescription(args.join(" "));
      return message.channel.send({ embeds: [embed] });
    }

    return;
  }

  // IA por menção
  if (message.mentions.users.has(client.user.id)) {
    const pergunta = message.content.replace(/<@!?\\d+>/g, "").trim();
    if (!pergunta) return message.reply("fala aí 😅");

    const resposta = await perguntarIA(user, pergunta, message.guild.name);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setAuthor({
        name: "💬 Cappi",
        iconURL: client.user.displayAvatarURL()
      })
      .setDescription(resposta.slice(0, 4096));

    return message.reply({ embeds: [embed] });
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // IA
  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");
    await interaction.deferReply();

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) {
      user = new User({
        userId: interaction.user.id,
        username: interaction.user.username
      });
    }

    const resposta = await perguntarIA(user, pergunta, interaction.guild.name);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setAuthor({ name: "💬 Cappi" })
      .setDescription(resposta);

    return interaction.editReply({ embeds: [embed] });
  }

  // PROFILE
  if (interaction.commandName === "profile") {
    let user = await User.findOne({ userId: interaction.user.id }) || { xp: 0, level: 0 };
    return interaction.reply(`📊 Nível: ${user.level} | XP: ${user.xp}`);
  }

  // RANK
  if (interaction.commandName === "rank") {
    const users = await User.find().sort({ xp: -1 }).limit(10);

    let desc = users.map((u, i) => `#${i + 1} <@${u.userId}> - ${u.xp} XP`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Ranking")
      .setDescription(desc);

    return interaction.reply({ embeds: [embed] });
  }

  // USER
  if (interaction.commandName === "user") {
    const target = interaction.options.getUser("usuario") || interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(target.username)
      .setThumbnail(target.displayAvatarURL({ size: 1024 }));

    return interaction.reply({ embeds: [embed] });
  }

  // BANNER
  if (interaction.commandName === "banner") {
    const target = interaction.options.getUser("usuario") || interaction.user;

    const user = await client.users.fetch(target.id, { force: true });
    const banner = user.bannerURL({ size: 1024 });

    if (!banner) return interaction.reply("❌ Esse usuário não tem banner.");

    const embed = new EmbedBuilder().setImage(banner);

    return interaction.reply({ embeds: [embed] });
  }
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Conversar com a Cappi")
    .addStringOption(o => o.setName("pergunta").setDescription("Fale algo").setRequired(true)),

  new SlashCommandBuilder().setName("profile").setDescription("Ver perfil"),
  new SlashCommandBuilder().setName("rank").setDescription("Ranking"),
  new SlashCommandBuilder()
    .setName("user")
    .setDescription("Ver usuário")
    .addUserOption(o => o.setName("usuario").setDescription("Escolha")),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner")
    .addUserOption(o => o.setName("usuario").setDescription("Escolha"))
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
