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

require("./database");

const User = require("./models/user");
const Guild = require("./models/guild");
const Giveaway = require("./models/giveaway");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "?";

// =================
// 💾 LOGS JSON SAFE
// =================
let logs = {};
try {
  const data = fs.readFileSync("logs.json", "utf8");
  logs = data ? JSON.parse(data) : {};
} catch {
  logs = {};
}

function salvarLogs() {
  fs.writeFileSync("logs.json", JSON.stringify(logs, null, 2));
}

// =================
// 🚀 BOT ONLINE
// =================
client.on("clientReady", async () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  await client.application.commands.set([
    { name: "rank", description: "Ver nível" },
    { name: "setlog", description: "Definir canal de logs" },
    { name: "ticket", description: "Ticket" }
  ]);
});

// =================
// 🆙 XP + ECONOMIA
// =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  let user = await User.findOne({ userId: msg.author.id });
  if (!user) user = await User.create({ userId: msg.author.id });

  user.xp += 10;
  await user.save();
});

// =================
// 💬 PREFIX COMMANDS
// =================
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args[0];

  let user = await User.findOne({ userId: msg.author.id });
  let guildData = await Guild.findOne({ guildId: msg.guild.id });

  if (!guildData) guildData = await Guild.create({ guildId: msg.guild.id });

  // 💰 saldo
  if (cmd === "saldo") return msg.reply(`💰 ${user.money}`);

  // 🎁 daily
  if (cmd === "daily") {
    user.money += 500;
    await user.save();
    return msg.reply("💸 +500!");
  }

  // 🎰 cassino
  if (cmd === "bet") {
    const v = parseInt(args[1]);
    if (Math.random() < 0.5) user.money += v;
    else user.money -= v;

    await user.save();
    return msg.reply(`💰 ${user.money}`);
  }

  // 🆙 rank
  if (cmd === "rank") {
    return msg.reply(`XP: ${user.xp}`);
  }

  // 📜 logs
  if (cmd === "setlog") {
    guildData.logChannel = msg.channel.id;
    await guildData.save();
    return msg.reply("✅ Logs definidos");
  }

  // 🛡️ anti spam
  if (cmd === "antispam") {
    guildData.antiSpam = !guildData.antiSpam;
    await guildData.save();
    return msg.reply(`AntiSpam: ${guildData.antiSpam}`);
  }

  // 🚨 anti raid
  if (cmd === "antiraid") {
    guildData.antiRaid = !guildData.antiRaid;
    await guildData.save();
    return msg.reply(`AntiRaid: ${guildData.antiRaid}`);
  }

  // 🎉 giveaway
  if (cmd === "giveaway") {
    const tempo = parseInt(args[1]) * 1000;
    const premio = args.slice(2).join(" ");

    const botão = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("g")
        .setLabel("🎉 Participar")
        .setStyle(ButtonStyle.Primary)
    );

    const m = await msg.channel.send({
      content: `🎉 ${premio}`,
      components: [botão]
    });

    await Giveaway.create({
      messageId: m.id,
      channelId: msg.channel.id,
      prize: premio,
      winners: 1,
      endAt: Date.now() + tempo,
      users: []
    });
  }
});

// =================
// 🎉 BOTÃO GIVEAWAY
// =================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "g") {
    const g = await Giveaway.findOne({ messageId: i.message.id });
    if (!g.users.includes(i.user.id)) {
      g.users.push(i.user.id);
      await g.save();
    }
    i.reply({ content: "Participando!", ephemeral: true });
  }
});

// =================
// ⏱ FINALIZAR GIVEAWAY
// =================
setInterval(async () => {
  const all = await Giveaway.find();

  for (let g of all) {
    if (Date.now() > g.endAt) {
      const canal = await client.channels.fetch(g.channelId);
      const win = g.users[Math.floor(Math.random() * g.users.length)];

      canal.send(`🎉 <@${win}> ganhou ${g.prize}`);
      await g.deleteOne();
    }
  }
}, 5000);

// =================
// 🛡️ ANTI-SPAM
// =================
let spam = {};

client.on("messageCreate", async (msg) => {
  let guildData = await Guild.findOne({ guildId: msg.guild.id });
  if (!guildData || !guildData.antiSpam) return;

  if (!spam[msg.author.id]) spam[msg.author.id] = 0;

  spam[msg.author.id]++;
  setTimeout(() => spam[msg.author.id]--, 3000);

  if (spam[msg.author.id] > 5) {
    msg.delete();
  }
});

// =================
// 🚨 ANTI-RAID
// =================
let joins = 0;

client.on("guildMemberAdd", async (member) => {
  let guildData = await Guild.findOne({ guildId: member.guild.id });
  if (!guildData || !guildData.antiRaid) return;

  joins++;
  setTimeout(() => joins--, 10000);

  if (joins > 5) {
    member.timeout(600000);
  }
});

// =================
// 🎫 TICKET
// =================
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {
    if (i.commandName === "ticket") {

      const botão = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket")
          .setLabel("🎫 Abrir")
          .setStyle(ButtonStyle.Success)
      );

      return i.reply({ content: "Abrir ticket:", components: [botão] });
    }
  }

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

      canal.send(`Ticket de ${i.user}`);
      i.reply({ content: "Criado!", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
