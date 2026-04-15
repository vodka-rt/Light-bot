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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log("ONLINE:", client.user.tag);
});

// ===== ANTI DUPLICAÇÃO =====
const lastHandled = new Map();

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

  const msg = pergunta.toLowerCase();

  // RESET MANUAL
  if (msg.includes("reiniciar conversa")) {
    user.memory = [];
    await User.updateOne({ userId }, { $set: { memory: [] } });
    return "ok, reiniciei a conversa 😄";
  }

  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-5);

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.5,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `
Você é Cappi.

REGRAS:
- Sempre em português
- Não repetir frases
- Não repetir pergunta
- Não inventar coisas
- Responder de forma natural
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

    // remove duplicação de linhas
    const linhas = resposta.split("\n");
    resposta = [...new Set(linhas)].join("\n");

    const ultima = user.memory
      .filter(m => m.role === "assistant")
      .slice(-1)[0]?.content;

    if (resposta === ultima) {
      resposta = "acho que já falei isso 😅";
    }

    user.memory.push({ role: "assistant", content: resposta });

    await User.updateOne(
      { userId },
      { $set: { memory: user.memory } }
    );

    return resposta;

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro 😅 tenta de novo";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  // ❌ ignora bot
  if (message.author.bot) return;

  // ❌ NÃO responde se tiver mais de 1 menção (resolve o bug)
  if (
    !message.mentions.users.has(client.user.id) ||
    message.mentions.users.size > 1
  ) return;

  // ❌ não responde reply
  if (message.reference) return;

  // ANTI DUPLICAÇÃO
  const key = message.author.id + "_" + message.content;
  const now = Date.now();

  if (lastHandled.has(key)) {
    if (now - lastHandled.get(key) < 4000) return;
  }

  lastHandled.set(key, now);

  let user = await User.findOne({ userId: message.author.id });

  if (!user) {
    user = await User.create({
      userId: message.author.id,
      username: message.author.username
    });
  }

  // XP
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

  const pergunta = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  if (!pergunta) return;

  const resposta = await perguntarIA(
    message.author.id,
    pergunta
  );

  return message.reply({
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
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    const resposta = await perguntarIA(
      interaction.user.id,
      pergunta
    );

    return interaction.editReply({
      embeds: [new EmbedBuilder().setDescription(resposta)]
    });
  }

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
        .setDescription("O que você quer perguntar")
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
