const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder,
  REST,
  Routes 
} = require("discord.js");

const connectDB = require("./database");
const mongoose = require("mongoose");

// ===== FUNÇÃO XP =====
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

// ===== PREFIX =====
const prefixes = ["!", "?"];

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} ONLINE`);
});

// ===== MESSAGE =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== XP =====
  let user = await User.findOne({ userId: message.author.id });

  if (!user) user = new User({ userId: message.author.id });

  user.xp += 10; // ganha XP por mensagem

  if (user.xp >= xpNeeded(user.level)) {
    user.level++;

    const embed = new EmbedBuilder()
      .setColor("#00ff88")
      .setDescription(`🎉 ${message.author} subiu para o nível **${user.level}**!`);

    message.channel.send({ embeds: [embed] });
  }

  await user.save();

  // ===== PREFIX =====
  const prefix = prefixes.find(p => message.content.startsWith(p));
  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(" ");
  const command = args.shift().toLowerCase();

  // ===== !say =====
  if (command === "say") {
    const channel = message.mentions.channels.first() || message.channel;
    const text = args.join(" ");

    if (!text) return message.reply("❌ Escreva algo!");

    await channel.send(text);
  }

  // ===== !saybox =====
  if (command === "saybox") {
    const channel = message.mentions.channels.first() || message.channel;
    const text = args.join(" ");

    if (!text) return message.reply("❌ Escreva algo!");

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(text);

    await channel.send({ embeds: [embed] });
    message.delete().catch(() => {});
  }

  // ===== !profile =====
  if (command === "profile") {
    const needed = xpNeeded(user.level);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`👤 ${message.author.username}`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📊 Nível", value: `${user.level}`, inline: true },
        { name: "✨ XP", value: `${user.xp} / ${needed}`, inline: true }
      );

    message.reply({ embeds: [embed] });
  }

  // ===== !rank =====
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

    message.reply({ embeds: [embed] });
  }

  // ===== !level (simples) =====
  if (command === "level") {
    message.reply(`📊 Nível: ${user.level}\nXP: ${user.xp}`);
  }
});

// ===== SLASH (/user) =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "user") {
    const user = interaction.options.getUser("usuario");

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor("#5865F2");

    await interaction.reply({ embeds: [embed] });
  }
});

// ===== SLASH REGISTER =====
const commands = [
  new SlashCommandBuilder()
    .setName("user")
    .setDescription("Ver foto do usuário")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Escolha o usuário")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== START =====
(async () => {
  try {
    await connectDB();

    console.log("🔄 Registrando comandos...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados!");

    await client.login(process.env.TOKEN);

  } catch (error) {
    console.error(error);
  }
})();

// ===== ANTI CRASH =====
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
