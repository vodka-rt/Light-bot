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

// ===== XP =====
function xpNeeded(level) {
  return (level + 1) ** 2 * 100;
}

// ===== MODEL =====
const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 }
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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

  let user = await User.findOne({ userId: message.author.id }) || new User({ userId: message.author.id });

  user.xp += 10;

  if (user.xp >= xpNeeded(user.level)) {
    user.level++;
    message.channel.send(`🎉 ${message.author} subiu para o nível ${user.level}!`);
  }

  await user.save();
});

// ===== PREFIX =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(" ");
  const command = args.shift().toLowerCase();

  if (command === "say") {
    const text = args.join(" ");
    if (!text) return message.reply("❌ Escreva algo!");
    return message.channel.send(text);
  }

  if (command === "saybox") {
    const text = args.join(" ");
    if (!text) return message.reply("❌ Escreva algo!");

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(text);

    return message.channel.send({ embeds: [embed] });
  }

  if (command === "profile") {
    let user = await User.findOne({ userId: message.author.id }) || { xp: 0, level: 0 };
    return message.reply(`Nível: ${user.level} | XP: ${user.xp}`);
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ===== IA =====
  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openrouter/auto",
          messages: [{ role: "user", content: pergunta }]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("IA:", res.data);

      let resposta = res.data?.choices?.[0]?.message?.content;

      if (!resposta) {
        return interaction.editReply("❌ IA não respondeu.");
      }

      if (resposta.length > 2000) {
        resposta = resposta.slice(0, 1990) + "...";
      }

      const embed = new EmbedBuilder()
  .setColor("#2b2d31")
  .setAuthor({
    name: `🤖 IA respondeu para ${interaction.user.username}`,
    iconURL: interaction.user.displayAvatarURL()
  })
  .setDescription(resposta.slice(0, 4096)) // limite do embed
  .setFooter({ text: "IA via OpenRouter" });

await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error("ERRO IA:", err.response?.data || err.message);
      return interaction.editReply("❌ Erro na IA.");
    }
  }

  // ===== PROFILE =====
  if (interaction.commandName === "profile") {
    await interaction.deferReply();

    const user = await User.findOne({ userId: interaction.user.id }) || { xp: 0, level: 0 };

    return interaction.editReply(`Nível: ${user.level} | XP: ${user.xp}`);
  }
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Pergunte algo para a IA")
    .addStringOption(o =>
      o.setName("pergunta")
        .setDescription("Sua pergunta")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Ver seu perfil")
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
