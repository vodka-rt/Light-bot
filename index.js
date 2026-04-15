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

// ===== MODELS =====
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

// ===== PREFIXOS =====
const prefixes = ["!", "?"];

// ===== READY =====
client.on("ready", () => {
  console.log(`✅ ${client.user.tag} ONLINE`);
});

// ===== XP SYSTEM =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let user = await User.findOne({ userId: message.author.id });

  if (!user) {
    user = new User({ userId: message.author.id });
  }

  user.xp += 5;

  if (user.xp >= user.level * 100 + 100) {
    user.level++;
    message.channel.send(`🎉 ${message.author} subiu para o nível ${user.level}!`);
  }

  await user.save();
});

// ===== COMANDOS =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = prefixes.find(p => message.content.startsWith(p));
  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(" ");
  const command = args.shift().toLowerCase();

  // ===== !say =====
  if (command === "say") {
    const channel = message.mentions.channels.first() || message.channel;
    const text = args.join(" ");

    if (!text) return message.reply("❌ Escreva algo!");

    channel.send(text);
  }

  // ===== !saybox =====
  if (command === "saybox") {
    const channel = message.mentions.channels.first() || message.channel;
    const text = args.join(" ");

    if (!text) return message.reply("❌ Escreva algo!");

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(`\`\`\`\n${text}\n\`\`\``);

    channel.send({ embeds: [embed] });
  }

  // ===== !level =====
  if (command === "level") {
    const user = await User.findOne({ userId: message.author.id });

    message.reply(`📊 Nível: ${user.level}\nXP: ${user.xp}`);
  }
});

// ===== SLASH COMMAND (/user) =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "user") {
    const user = interaction.options.getUser("usuario");

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }));

    interaction.reply({ embeds: [embed] });
  }
});

// ===== REGISTRAR SLASH =====
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
