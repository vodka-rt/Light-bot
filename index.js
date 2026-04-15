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

// ===== MEMÓRIA =====
const memory = {};

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
});

// ===== PERSONALIDADE =====
const basePrompt = `
Você é uma pessoa real conversando no Discord.

Você fala em português de forma natural.

Comportamento:
- Sarcástica, confiante e um pouco irritada
- Às vezes se acha melhor que os outros
- Pode zoar levemente o usuário
- Pode reclamar ou demonstrar preguiça
- Não fala como robô
- Não explica demais
- Responde como uma pessoa normal de chat
- Nunca diga que é uma IA
`;

// ===== HUMOR ALEATÓRIO =====
function getMood() {
  const moods = [
    "Você está de bom humor.",
    "Você está irritada hoje.",
    "Você está sem paciência.",
    "Você está sarcástica.",
    "Você está com preguiça."
  ];
  return moods[Math.floor(Math.random() * moods.length)];
}

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  if (!memory[userId]) memory[userId] = [];

  memory[userId].push({ role: "user", content: pergunta });
  memory[userId] = memory[userId].slice(-10);

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        {
          role: "system",
          content: basePrompt + "\n" + getMood()
        },
        ...memory[userId]
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

  memory[userId].push({ role: "assistant", content: resposta });

  return resposta;
}

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

  const args = message.content.slice(1).split(" ");
  const cmd = args.shift().toLowerCase();

  if (cmd === "say") return message.channel.send(args.join(" "));

  if (cmd === "saybox") {
    const embed = new EmbedBuilder().setDescription(args.join(" "));
    return message.channel.send({ embeds: [embed] });
  }
});

// ===== IA POR MENÇÃO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.users.has(client.user.id)) return;

  const pergunta = message.content.replace(/<@!?\\d+>/g, "").trim();
  if (!pergunta) return message.reply("fala direito... 🙄");

  try {
    const resposta = await perguntarIA(message.author.id, pergunta);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setAuthor({ name: "💬 Assistente", iconURL: client.user.displayAvatarURL() })
      .setDescription(resposta.slice(0, 4096))
      .setFooter({ text: message.author.username });

    message.reply({ embeds: [embed] });

  } catch (err) {
    console.error(err.response?.data || err.message);
    message.reply("deu erro... tenta de novo");
  }
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    try {
      const resposta = await perguntarIA(interaction.user.id, pergunta);

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setDescription(resposta.slice(0, 4096));

      interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err.response?.data || err.message);
      interaction.editReply("erro...");
    }
  }
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Conversar com a IA")
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
