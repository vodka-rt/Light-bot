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

    await message.channel.send({ embeds: [embed] });
    message.delete().catch(() => {});
  }

  if (command === "profile") {
    return message.reply(`Nível: ${user.level} | XP: ${user.xp}`);
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ===== IA =====
  if (commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

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
    await interaction.deferReply();

    const user = await User.findOne({ userId: interaction.user.id }) || { xp: 0, level: 0 };

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${interaction.user.username}`)
      .addFields(
        { name: "Nível", value: `${user.level}`, inline: true },
        { name: "XP", value: `${user.xp}`, inline: true }
      );

    return interaction.editReply({ embeds: [embed] });
  }

  // ===== RANK =====
  if (commandName === "rank") {
    await interaction.deferReply();

    const top = await User.find().sort({ xp: -1 }).limit(10);

    let desc = "";

    for (let i = 0; i < top.length; i++) {
      const member = await client.users.fetch(top[i].userId).catch(() => null);
      if (!member) continue;

      desc += `**${i + 1}.** ${member.username} — ${top[i].xp} XP\n`;
    }

    return interaction.editReply(desc || "Sem dados.");
  }

  // ===== USER =====
  if (commandName === "user") {
    await interaction.deferReply();

    const user = interaction.options.getUser("usuario");

    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setImage(user.displayAvatarURL({ size: 1024 }));

    return interaction.editReply({ embeds: [embed] });
  }

  // ===== BANNER =====
  if (commandName === "banner") {
    await interaction.deferReply();

    const user = interaction.options.getUser("usuario");
    const fetchedUser = await client.users.fetch(user.id, { force: true });

    if (!fetchedUser.banner) {
      return interaction.editReply("❌ Sem banner.");
    }

    return interaction.editReply(fetchedUser.bannerURL({ size: 1024 }));
  }

  // ===== MUTE =====
  if (commandName === "mute") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    await interaction.deferReply();

    const member = interaction.options.getMember("usuario");
    const tempo = interaction.options.getInteger("tempo");

    await member.timeout(tempo * 1000);

    return interaction.editReply(`🔇 Mutado.`);
  }

  // ===== BAN =====
  if (commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    await interaction.deferReply();

    const member = interaction.options.getMember("usuario");

    await member.ban();

    return interaction.editReply(`🔨 Banido.`);
  }
});

// ===== REGISTER =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Pergunte para a IA")
    .addStringOption(o => o.setName("pergunta").setRequired(true)),

  new SlashCommandBuilder().setName("profile").setDescription("Perfil"),
  new SlashCommandBuilder().setName("rank").setDescription("Ranking"),

  new SlashCommandBuilder()
    .setName("user")
    .addUserOption(o => o.setName("usuario").setRequired(true)),

  new SlashCommandBuilder()
    .setName("banner")
    .addUserOption(o => o.setName("usuario").setRequired(true)),

  new SlashCommandBuilder()
    .setName("mute")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("tempo").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .addUserOption(o => o.setName("usuario").setRequired(true))
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
