require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('enviar-panel')
    .setDescription('Envia el panel de creacion de tickets al canal configurado')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('cerrar-ticket')
    .setDescription('Solicita el cierre del ticket actual'),
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(
      process.env.GUILD_ID
        ? 'Comandos registrados en el servidor (GUILD_ID).'
        : 'Comandos registrados globalmente (puede tardar hasta 1 hora en propagarse).'
    );
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
})();
