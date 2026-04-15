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

// ===== IA =====
async function perguntarIA(user, pergunta) {
  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-10);

  const models = [
    "meta-llama/llama-3-8b-instruct:free",
    "openrouter/auto"
  ];

  for (const model of models) {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: `
Você é uma pessoa real no Discord.

Comportamento:
- Sarcástica, confiante e irritada
- Às vezes se acha superior
- Pode zoar o usuário
- Pode reclamar
- Responde curto e natural
- Nunca diga que é uma IA
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

      let resposta = res.data?.choices?.[0]?.message?.content;
      if (!resposta) continue;

      user.memory.push({ role: "assistant", content: resposta });
      await user.save();

      return resposta;

    } catch (err) {
      console.error("ERRO MODELO:", model, err.response?.data || err.message);
    }
  }

  // fallback
  const fallback = [
    "ah não… bugou aqui 🙄",
    "deu ruim aqui, tenta de novo",
    "travou tudo… tenta outra coisa",
    "não foi culpa minha 😒"
  ];

  return fallback[Math.floor(Math.random() * fallback.length)];
}

// ===== MENÇÃO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.users.has(client.user.id)) return;

  const pergunta = message.content.replace(/<@!?\\d+>/g, "").trim();
  if (!pergunta) return message.reply("fala direito... 🙄");

  let user = await User.findOne({ userId: message.author.id });
  if (!user) user = new User({ userId: message.author.id });

  const resposta = await perguntarIA(user, pergunta);

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: "💬 Assistente",
      iconURL: client.user.displayAvatarURL()
    })
    .setDescription(resposta.slice(0, 4096));

  message.reply({ embeds: [embed] });
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const pergunta = interaction.options.getString("pergunta");

    await interaction.deferReply();

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = new User({ userId: interaction.user.id });

    const resposta = await perguntarIA(user, pergunta);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setDescription(resposta);

    interaction.editReply({ embeds: [embed] });
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
