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

const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: Array
}));

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, messages: [] });

  const systemPrompt = `
Você é um bot de Discord natural e conversacional.

- Fale como uma pessoa normal
- Respostas curtas (1–2 frases)
- Sem emojis
- Não seja robótico
- Continue o contexto da conversa
`;

  user.messages.push({ role: "user", content: pergunta });
  user.messages = user.messages.slice(-6);

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct:free",
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

    const reply = response.data.choices[0].message.content;

    user.messages.push({ role: "assistant", content: reply });
    await user.save();

    return reply;

  } catch (err) {
    console.log("Erro IA:", err.response?.data || err.message);
    return "Não consegui responder agora, tenta de novo.";
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
