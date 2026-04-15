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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "?";

// 🔴 COLOCA AQUI O ID DO CANAL DE LOG
const LOG_CHANNEL = "COLOQUE_ID_AQUI";

// banco simples (memória)
let xp = {};


// =================
// 🚀 BOT ONLINE
// =================
client.on("clientReady", async () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  await client.application.commands.set([
    { name: "rank", description: "Ver seu nível" },
    { name: "ticket", description: "Abrir painel de ticket" }
  ]);
});


// =================
// 🆙 XP SYSTEM
// =================
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (!xp[msg.author.id]) xp[msg.author.id] = 0;

  xp[msg.author.id] += 10;

  let level = Math.floor(xp[msg.author.id] / 100);

  if (xp[msg.author.id] % 100 === 0) {
    msg.channel.send(`🎉 ${msg.author} subiu para nível ${level}!`);
  }
});


// =================
// 📜 LOGS
// =================

// mensagem deletada
client.on("messageDelete", async (msg) => {
  const canal = msg.guild.channels.cache.get(LOG_CHANNEL);
  if (!canal || !msg.content) return;

  canal.send(`🗑️ Mensagem apagada: ${msg.content}`);
});

// mensagem editada
client.on("messageUpdate", async (oldMsg, newMsg) => {
  const canal = oldMsg.guild.channels.cache.get(LOG_CHANNEL);
  if (!canal) return;

  canal.send(`✏️ Editada:\nAntes: ${oldMsg.content}\nDepois: ${newMsg.content}`);
});

// ban
client.on("guildMemberRemove", async (member) => {
  const canal = member.guild.channels.cache.get(LOG_CHANNEL);
  if (!canal) return;

  canal.send(`👋 ${member.user.tag} saiu ou foi banido`);
});


// =================
// 🎮 PREFIX COMMANDS
// =================
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args[0];

  // rank
  if (cmd === "rank") {
    const userXP = xp[msg.author.id] || 0;
    const level = Math.floor(userXP / 100);

    return msg.reply(`🆙 Nível: ${level}\nXP: ${userXP}`);
  }
});


// =================
// 🎫 SLASH + TICKET
// =================
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "rank") {
      const userXP = xp[i.user.id] || 0;
      const level = Math.floor(userXP / 100);

      return i.reply(`🆙 Nível: ${level}\nXP: ${userXP}`);
    }

    if (i.commandName === "ticket") {
      const botão = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket")
          .setLabel("🎫 Abrir Ticket")
          .setStyle(ButtonStyle.Success)
      );

      return i.reply({
        content: "Clique abaixo para abrir ticket",
        components: [botão]
      });
    }
  }

  // botão ticket
  if (i.isButton()) {

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

    if (i.customId === "fechar") {
      i.channel.delete();
    }
  }
});

client.login(process.env.TOKEN);
