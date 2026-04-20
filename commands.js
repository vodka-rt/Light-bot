const {
  SlashCommandBuilder
} = require("discord.js");

module.exports = [
  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner do usuário")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Usuário")
    ),

  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Ver perfil do usuário")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Usuário")
    ),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Falar com IA")
    .addStringOption(opt =>
      opt.setName("msg")
        .setDescription("Mensagem")
        .setRequired(true)
    )
];
