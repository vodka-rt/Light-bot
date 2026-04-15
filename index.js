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
    activities: [{ name: "Sistema de XP 🔥" }],
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

    const embed = new EmbedBuilder()
      .setColor("#00ff88")
      .setDescription(`🎉 ${message.author} subiu para o nível **${user.level}**!`);

    message.channel.send({ embeds: [embed] });
  }

  await user.save();
});

// ===== PREFIX COMMANDS =====
const prefixes = ["!", "?"];

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = prefixes.find(p => message.content.startsWith(p));
  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(" ");
  const command = args.shift().toLowerCase();

  let user = await User.findOne({ userId: message.author.id }) || { xp: 0, level: 0 };

  if (command === "profile") {
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`👤 ${message.author.username}`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📊 Nível", value: `${user.level}`, inline: true },
        { name: "✨ XP", value: `${user.xp} / ${xpNeeded(user.level)}`, inline: true }
      );

    return message.reply({ embeds: [embed] });
  }

  if (command === "rank") {
    const top = await User.find().sort({ xp: -1 }).limit(10);

    let desc = "";

    for (let i = 0; i < top.length; i++) {
      const member = await client.users.fetch(top[i].userId).catch(() => null);
      if (!member) continue;

      desc += `**${i + 1}.** ${member.username} — XP: ${top[i].xp}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🏆 Ranking do Servidor")
      .setDescription(desc || "Sem dados.");

    return message.reply({ embeds: [embed] });
  }

  if (command === "saybox") {
    const text = args.join(" ");
    if (!text) return message.reply("❌ Escreva algo!");

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(text);

    await message.channel.send({ embeds: [embed] });
    message.delete().catch(() => {});
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "profile") {
    const user = await User.findOne({ userId: interaction.user.id }) || { xp: 0, level: 0 };

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`👤 ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📊 Nível", value: `${user.level}`, inline: true },
        { name: "✨ XP", value: `${user.xp} / ${xpNeeded(user.level)}`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "rank") {
    const top = await User.find().sort({ xp: -1 }).limit(10);

    let desc = "";

    for (let i = 0; i < top.length; i++) {
      const member = await client.users.fetch(top[i].userId).catch(() => null);
      if (!member) continue;

      desc += `**${i + 1}.** ${member.username} — XP: ${top[i].xp}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🏆 Ranking do Servidor")
      .setDescription(desc || "Sem dados.");

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "user") {
    const user = interaction.options.getUser("usuario");

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor("#5865F2");

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "banner") {
    const user = interaction.options.getUser("usuario");
    const fetchedUser = await client.users.fetch(user.id, { force: true });

    if (!fetchedUser.banner) {
      return interaction.reply("❌ Esse usuário não tem banner.");
    }

    const bannerURL = fetchedUser.bannerURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Banner de ${user.username}`)
      .setImage(bannerURL)
      .setColor("#5865F2");

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "mute") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const member = interaction.options.getMember("usuario");
    const tempo = interaction.options.getInteger("tempo");

    await member.timeout(tempo * 1000);

    return interaction.reply(`🔇 ${member.user.username} mutado por ${tempo} segundos.`);
  }

  if (commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const member = interaction.options.getMember("usuario");

    await member.ban();

    return interaction.reply(`🔨 ${member.user.username} foi banido.`);
  }
});

// ===== REGISTRO =====
const commands = [
  new SlashCommandBuilder().setName("profile").setDescription("Ver seu perfil"),
  new SlashCommandBuilder().setName("rank").setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("user")
    .setDescription("Ver avatar")
    .addUserOption(o => o.setName("usuario").setRequired(true)),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner")
    .addUserOption(o => o.setName("usuario").setRequired(true)),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mutar usuário")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("tempo").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banir usuário")
    .addUserOption(o => o.setName("usuario").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== START =====
(async () => {
  try {
    await connectDB();

    console.log("🔄 Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados!");

    await client.login(process.env.TOKEN);

  } catch (error) {
    console.error(error);
  }
})();
