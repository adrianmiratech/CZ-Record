require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { loadTickets, saveTickets, loadConfig } = require('./storage');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const SELECT_ID = 'ticket_category_select';
const CLOSE_BTN_ID = 'ticket_close';
const CONFIRM_CLOSE_BTN_ID = 'ticket_close_confirm';
const CANCEL_CLOSE_BTN_ID = 'ticket_close_cancel';

function sanitizeName(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20);
}

function buildPanel(config) {
  const embed = new EmbedBuilder()
    .setTitle(config.panel.title)
    .setDescription(config.panel.description)
    .setColor(config.panel.color);

  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder(config.panel.placeholder)
    .addOptions(
      config.categories.map((cat) => ({
        label: cat.label,
        description: cat.description,
        value: cat.id,
        emoji: cat.emoji || undefined,
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);
  return { embeds: [embed], components: [row] };
}

function buildCloseRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_BTN_ID).setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );
}

client.once('clientReady', () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
      await handleCategorySelect(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  } catch (error) {
    console.error('Error manejando la interaccion:', error);
    const payload = { content: 'Ha ocurrido un error inesperado.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

async function handleSlashCommand(interaction) {
  const config = loadConfig();

  if (interaction.commandName === 'enviar-panel') {
    const channel = await interaction.guild.channels.fetch(config.panelChannelId).catch(() => null);
    if (!channel) {
      return interaction.reply({ content: 'No se encontro el canal configurado para el panel.', ephemeral: true });
    }
    await channel.send(buildPanel(config));
    return interaction.reply({ content: `Panel enviado en ${channel}.`, ephemeral: true });
  }

  if (interaction.commandName === 'cerrar-ticket') {
    const tickets = loadTickets();
    const ticket = tickets[interaction.channel.id];
    if (!ticket) {
      return interaction.reply({ content: 'Este canal no es un ticket.', ephemeral: true });
    }
    return requestClose(interaction);
  }
}

async function handleCategorySelect(interaction) {
  const config = loadConfig();
  const categoryKey = interaction.values[0];
  const category = config.categories.find((c) => c.id === categoryKey);

  if (!category) {
    return interaction.reply({ content: 'Esa categoria ya no existe.', ephemeral: true });
  }
  if (!category.categoryId || category.categoryId.startsWith('PON_AQUI')) {
    return interaction.reply({
      content: 'Esta categoria no tiene configurado el ID de la categoria de Discord destino. Avisa a un administrador.',
      ephemeral: true,
    });
  }

  const tickets = loadTickets();
  const existing = Object.entries(tickets).find(
    ([, t]) => t.userId === interaction.user.id && t.categoryKey === categoryKey && t.guildId === interaction.guild.id
  );
  if (existing) {
    const existingChannel = await interaction.guild.channels.fetch(existing[0]).catch(() => null);
    if (existingChannel) {
      return interaction.reply({ content: `Ya tienes un ticket abierto en esta categoria: ${existingChannel}`, ephemeral: true });
    }
    delete tickets[existing[0]];
    saveTickets(tickets);
  }

  await interaction.deferReply({ ephemeral: true });

  const baseName = `ticket-${category.id}-${sanitizeName(interaction.user.username)}`;
  let channelName = baseName;
  let suffix = 2;
  while (interaction.guild.channels.cache.some((c) => c.name === channelName)) {
    channelName = `${baseName}-${suffix}`;
    suffix += 1;
  }

  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
    {
      id: client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
    },
  ];

  for (const roleId of config.supportRoleIds || []) {
    if (!roleId || roleId.startsWith('PON_AQUI')) continue;
    overwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.categoryId,
    topic: `Ticket de ${interaction.user.id} | categoria:${category.id}`,
    permissionOverwrites: overwrites,
  });

  tickets[ticketChannel.id] = {
    userId: interaction.user.id,
    categoryKey: category.id,
    guildId: interaction.guild.id,
    createdAt: Date.now(),
  };
  saveTickets(tickets);

  const embed = new EmbedBuilder()
    .setTitle(`Ticket: ${category.label}`)
    .setDescription(
      `Hola ${interaction.user}, gracias por abrir un ticket en **${category.label}**.\nUn miembro del staff te atendera en breve.\n\nPulsa el boton de abajo cuando el ticket pueda cerrarse.`
    )
    .setColor(config.panel.color);

  await ticketChannel.send({
    content: (config.supportRoleIds || []).filter((r) => r && !r.startsWith('PON_AQUI')).map((r) => `<@&${r}>`).join(' ') || undefined,
    embeds: [embed],
    components: [buildCloseRow()],
  });

  await interaction.editReply({ content: `Tu ticket ha sido creado: ${ticketChannel}` });
}

async function handleButton(interaction) {
  if (interaction.customId === CLOSE_BTN_ID) {
    return requestClose(interaction);
  }
  if (interaction.customId === CONFIRM_CLOSE_BTN_ID) {
    const tickets = loadTickets();
    delete tickets[interaction.channel.id];
    saveTickets(tickets);
    await interaction.update({ content: 'Cerrando ticket en 5 segundos...', components: [] });
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
    return;
  }
  if (interaction.customId === CANCEL_CLOSE_BTN_ID) {
    return interaction.update({ content: 'Cierre cancelado.', components: [] });
  }
}

async function requestClose(interaction) {
  const config = loadConfig();
  const isStaff =
    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    (config.supportRoleIds || []).some((r) => interaction.member.roles.cache.has(r));

  const tickets = loadTickets();
  const ticket = tickets[interaction.channel.id];
  const isOwner = ticket && ticket.userId === interaction.user.id;

  if (!isStaff && !isOwner) {
    return interaction.reply({ content: 'No tienes permiso para cerrar este ticket.', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CONFIRM_CLOSE_BTN_ID).setLabel('Confirmar cierre').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(CANCEL_CLOSE_BTN_ID).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
  );

  const method = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
  return interaction[method]({ content: '¿Seguro que quieres cerrar este ticket?', components: [row] });
}

client.login(process.env.DISCORD_TOKEN);
