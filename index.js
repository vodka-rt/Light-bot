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

client.on("clientReady", async () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  // SLASH COMMANDS
  await client.application.commands.set([
    { name: "ping", description: "Ver ping" },
    { name: "user", description: "Ver avatar", options: [{ name: "pessoa", type: 6 }] },
    { name: "coinflip", description: "Cara ou coroa" },
    { name: "ticket", description: "Painel de ticket" }
  ]);
});


// =======================
// 🔹 SLASH COMMANDS (/)
// =======================
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "ping") {
    return i.reply(`🏓 Pong: ${client.ws.ping}ms`);
  }

  if (i.commandName === "user") {
    const user = i.options.getUser("pessoa") || i.user;

    const embed = new EmbedBuilder()
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor("#313338");

    return i.reply({ embeds: [embed] });
  }

  if (i.commandName === "coinflip") {
    const r = Math.random() < 0.5 ? "Cara" : "Coroa";
    return i.reply(`🪙 ${r}`);
  }

  if (i.commandName === "ticket") {
    const botão = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Success)
    );

    return i.reply({
      content: "Clique abaixo:",
      components: [botão]
    });
  }
});


// =======================
// 🔹 PREFIX COMMANDS (?)
// =======================
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).split(" ");
  const cmd = args[0];

  // ping
  if (cmd === "ping") {
    return msg.reply(`🏓 ${client.ws.ping}ms`);
  }

  // say normal
  if (cmd === "say") {
    const canal = msg.mentions.channels.first() || msg.channel;
    const texto = canal === msg.channel
      ? args.slice(1).join(" ")
      : args.slice(2).join(" ");

    canal.send(texto);
  }

  // saybox (embed)
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


// =======================
// 🎫 BOTÃO TICKET
// =======================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

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
      content: `Ticket de ${i.user}`,
      components: [fechar]
    });

    i.reply({ content: "Ticket criado!", ephemeral: true });
  }

  if (i.customId === "fechar") {
    i.channel.delete();
  }
});

client.login(process.env.TOKEN);
