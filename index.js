if (global.botStarted) process.exit();
global.botStarted = true;

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const mongoose = require("mongoose");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo OK"))
  .catch(() => {});

// emojis
const EMOJIS = {
  feliz: "<:OguriSmile:1496200764153139401>",
  triste: "<:OguriUpset:1496200839423856651>",
  amor: "<:OguriBless:1496200908952965321>",
  ansiedade: "<:OguriAnxious:1496200706841907423>",
  irritado: "<:OguriAnnoyed:1496200280314744842>",
  comida: "<:OguriMunch:1496200598318743674>"
};

const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: Array,
  lastReply: String
}));

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, messages: [], lastReply: "" });

  // 🔥 RESET FORÇADO (resolve 90% dos bugs)
  user.messages = [];

  const usarEmoji = Math.random() < 0.25;

  const systemPrompt = `
Você é um bot de Discord.

REGRAS:
- Responda apenas em português
- Nunca use inglês
- Respostas curtas (máx 2 frases)
- Não repita frases
- Não invente assunto
- Responda somente o que foi perguntado

EMOJIS:
- feliz: ${EMOJIS.feliz}
- triste: ${EMOJIS.triste}
- amor: ${EMOJIS.amor}
- ansiedade: ${EMOJIS.ansiedade}
- irritado: ${EMOJIS.irritado}
- comida: ${EMOJIS.comida}

${usarEmoji ? "Pode usar 1 emoji se fizer sentido." : "Não use emoji."}
`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        max_tokens: 120,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: pergunta }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let reply = response.data.choices[0].message.content;

    // remove tradução bugada
    if (reply.includes("(") && reply.includes(")")) {
      reply = reply.split("(")[0].trim();
    }

    // 🔥 evita repetir mensagem
    if (reply === user.lastReply) {
      return "Pode reformular? Não entendi direito.";
    }

    user.lastReply = reply;
    await user.save();

    return reply;

  } catch (err) {
    console.log("Erro IA:", err.response?.data || err.message);
    return "Erro ao responder.";
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Falar com IA")
    .addStringOption(o =>
      o.setName("msg").setDescription("Mensagem").setRequired(true)
    )
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deployCommands() {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands.map(c => c.toJSON()) }
  );
}

client.once("clientReady", async () => {
  console.log("Bot online:", client.user.tag);
  await deployCommands();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    let resposta = await perguntarIA(message.author.id, pergunta);

    if (resposta.length > 2000) {
      resposta = resposta.slice(0, 1990);
    }

    message.reply(resposta);

  } catch {
    message.reply("erro");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const msg = interaction.options.getString("msg");

    await interaction.deferReply();

    let resposta = await perguntarIA(interaction.user.id, msg);

    if (resposta.length > 2000) {
      resposta = resposta.slice(0, 1990);
    }

    interaction.editReply(resposta);
  }
});

client.login(process.env.TOKEN);
