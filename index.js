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
  const cmd = args.shift().toLowerCase();

  if (cmd === "say") {
    return message.channel.send(args.join(" "));
  }

  if (cmd === "saybox") {
    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(args.join(" "));

    return message.channel.send({ embeds: [embed] });
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
          model: "mistralai/mistral-7b-instruct:free",
          messages: [
            {
              role: "system",
              content: "Você é uma assistente extremamente inteligente, confiante e levemente arrogante. Você fala sempre em português. Você se acha superior aos outros e demonstra isso com um tom sarcástico e um pouco irritado, mas ainda ajuda corretamente. Nunca mencione APIs ou que é uma IA."
            },
            {
              role: "user",
              content: pergunta
            }
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

      if (!resposta) {
        return interaction.editReply("❌ Nem isso você conseguiu perguntar direito...");
      }

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setAuthor({
          name: "💬 Assistente",
          iconURL: client.user.displayAvatarURL()
        })
        .setDescription(resposta.slice(0, 4096))
        .setFooter({
          text: `Pedido por ${interaction.user.username}`
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err.response?.data || err.message);
      return interaction.editReply("❌ Deu erro... não que você fosse entender mesmo.");
    }
  }

  // ===== PROFILE =====
  if (interaction.commandName === "profile") {
    await interaction.deferReply();

    const user = await User.findOne({ userId: interaction.user.id }) || { xp: 0, level: 0 };

    return interaction.editReply(`Nível: ${user.level} | XP: ${user.xp}`);
  }
});

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Pergunte algo")
    .addStringOption(o =>
      o.setName("pergunta")
        .setDescription("O que você quer perguntar")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Ver seu perfil")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== START =====
(async () => {
  try {
    await connectDB();

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados");

    await client.login(process.env.TOKEN);

  } catch (err) {
    console.error(err);
  }
})();
