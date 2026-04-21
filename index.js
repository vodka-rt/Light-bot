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

// 🔥 SEUS EMOJIS
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
  messages: Array
}));

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, messages: [] });

  // 🎲 chance de usar emoji (30%)
  const usarEmoji = Math.random() < 0.3;

  const emojiRule = usarEmoji
    ? "Você pode usar no máximo 1 emoji se fizer sentido."
    : "Não use emojis nesta resposta.";

  const systemPrompt = `
Você é um bot de Discord natural.

REGRAS:
- Sempre responda em português do Brasil
- Nunca use inglês
- Respostas curtas (1–2 frases)
- Não repita frases nem traduza

EMOJIS DISPONÍVEIS:
- feliz: ${EMOJIS.feliz}
- triste: ${EMOJIS.triste}
- amor: ${EMOJIS.amor}
- ansiedade: ${EMOJIS.ansiedade}
- irritado: ${EMOJIS.irritado}
- comida: ${EMOJIS.comida}

${emojiRule}

COMPORTAMENTO:
- Use emoji só quando fizer sentido
- Nunca force emoji
- Foque na mensagem atual
- Ignore contexto antigo irrelevante
`;

  // 🧼 reset leve de contexto
  if (pergunta.length < 5) {
    user.messages = [];
  }

  user.messages.push({ role: "user", content: pergunta });

  // memória curta
  user.messages = user.messages.slice(-3);

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          ...user.messages
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

    // remove bug de tradução
    if (reply.includes("(") && reply.includes(")")) {
      reply = reply.split("(")[0].trim();
    }

    // salva resposta boa
    if (reply && reply.length < 500) {
      user.messages.push({ role: "assistant", content: reply });
    }

    await user.save();

    return reply;

  } catch (err) {
    console.log("Erro IA:", err.response?.data || err.message);
    return "Não consegui responder agora.";
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
  if (message.mentions.users.size > 1) return;
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
