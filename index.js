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

// ===== MODELS =====
const userSchema = new mongoose.Schema({
  userId: String,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  mood: { type: Number, default: 0 }, // -5 a 5
  relationship: { type: Number, default: 0 }, // -10 a 10
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

// ===== IA =====
async function perguntarIA(user, pergunta) {
  user.memory.push({ role: "user", content: pergunta });
  user.memory = user.memory.slice(-10);

  // HUMOR BASEADO NO RELACIONAMENTO
  let moodText = "normal";

  if (user.relationship < -5) moodText = "você não gosta dessa pessoa";
  else if (user.relationship > 5) moodText = "você gosta dessa pessoa";
  else moodText = "você está neutra";

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-3-8b-instruct:free",
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
- Nunca fala que é IA
- Responde natural e curta

Estado atual:
${moodText}
Relacionamento: ${user.relationship}
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

    user.memory.push({ role: "assistant", content: resposta });

    // ===== ATUALIZA RELAÇÃO =====
    if (pergunta.toLowerCase().includes("idiota")) user.relationship -= 2;
    else user.relationship += 1;

    await user.save();

    return resposta;

  } catch (err) {
    console.error("ERRO REAL:", err.response?.data || err.message);

    return "hm… deu erro aqui. tenta de novo depois.";
  }
}

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
  const cmd = args.shift();

  if (cmd === "say") return message.channel.send(args.join(" "));

  if (cmd === "saybox") {
    const embed = new EmbedBuilder().setDescription(args.join(" "));
    return message.channel.send({ embeds: [embed] });
  }
});

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
    .setDescription(resposta.slice(0, 4096))
    .setFooter({ text: `${message.author.username} | relação: ${user.relationship}` });

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

  await client.login(process.env.TOKEN);
})();
