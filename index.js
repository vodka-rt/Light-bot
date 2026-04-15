const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  PermissionsBitField 
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ====== BANCO SIMPLES (MEMÓRIA) ======
const xp = new Map();
let logChannel = null;

// ====== COMANDOS SLASH ======
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ver ping do bot"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Ver avatar de alguém")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Usuário")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner de alguém")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Usuário")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banir usuário")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Usuário para banir")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulsar usuário")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Usuário para expulsar")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Enviar mensagem")
    .addStringOption(option =>
      option.setName("texto")
        .setDescription("Mensagem")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("saybox")
    .setDescription("Mensagem em caixa")
    .addStringOption(option =>
      option.setName("texto")
        .setDescription("Mensagem")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("Definir canal de logs")
    .addChannelOption(option =>
      option.setName("canal")
        .setDescription("Canal de logs")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// ====== REGISTRAR SLASH ======
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados");
  } catch (e) {
    console.error(e);
  }
})();

// ====== BOT ONLINE ======
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} ONLINE`);
});

// ====== SLASH COMMANDS ======
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.options.getUser("user");
  const texto = interaction.options.getString("texto");

  // ping
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong: ${client.ws.ping}ms`);
  }

  // avatar
  if (interaction.commandName === "avatar") {
    const u = user || interaction.user;
    return interaction.reply(u.displayAvatarURL({ size: 512 }));
  }

  // banner
  if (interaction.commandName === "banner") {
    const u = user || interaction.user;
    const fetched = await client.users.fetch(u.id, { force: true });
    return interaction.reply(
      fetched.bannerURL({ size: 512 }) || "Sem banner"
    );
  }

  // ban
  if (interaction.commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply("❌ Sem permissão");

    await interaction.guild.members.ban(user.id);
    interaction.reply(`🔨 ${user.tag} foi banido`);

    if (logChannel)
      logChannel.send(`🔨 BAN: ${user.tag}`);
  }

  // kick
  if (interaction.commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.reply("❌ Sem permissão");

    await interaction.guild.members.kick(user.id);
    interaction.reply(`👢 ${user.tag} expulso`);
  }

  // say
  if (interaction.commandName === "say") {
    interaction.reply(texto);
  }

  // saybox
  if (interaction.commandName === "saybox") {
    interaction.reply("```" + texto + "```");
  }

  // logs
  if (interaction.commandName === "setlog") {
    logChannel = interaction.options.getChannel("canal");
    interaction.reply("✅ Canal de logs definido");
  }
});

// ====== PREFIXO ? ======
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // XP
  xp.set(msg.author.id, (xp.get(msg.author.id) || 0) + 5);

  if (!msg.content.startsWith("?")) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args.shift().toLowerCase();

  // ping
  if (cmd === "ping") {
    msg.reply("🏓 Pong!");
  }

  // say
  if (cmd === "say") {
    msg.channel.send(args.join(" "));
  }

  // saybox
  if (cmd === "saybox") {
    msg.channel.send("```" + args.join(" ") + "```");
  }

  // avatar
  if (cmd === "avatar") {
    const user = msg.mentions.users.first() || msg.author;
    msg.channel.send(user.displayAvatarURL({ size: 512 }));
  }

  // xp
  if (cmd === "xp") {
    msg.reply(`XP: ${xp.get(msg.author.id)}`);
  }
});

client.login(process.env.TOKEN);
