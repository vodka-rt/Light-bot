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
async function perguntarIA(userId, pergunta, guildName) {
  let user = await User.findOne({ userId });

  if (!user) {
    user = await User.create({
      userId,
      username: "User",
      xp: 0,
      level: 0,
      memory: []
    });
  }

  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-6);

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

Você conversa como uma pessoa real.

REGRAS:
- NÃO repita textos
- NÃO duplique respostas
- NÃO faça roleplay
- NÃO invente diálogos

Seja:
- natural
- amigável
- inteligente
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

    // ===== REMOVE DUPLICAÇÃO =====
    const partes = resposta.split("\n\n");
    resposta = [...new Set(partes)].join("\n\n");

    // ===== ANTI REPETIÇÃO =====
    const ultimaIA = user.memory
      .filter(m => m.role === "assistant")
      .slice(-1)[0]?.content;

    if (resposta === ultimaIA) {
      resposta = "hm… já falei isso 😅 tenta perguntar diferente";
    }

    user.memory.push({ role: "assistant", content: resposta });

    await User.updateOne(
      { userId },
      { $set: { memory: user.memory } }
    );

    return resposta;

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro aqui 😅 tenta de novo";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let user = await User.findOne({ userId: message.author.id });

  if (!user) {
    user = await User.create({
      userId: message.author.id,
      username: message.author.username,
      xp: 0,
      level: 0,
      memory: []
    });
  }

  // ===== XP =====
  let xp = user.xp + 10;
  let level = user.level;

  if (xp >= xpNeeded(level)) {
    level++;
    message.channel.send(`🎉 ${message.author} subiu para o nível ${level}!`);
  }

  await User.updateOne(
    { userId: message.author.id },
    {
      $set: {
        xp,
        level,
        username: message.author.username
      }
    }
  );

  // ===== PREFIX =====
  if (message.content.startsWith("!")) {
    const args = message.content.slice(1).split(" ");
    const cmd = args.shift().toLowerCase();

    if (cmd === "say") return message.channel.send(args.join(" "));
    
    if (cmd === "saybox") {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription(args.join(" "))]
      });
    }

    return;
  }

  // ===== IA =====
  if (message.mentions.users.has(client.user.id)) {
    const pergunta = message.content.replace(/<@!?\\d+>/g, "").trim();

    if (!pergunta) return message.reply("fala aí 😅");

    const resposta = await perguntarIA(
      message.author.id,
      pergunta,
      message.guild.name
    );

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#5865F2")
          .setAuthor({
            name: "💬 Cappi",
            iconURL: client.user.displayAvatarURL()
          })
          .setDescription(resposta.slice(0, 4096))
      ]
    });
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    const resposta = await perguntarIA(
      interaction.user.id,
      pergunta,
      interaction.guild.name
    );

    return interaction.editReply({
      embeds: [new EmbedBuilder().setDescription(resposta)]
    });
  }

  if (interaction.commandName === "profile") {
    const target = interaction.options.getUser("usuario") || interaction.user;

    const user = await User.findOne({ userId: target.id }) || { xp: 0, level: 0 };

    return interaction.reply(
      `📊 ${target.username}\nNível: ${user.level} | XP: ${user.xp}`
    );
  }

  if (interaction.commandName === "rank") {
    const users = await User.find().sort({ xp: -1 }).limit(10);

    const desc = users.map((u, i) =>
      `#${i + 1} <@${u.userId}> - ${u.xp} XP`
    ).join("\n");

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(desc)]
    });
  }

  if (interaction.commandName === "user") {
    const target = interaction.options.getUser("usuario") || interaction.user;

    return interaction.reply({
      embeds: [
        new EmbedBuilder().setImage(
          target.displayAvatarURL({ size: 1024, dynamic: true })
        )
      ]
    });
  }

  if (interaction.commandName === "banner") {
    const target = interaction.options.getUser("usuario") || interaction.user;

    const fetched = await client.users.fetch(target.id, { force: true });
    const banner = fetched.bannerURL({ size: 1024 });

    if (!banner) return interaction.reply("❌ Esse usuário não tem banner.");

    return interaction.reply({
      embeds: [new EmbedBuilder().setImage(banner)]
    });
  }
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Conversar com a Cappi")
    .addStringOption(o =>
      o.setName("pergunta").setDescription("Fale algo").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Ver perfil")
    .addUserOption(o => o.setName("usuario").setDescription("Pessoa")),

  new SlashCommandBuilder().setName("rank").setDescription("Ranking"),

  new SlashCommandBuilder()
    .setName("user")
    .setDescription("Ver foto")
    .addUserOption(o => o.setName("usuario").setDescription("Pessoa")),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner")
    .addUserOption(o => o.setName("usuario").setDescription("Pessoa"))

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
