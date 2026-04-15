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

// ===== BLOQUEIO DUPLICADO =====
const processed = new Set();

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await User.findOne({ userId });

  if (!user) {
    user = await User.create({ userId, memory: [] });
  }

  const msg = pergunta.toLowerCase();

  // 🔥 RESET MANUAL
  if (msg.includes("reiniciar conversa")) {
    user.memory = [];
    await User.updateOne({ userId }, { $set: { memory: [] } });
    return "ok, reiniciei a conversa 😄";
  }

  user.memory.push({ role: "user", content: pergunta });

  // memória pequena evita bug
  user.memory = user.memory.slice(-4);

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
Seu nome é Cappi.

REGRAS:
- Sempre responda em português
- Não repita frases
- Não repita a pergunta
- Seja natural
- Seja direta
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

    // 🔥 REMOVE LINHAS REPETIDAS
    const linhas = resposta.split("\n");
    resposta = [...new Set(linhas)].join("\n");

    // 🔥 ANTI REPETIÇÃO TOTAL
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
    return "deu erro 😅 tenta de novo";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // evita loop
  if (message.reference) return;

  // só responde se marcar
  if (!message.mentions.users.has(client.user.id)) return;

  // trava duplicação
  if (processed.has(message.id)) return;
  processed.add(message.id);
  setTimeout(() => processed.delete(message.id), 8000);

  const pergunta = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

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
});

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Falar com a Cappi")
    .addStringOption(o =>
      o.setName("pergunta")
        .setDescription("Digite algo")
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
