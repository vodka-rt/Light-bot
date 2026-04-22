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

const OWNER_USERNAME = "vodka.wad";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔒 anti duplicação
const processed = new Set();

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

  if (processed.has(message.id)) return;
  processed.add(message.id);
  setTimeout(() => processed.delete(message.id), 5000);

  const isAdmin = message.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );

  const isOwner =
    message.author.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

  if (!isAdmin && !isOwner) return;

  // ===== !say =====
  if (message.content.startsWith("!say ")) {
    const texto = message.content.slice(5).trim();
    if (!texto) return;

    await message.delete().catch(() => {});
    return message.channel.send(texto);
  }

  // ===== !saybox =====
  if (message.content.startsWith("!saybox ")) {
    const texto = message.content.slice(8).trim();
    if (!texto) return;

    const embed = new EmbedBuilder()
      .setDescription(texto)
      .setColor(0x2b2d31);

    await message.delete().catch(() => {});
    return message.channel.send({ embeds: [embed] });
  }

  // ===== !clear =====
  if (message.content.startsWith("!clear ")) {
    const num = parseInt(message.content.split(" ")[1]);

    if (isNaN(num) || num <= 0 || num > 100) {
      return message.reply("Use: !clear 1-100");
    }

    await message.delete().catch(() => {});

    try {
      await message.channel.bulkDelete(num, true);
    } catch (err) {
      console.log("Erro clear:", err);
    }
  }
});

client.login(TOKEN);
