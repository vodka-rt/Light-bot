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

const prefixes = ["!", "?"];

// ===== READY =====
client.on("ready", () => {
  console.log(`✅ ${client.user.tag} ONLINE`);
});

// ===== XP =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let user = await User.findOne({ userId: message.author.id });

  if (!user) user = new User({ userId: message.author.id });

  user.xp += 5;

  if (user.xp >= user.level * 100 + 100) {
    user.level++;
    message.channel.send(`🎉 ${message.author} subiu para o nível ${user.level}`);
  }

  await user.save();
});

// ===== PREFIX COMMANDS =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = prefixes.find(p => message.content.startsWith(p));
  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();

  // ping
  if (cmd === "ping") {
    message.reply("🏓 Pong!");
  }

  // say
  if (cmd === "say") {
    const text = args.join(" ");
    message.channel.send(text);
  }

  // saybox
  if (cmd === "saybox") {
    const text = args.join(" ");
    message.channel.send(`\`\`\`\n${text}\n\`\`\``);
  }

  // banner
  if (cmd === "banner") {
    const user = message.mentions.users.first() || message.author;
    const fetched = await client.users.fetch(user.id, { force: true });

    if (fetched.banner) {
      message.channel.send(fetched.bannerURL({ size: 1024 }));
    } else {
      message.reply("❌ Não tem banner");
    }
  }

  // level
  if (cmd === "level") {
    const user = await User.findOne({ userId: message.author.id });
    message.reply(`Nível: ${user.level} | XP: ${user.xp}`);
  }

  // coinflip
  if (cmd === "coinflip") {
    message.reply(Math.random() > 0.5 ? "Cara" : "Coroa");
  }

  // 8ball
  if (cmd === "8ball") {
    const respostas = ["Sim", "Não", "Talvez", "Claro", "Nunca"];
    message.reply(respostas[Math.floor(Math.random() * respostas.length)]);
  }
});

// ===== SLASH COMMANDS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.options.getUser("usuario");

  if (interaction.commandName === "ping") {
    interaction.reply("🏓 Pong!");
  }

  if (interaction.commandName === "avatar") {
    const target = user || interaction.user;
    interaction.reply(target.displayAvatarURL({ size: 1024 }));
  }

  if (interaction.commandName === "banner") {
    const target = user || interaction.user;
    const fetched = await client.users.fetch(target.id, { force: true });

    if (fetched.banner) {
      interaction.reply(fetched.bannerURL({ size: 1024 }));
    } else {
      interaction.reply("❌ Não tem banner");
    }
  }

  if (interaction.commandName === "user") {
    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setImage(user.displayAvatarURL({ size: 1024 }));

    interaction.reply({ embeds: [embed] });
  }
});

// ===== SLASH REGISTRO =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Ping"),
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Ver avatar")
    .addUserOption(o => o.setName("usuario").setDescription("Usuário")),
  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner")
    .addUserOption(o => o.setName("usuario").setDescription("Usuário")),
  new SlashCommandBuilder()
    .setName("user")
    .setDescription("Ver usuário")
    .addUserOption(o => o.setName("usuario").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== START =====
(async () => {
  await connectDB();

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  await client.login(process.env.TOKEN);
})();

// ===== ANTI CRASH =====
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
