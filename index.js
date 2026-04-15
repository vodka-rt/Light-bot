const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const axios = require("axios");
const connectDB = require("./database");

const GUILD_ID = "1489697666203123933";

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
const cooldown = new Set();

// ===== IA SIMPLES (SEM MEMÓRIA = SEM BUG) =====
async function perguntarIA(pergunta) {
  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        temperature: 0.4,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `
Seu nome é Cappi.

Você conversa como uma pessoa normal.

REGRAS:
- RESPONDA SEMPRE EM PORTUGUÊS (Brasil)
- NUNCA use inglês
- respostas curtas e claras
- NÃO repita a pergunta
- NÃO invente coisas
- NÃO faça roleplay
- NÃO fale coisas aleatórias

Seja natural.
`
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

    let resposta = res.data?.choices?.[0]?.message?.content || "…";

    // limpa resposta
    resposta = resposta.trim();

    // remove linhas duplicadas
    const linhas = resposta.split("\n");
    resposta = [...new Set(linhas)].join("\n");

    return resposta;

  } catch (err) {
    console.error("ERRO IA:", err.response?.data || err.message);
    return "deu erro aqui 😅 tenta de novo";
  }
}

// ===== EVENTO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // só responde se marcar o bot
  if (!message.mentions.users.has(client.user.id)) return;

  // evita duplicação
  if (cooldown.has(message.author.id)) return;
  cooldown.add(message.author.id);
  setTimeout(() => cooldown.delete(message.author.id), 3000);

  // limpa pergunta
  const pergunta = message.content
    .replace(/<@!?\\d+>/g, "")
    .trim();

  if (!pergunta || pergunta.length < 2) return;

  const resposta = await perguntarIA(pergunta);

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

    const resposta = await perguntarIA(pergunta);

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

  console.log("✅ Comandos registrados");

  await client.login(process.env.TOKEN);
})();
