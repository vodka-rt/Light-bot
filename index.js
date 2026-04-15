const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  if (!message.member.permissions.has("Administrator")) return;

  const args = message.content.split(" ");

  if (args[0] === "!say") {
    const canal = message.mentions.channels.first();
    if (!canal) return message.reply("Marca um canal!");

    const texto = args.slice(2).join(" ");

    const embed = new EmbedBuilder()
      .setDescription(texto)
      .setColor("#313338");

    canal.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
