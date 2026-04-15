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

// ===== BLOQUEIO DUPLICADO =====
const responding = new Set();

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
      xp: 0,
      level: 0,
      memory: []
    });
  }

  const msg = pergunta.toLowerCase();

  // RESET CONVERSA
  const reset = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"];
  if (reset.some(p => msg.includes(p))) {
    user.memory = [];
  }

  user.memory.push({ role: "user", content: pergunta });

  // memória pequena = menos bug
  user.memory = user.memory.slice(-4);

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.5, // 🔥 mais inteligente
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `
Seu nome é Cappi.

Você conversa como uma pessoa normal.

REGRAS:
- SEMPRE em português
- respostas curtas e claras
- NÃO invente coisas
- NÃO fale coisas aleatórias
- NÃO repita respostas
- NÃO repita a pergunta
- ignore contexto antigo se mudar assunto

Fale como humano.
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

    // limpa lixo
    resposta = resposta.trim();

    // remove duplicação
    const partes = resposta.split("\n");
    resposta = [...new Set(partes)].join("\n");

    // evita repetir última resposta
    const ultima = user.memory
      .filter(m => m.role === "assistant")
      .slice(-1)[0]?.content;

    if (resposta === ultima) {
      resposta = "acho que já falei isso 😅 tenta mudar a pergunta";
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

  // evita duplicação
  if (responding.has(message.id)) return;
  responding.add(message.id);
  setTimeout(() => responding.delete(message.id), 5000);

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

  // PREFIX
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

  // IA
  if (message.mentions.users.has(client.user.id)) {
    const pergunta = message.content.replace(/<@!?\\d+>/g, "").trim();

    if (!pergunta || pergunta.length < 2) return;

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
      pergunta
    );

    return interaction.editReply({
      embeds: [new EmbedBuilder().setDescription(resposta)]
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
        .setDescription("Fale algo")
        .setRequired(true)
    )
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
