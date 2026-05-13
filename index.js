const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const OpenAI = require("openai");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OWNER_USERNAME = "vodka.idk";

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memories = new Map();

function getMemory(key) {
  if (!memories.has(key)) memories.set(key, []);
  return memories.get(key);
}

const personalidade = `
Você é a Light, uma bot de Discord fofa, gentil, divertida e inteligente.
Você conversa de forma natural, carinhosa e um pouco brincalhona.
Use emojis com moderação.
Você lembra um pouco da conversa recente.
Responda em português do Brasil.
Não diga que é ChatGPT. Você é a Light.
`;

const commands = [
  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Ver a foto de perfil de um usuário")
    .addUserOption(opt =>
      opt.setName("usuario").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver o banner de um usuário")
    .addUserOption(opt =>
      opt.setName("usuario").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Faz a Light enviar uma mensagem")
    .addStringOption(opt =>
      opt.setName("mensagem").setDescription("Mensagem").setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands
    });
    console.log("Comandos registrados!");
  } catch (err) {
    console.log("Erro ao registrar comandos:", err);
  }
})();

client.once("ready", () => {
  console.log(`Light online como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.options.getUser("usuario") || interaction.user;

  if (interaction.commandName === "perfil") {
    const embed = new EmbedBuilder()
      .setTitle(`Foto de perfil de ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor(0xffb6d9);

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "banner") {
    const fetched = await client.users.fetch(user.id, { force: true });

    if (!fetched.banner) {
      return interaction.reply("Esse usuário não tem bannerzinho 😿");
    }

    const embed = new EmbedBuilder()
      .setTitle(`Banner de ${user.username}`)
      .setImage(fetched.bannerURL({ size: 1024 }))
      .setColor(0xffb6d9);

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "say") {
    const isAdmin = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    const isOwner =
      interaction.user.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

    if (!isAdmin && !isOwner) {
      return interaction.reply({
        content: "Só admins ou o vodka.idk podem usar esse comando 😾",
        ephemeral: true
      });
    }

    const mensagem = interaction.options.getString("mensagem");

    await interaction.reply({
      content: "Mensagem enviada pela Light ✨",
      ephemeral: true
    });

    return interaction.channel.send(mensagem);
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!pergunta) {
    return message.reply("Oi oi~ você me chamou? 💕");
  }

  const key = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
  const memory = getMemory(key);

  memory.push({
    role: "user",
    content: `${message.author.username}: ${pergunta}`
  });

  if (memory.length > 10) memory.shift();

  try {
    await message.channel.sendTyping();

    const response = await ai.responses.create({
      model: "gpt-5.5",
      instructions: personalidade,
      input: memory.map(m => `${m.role}: ${m.content}`).join("\n")
    });

    const resposta = response.output_text || "Hmm... não consegui pensar numa resposta 😿";

    memory.push({
      role: "assistant",
      content: resposta
    });

    if (memory.length > 10) memory.shift();

    return message.reply(resposta.slice(0, 1900));
  } catch (err) {
    console.log("Erro IA:", err);
    return message.reply("Ai ai... minha cabecinha travou agora 😿 tenta de novo daqui a pouco.");
  }
});

client.login(TOKEN);
