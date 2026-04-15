const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");

const connectDB = require("./database");
const mongoose = require("mongoose");
const axios = require("axios");

// ===== CONFIG =====
const GUILD_ID = "1489697666203123933";

// ===== XP =====
function xpNeeded(level) {
  return Math.pow(level + 1, 2) * 100;
}

// ===== MODEL =====
const userSchema = new mongoose.Schema({
  userId: String,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== READY =====
client.once("clientReady", () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  client.user.setPresence({
    activities: [{ name: "IA + XP 🔥" }],
    status: "online"
  });
});

// ===== XP =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let user = await User.findOne({ userId: message.author.id });
  if (!user) user = new User({ userId: message.author.id });

  user.xp += 10;

  if (user.xp >= xpNeeded(user.level)) {
    user.level++;

    message.channel.send(`🎉 ${message.author} subiu para o nível ${user.level}!`);
  }

  await user.save();
});

// ===== PREFIX =====
const prefixes = ["!", "?"];

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = prefixes.find(p => message.content.startsWith(p));
  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(" ");
  const command = args.shift().toLowerCase();

  let user = await User.findOne({ userId: message.author.id }) || { xp: 0, level: 0 };

  // ===== !say =====
  if (command === "say") {
    const text = args.join(" ");
    if (!text) return message.reply("❌ Escreva algo!");
    return message.channel.send(text);
  }

  // ===== !saybox =====
  if (command === "saybox") {
    const text = args.join(" ");
    if (!text) return message.reply("❌ Escreva algo!");

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(text);

    await message.channel.send({ embeds: [embed] });
    message.delete().catch(() => {});
  }

  // ===== !profile =====
  if (command === "profile") {
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`👤 ${message.author.username}`)
      .addFields(
        { name: "Nível", value: `${user.level}`, inline: true },
        { name: "XP", value: `${user.xp}`, inline: true }
      );

    return message.reply({ embeds: [embed] });
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ===== IA =====
  if (commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.reply("🤖 Pensando...");

    try {
      const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: pergunta }]
      }, {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      let resposta = res.data.choices[0].message.content;

      if (resposta.length > 2000) {
        resposta = resposta.slice(0, 1990) + "...";
      }

      await interaction.editReply(resposta);

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro na IA.");
    }
  }

  // ===== PROFILE =====
  if (commandName === "profile") {
    const user = await User.findOne({ userId: interaction.user.id }) || { xp: 0, level: 0 };

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${interaction.user.username}`)
      .addFields(
        { name: "Nível", value: `${user.level}`, inline: true },
        { name: "XP", value: `${user.xp}`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
});

// ===== REGISTRO =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Pergunte para a IA")
    .addStringOption(o =>
      o.setName("pergunta")
        .setDescription("Pergunta")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Ver perfil")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== START =====
(async () => {
  try {
    await connectDB();

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados!");

    await client.login(process.env.TOKEN);

  } catch (err) {
    console.error(err);
  }
})();
