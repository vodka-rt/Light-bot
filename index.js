const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

require("./database");

const User = require("./models/user");
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
// 💰 COMANDOS
// =================
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix)) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args[0];

  let user = await User.findOne({ userId: msg.author.id });

  // saldo
  if (cmd === "saldo") {
    return msg.reply(`💰 ${user.money}`);
  }

  // daily
  if (cmd === "daily") {
    user.money += 500;
    await user.save();
    msg.reply("💸 Você ganhou 500!");
  }

  // cassino
  if (cmd === "bet") {
    const valor = parseInt(args[1]);

    if (Math.random() < 0.5) {
      user.money += valor;
      msg.reply("🎰 Você ganhou!");
    } else {
      user.money -= valor;
      msg.reply("💀 Você perdeu!");
    }

    await user.save();
  }

  // giveaway
  if (cmd === "giveaway") {
    const tempo = parseInt(args[1]) * 1000;
    const premio = args.slice(2).join(" ");

    const botão = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("giveaway")
        .setLabel("🎉 Participar")
        .setStyle(ButtonStyle.Primary)
    );

    const msgGive = await msg.channel.send({
      content: `🎉 **${premio}**`,
      components: [botão]
    });

    await Giveaway.create({
      messageId: msgGive.id,
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

  if (i.customId === "giveaway") {
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
      const winner = g.users[Math.floor(Math.random() * g.users.length)];

      canal.send(`🎉 Vencedor: <@${winner}> | Prêmio: ${g.prize}`);

      await g.deleteOne();
    }
  }
}, 5000);


client.login(process.env.TOKEN);
