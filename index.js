const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

console.log("🔥 Bot iniciando...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("clientReady", () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  client.user.setPresence({
    status: "online",
    activities: [{
      name: "Light PvP 🔥",
      type: 0
    }]
  });
});

const prefix = "!";

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  if (!message.member.permissions.has("Administrator")) return;

  const args = message.content.split(" ");
  const comando = args[0];

  // pega canal mencionado (se tiver)
  const canal = message.mentions.channels.first() || message.channel;

  // remove o comando + possível canal
  const texto = canal === message.channel
    ? args.slice(1).join(" ")
    : args.slice(2).join(" ");

  // 🔹 !say → mensagem normal
  if (comando === "!say") {
    if (!texto) return message.reply("Coloca um texto!");

    canal.send(texto);
  }

  // 🔹 !saybox → embed (caixinha)
  if (comando === "!saybox") {
    if (!texto) return message.reply("Coloca um texto!");

    const embed = new EmbedBuilder()
      .setDescription(texto)
      .setColor("#313338");

    canal.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
