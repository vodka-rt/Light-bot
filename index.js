const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "?";

// =====================
// 💾 BANCO DE DADOS
// =====================

// logs
let logs = {};
if (fs.existsSync("logs.json")) {
  logs = JSON.parse(fs.readFileSync("logs.json"));
}

// salvar logs
function salvarLogs() {
  fs.writeFileSync("logs.json", JSON.stringify(logs, null, 2));
}

// xp
let xp = {};


// =====================
// 🚀 BOT ONLINE
// =====================
client.on("clientReady", async () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  await client.application.commands.set([

    { name: "rank", description: "Ver nível" },
    { name: "setlog", description: "Definir canal de logs" },
    { name: "ticket", description: "Painel de ticket" },
    { name: "ping", description: "Ver ping" }

  ]);
});


// =====================
// 🆙 XP SYSTEM
// =====================
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (!xp[msg.author.id]) xp[msg.author.id] = 0;

  xp[msg.author.id] += 10;

  let level = Math.floor(xp[msg.author.id] / 100);

  if (xp[msg.author.id] % 100 === 0) {
    msg.channel.send(`🎉 ${msg.author} subiu para nível ${level}!`);
  }
});


// =====================
// 📜 LOGS
// =====================

// apagar mensagem
client.on("messageDelete", async (msg) => {
  if (!msg.guild) return;

  const canal = msg.guild.channels.cache.get(logs[msg.guild.id]);
  if (!canal || !msg.content) return;

  canal.send(`🗑️ Mensagem apagada:\n${msg.content}`);
});

// editar mensagem
client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (!oldMsg.guild) return;

  const canal = oldMsg.guild.channels.cache.get(logs[oldMsg.guild.id]);
  if (!canal) return;

  canal.send(`✏️ Editada:\nAntes: ${oldMsg.content}\nDepois: ${newMsg.content}`);
});

// sair / ban
client.on("guildMemberRemove", async (member) => {
  const canal = member.guild.channels.cache.get(logs[member.guild.id]);
  if (!canal) return;

  canal.send(`👋 ${member.user.tag} saiu ou foi banido`);
});


// =====================
// 💬 PREFIX COMMANDS
// =====================
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args[0];

  // ping
  if (cmd === "ping") {
    return msg.reply(`🏓 ${client.ws.ping}ms`);
  }

  // rank
  if (cmd === "rank") {
    const userXP = xp[msg.author.id] || 0;
    const level = Math.floor(userXP / 100);

    return msg.reply(`🆙 Nível: ${level}\nXP: ${userXP}`);
  }

  // setlog
  if (cmd === "setlog") {
    if (!msg.member.permissions.has("Administrator")) return;

    logs[msg.guild.id] = msg.channel.id;
    salvarLogs();

    return msg.reply("✅ Canal de logs definido!");
  }

  // say
  if (cmd === "say") {
    const canal = msg.mentions.channels.first() || msg.channel;
    const texto = canal === msg.channel
      ? args.slice(1).join(" ")
      : args.slice(2).join(" ");

    canal.send(texto);
  }

  // saybox
  if (cmd === "saybox") {
    const canal = msg.mentions.channels.first() || msg.channel;
    const texto = canal === msg.channel
      ? args.slice(1).join(" ")
      : args.slice(2).join(" ");

    const embed = new EmbedBuilder()
      .setDescription(texto)
      .setColor("#313338");

    canal.send({ embeds: [embed] });
  }
});


// =====================
// ⚡ SLASH COMMANDS
// =====================
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "ping") {
      return i.reply(`🏓 ${client.ws.ping}ms`);
    }

    if (i.commandName === "rank") {
      const userXP = xp[i.user.id] || 0;
      const level = Math.floor(userXP / 100);

      return i.reply(`🆙 Nível: ${level}\nXP: ${userXP}`);
    }

    if (i.commandName === "setlog") {
      if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return i.reply({ content: "Sem permissão!", ephemeral: true });
      }

      logs[i.guild.id] = i.channel.id;
      salvarLogs();

      return i.reply("✅ Canal de logs definido!");
    }

    if (i.commandName === "ticket") {

      const botão = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket")
          .setLabel("🎫 Abrir Ticket")
          .setStyle(ButtonStyle.Success)
      );

      return i.reply({
        content: "Clique abaixo para abrir um ticket",
        components: [botão]
      });
    }
  }

  // =====================
  // 🎫 BOTÕES
  // =====================
  if (i.isButton()) {

    // abrir ticket
    if (i.customId === "ticket") {

      const canal = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel"] }
        ]
      });

      const fechar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fechar")
          .setLabel("🔒 Fechar")
          .setStyle(ButtonStyle.Danger)
      );

      canal.send({
        content: `🎫 Ticket de ${i.user}`,
        components: [fechar]
      });

      i.reply({ content: "Ticket criado!", ephemeral: true });
    }

    // fechar ticket
    if (i.customId === "fechar") {
      i.channel.delete();
    }
  }
});

client.login(process.env.TOKEN);
