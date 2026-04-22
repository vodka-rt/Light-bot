// ===== PROTEÇÃO =====
if (global.__botRunning) process.exit();
global.__botRunning = true;

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== READY =====
client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== !say =====
  if (message.content.startsWith("!say ")) {
    const texto = message.content.slice(5).trim();

    if (!texto) return;

    try {
      await message.delete(); // 🧹 apaga mensagem original
      await message.channel.send(texto);
    } catch (err) {
      console.log("Erro !say:", err);
    }
  }

  // ===== !saybox =====
  if (message.content.startsWith("!saybox ")) {
    const texto = message.content.slice(8).trim();

    if (!texto) return;

    const embed = new EmbedBuilder()
      .setDescription(texto)
      .setColor(0x2b2d31);

    try {
      await message.delete(); // 🧹 apaga mensagem original
      await message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.log("Erro !saybox:", err);
    }
  }
});

client.login(process.env.TOKEN);
