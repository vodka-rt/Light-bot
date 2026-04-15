// ================== IMPORTS ==================
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

require("dotenv").config();

// ================== CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ================== DATABASE (MEMÓRIA) ==================
const db = {
  xp: new Map(),
  money: new Map(),
  logs: new Map(),
  mutes: new Map(),
  tickets: new Map()
};

// ================== FUNÇÕES ==================
function addXP(userId) {
  const current = db.xp.get(userId) || 0;
  db.xp.set(userId, current + 5);
}

function addMoney(userId, amount) {
  const current = db.money.get(userId) || 0;
  db.money.set(userId, current + amount);
}

// ================== SLASH COMMANDS ==================
const commands = [

  // ===== UTIL =====
  new SlashCommandBuilder().setName("ping").setDescription("Ver ping"),
  new SlashCommandBuilder().setName("help").setDescription("Ver comandos"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Ver avatar")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuário").setRequired(false)
    ),

  // ===== SAY =====
  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Falar algo")
    .addStringOption(o =>
      o.setName("texto").setDescription("Mensagem").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("saybox")
    .setDescription("Mensagem em caixa")
    .addStringOption(o =>
      o.setName("texto").setDescription("Mensagem").setRequired(true)
    ),

  // ===== MOD =====
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banir")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickar")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mutar")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuário").setRequired(true)
    ),

  // ===== ECONOMIA =====
  new SlashCommandBuilder().setName("saldo").setDescription("Ver saldo"),
  new SlashCommandBuilder().setName("daily").setDescription("Recompensa diária"),

  new SlashCommandBuilder()
    .setName("give")
    .setDescription("Dar dinheiro")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuário").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("valor").setDescription("Valor").setRequired(true)
    ),

  // ===== DIVERSÃO =====
  new SlashCommandBuilder().setName("coinflip").setDescription("Cara ou coroa"),
  new SlashCommandBuilder().setName("8ball").setDescription("Pergunte algo")
    .addStringOption(o =>
      o.setName("pergunta").setDescription("Pergunta").setRequired(true)
    ),

  // ===== LOG =====
  new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("Definir logs")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  // ===== TICKET =====
  new SlashCommandBuilder().setName("ticket").setDescription("Abrir ticket"),

].map(c => c.toJSON());

// ================== REGISTRAR ==================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("✅ Slash registrados");
})();

// ================== READY ==================
client.once("ready", () => {
  console.log(`🔥 ${client.user.tag} ONLINE`);
});

// ================== SLASH ==================
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  const user = i.options.getUser("user");
  const texto = i.options.getString("texto");
  const valor = i.options.getInteger("valor");

  // ping
  if (i.commandName === "ping")
    return i.reply(`🏓 ${client.ws.ping}ms`);

  // help
  if (i.commandName === "help")
    return i.reply("📜 Use / ou ? comandos");

  // avatar
  if (i.commandName === "avatar") {
    const u = user || i.user;
    return i.reply(u.displayAvatarURL({ size: 512 }));
  }

  // banner
  if (i.commandName === "banner") {
    const u = user || i.user;
    const f = await client.users.fetch(u.id, { force: true });
    return i.reply(f.bannerURL() || "Sem banner");
  }

  // say
  if (i.commandName === "say") return i.reply(texto);

  if (i.commandName === "saybox")
    return i.reply("```" + texto + "```");

  // ban
  if (i.commandName === "ban") {
    if (!i.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return i.reply("❌ Sem permissão");

    await i.guild.members.ban(user.id);
    i.reply("🔨 Banido");
  }

  // kick
  if (i.commandName === "kick") {
    await i.guild.members.kick(user.id);
    i.reply("👢 Kickado");
  }

  // mute
  if (i.commandName === "mute") {
    const member = i.guild.members.cache.get(user.id);
    await member.timeout(60000);
    i.reply("🔇 Mutado por 1 min");
  }

  // economia
  if (i.commandName === "saldo") {
    return i.reply(`💰 ${db.money.get(i.user.id) || 0}`);
  }

  if (i.commandName === "daily") {
    addMoney(i.user.id, 100);
    return i.reply("💰 +100 moedas");
  }

  if (i.commandName === "give") {
    addMoney(user.id, valor);
    return i.reply("💸 Enviado");
  }

  // diversão
  if (i.commandName === "coinflip")
    return i.reply(Math.random() > 0.5 ? "🪙 Cara" : "🪙 Coroa");

  if (i.commandName === "8ball") {
    const respostas = ["Sim", "Não", "Talvez", "Com certeza"];
    return i.reply(respostas[Math.floor(Math.random()*respostas.length)]);
  }

  // logs
  if (i.commandName === "setlog") {
    db.logs.set(i.guild.id, i.options.getChannel("canal").id);
    return i.reply("✅ Logs definidos");
  }

  // ticket
  if (i.commandName === "ticket") {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: 0
    });
    i.reply(`🎟️ ${channel}`);
  }
});

// ================== PREFIXO ==================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  addXP(msg.author.id);

  if (!msg.content.startsWith("?")) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args.shift().toLowerCase();

  // say
  if (cmd === "say")
    msg.channel.send(args.join(" "));

  if (cmd === "saybox")
    msg.channel.send("```" + args.join(" ") + "```");

  if (cmd === "saldo")
    msg.reply(`💰 ${db.money.get(msg.author.id) || 0}`);

  if (cmd === "daily") {
    addMoney(msg.author.id, 100);
    msg.reply("💰 +100");
  }

  if (cmd === "xp")
    msg.reply(`XP: ${db.xp.get(msg.author.id)}`);
});

// ================== LOGIN ==================
client.login(process.env.TOKEN);
