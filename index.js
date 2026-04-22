// ===== PROTEÇÃO GLOBAL =====
if (global.__botRunning) process.exit();
global.__botRunning = true;

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const OWNER_USERNAME = "Vodka.wad";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== ANTI DUPLICAÇÃO =====
const cooldown = new Set();

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Ver perfil")
    .addUserOption(opt =>
      opt.setName("usuario").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner")
    .addUserOption(opt =>
      opt.setName("usuario").setDescription("Usuário").setRequired(false)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Comandos registrados!");
  } catch (err) {
    console.log(err);
  }
})();

// ===== READY =====
client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== SLASH =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.options.getUser("usuario") || interaction.user;

  if (interaction.commandName === "perfil") {
    const embed = new EmbedBuilder()
      .setTitle(`Perfil de ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor(0x2b2d31);

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "banner") {
    const fetched = await client.users.fetch(user.id, { force: true });

    if (!fetched.banner)
      return interaction.reply("Esse usuário não tem banner 😢");

    const embed = new EmbedBuilder()
      .setTitle(`Banner de ${user.username}`)
      .setImage(fetched.bannerURL({ size: 1024 }))
      .setColor(0x2b2d31);

    return interaction.reply({ embeds: [embed] });
  }
});

// ===== MENSAGENS =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🚫 evita duplicação
  if (cooldown.has(message.id)) return;
  cooldown.add(message.id);
  setTimeout(() => cooldown.delete(message.id), 3000);

  const isAdmin = message.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );
  const isOwner = message.author.username === OWNER_USERNAME;

  if (!isAdmin && !isOwner) return;

  // ===== !say =====
  if (message.content.startsWith("!say ")) {
    const texto = message.content.slice(5).trim();
    if (!texto) return;

    try {
      // delay evita bug
      setTimeout(async () => {
        await message.delete().catch(() => {});
      }, 300);

      return message.channel.send(texto);
    } catch (err) {
      console.log("Erro !say:", err);
    }
  }

  // ===== !saybox =====
  if (message.content.startsWith("!saybox ")) {
    const texto = message.content.slice(8).trim();
    if (!texto) return;

    const embed = new EmbedBuilder()
      .setDescription(texto)
      .setColor(0x2b2d31);

    try {
      setTimeout(async () => {
        await message.delete().catch(() => {});
      }, 300);

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.log("Erro !saybox:", err);
    }
  }
});

client.login(TOKEN);
