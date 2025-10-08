const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { logChannelId } = require('./config.json');

// --- Helper: Send Log to Channel ---
async function sendLog(guild, embed) {
  const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
  if (logChannel) {
    logChannel.send({ embeds: [embed] });
  } else {
    console.warn(`[WARN] Log channel with ID ${logChannelId} not found.`);
  }
}

// --- Helper: Parse Duration ---
function parseDurationToMs(durationString) {
  if (!durationString) return null;
  const unit = durationString.slice(-1).toLowerCase();
  const amount = parseInt(durationString.slice(0, -1));
  if (isNaN(amount)) return null;

  switch (unit) {
    case 's': return amount * 1000;
    case 'm': return amount * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    case 'd': return amount * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// --- Command: Kick ---
async function kickUser(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    return message.reply('🚫 You do not have permission to kick members.');
  }

  const target = message.mentions.members.first();
  if (!target) return message.reply('Please mention the user to kick.');
  if (target.id === message.author.id) return message.reply('You cannot kick yourself.');
  if (!target.kickable) return message.reply('I cannot kick this user. They may have a higher role than me.');

  const reason = args.slice(1).join(' ') || 'No reason provided';

  // --- DM Notification ---
  const dmEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('You have been kicked')
    .addFields(
      { name: 'Server', value: message.guild.name },
      { name: 'Reason', value: reason }
    )
    .setTimestamp();

  await target.send({ embeds: [dmEmbed] }).catch(() => console.log("Could not DM the user."));

  // --- Perform Kick ---
  await target.kick(reason);

  const kickEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('👢 User Kicked')
    .setDescription(`**${target.user.tag}** has been kicked.`)
    .addFields(
      { name: 'Moderator', value: `<@${message.author.id}>`, inline: true },
      { name: 'Reason', value: reason, inline: true }
    )
    .setTimestamp();
  
  message.channel.send({ embeds: [kickEmbed] });
  sendLog(message.guild, kickEmbed);
}

// --- Command: Ban ---
async function banUser(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    return message.reply('🚫 You do not have permission to ban members.');
  }
  const target = message.mentions.members.first();
  if (!target) return message.reply('Please mention the user to ban.');
  if (target.id === message.author.id) return message.reply('You cannot ban yourself.');
  if (!target.bannable) return message.reply('I cannot ban this user. They may have a higher role than me.');

  const reason = args.slice(1).join(' ') || 'No reason provided';

  // --- Interactive Confirmation ---
  const confirmationEmbed = new EmbedBuilder()
    .setColor('#FF4500')
    .setTitle('Ban Confirmation')
    .setDescription(`Are you sure you want to ban **${target.user.tag}** for the reason: *${reason}*?`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm_ban').setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cancel_ban').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );

  const confirmationMessage = await message.channel.send({ embeds: [confirmationEmbed], components: [row] });
  const filter = (interaction) => interaction.user.id === message.author.id;
  
  try {
    const confirmation = await confirmationMessage.awaitMessageComponent({ filter, time: 15_000 });

    if (confirmation.customId === 'confirm_ban') {
      const dmEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('You have been banned')
        .addFields({ name: 'Server', value: message.guild.name }, { name: 'Reason', value: reason })
        .setTimestamp();

      await target.send({ embeds: [dmEmbed] }).catch(() => console.log("Could not DM the user."));
      await target.ban({ reason });

      const banEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 User Banned')
        .setDescription(`**${target.user.tag}** has been banned.`)
        .addFields(
          { name: 'Moderator', value: `<@${message.author.id}>`, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setTimestamp();

      await confirmation.update({ embeds: [banEmbed], components: [] });
      sendLog(message.guild, banEmbed);

    } else if (confirmation.customId === 'cancel_ban') {
      await confirmation.update({ content: 'Ban cancelled.', embeds: [], components: [] });
    }
  } catch (err) {
    await confirmationMessage.edit({ content: 'Confirmation timed out. Ban cancelled.', embeds: [], components: [] });
  }
}

// --- Command: Unban ---
async function unbanUser(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply('🚫 You do not have permission to unban members.');
    }
    const userId = args[0];
    if (!userId) return message.reply('Please provide the User ID of the person to unban.');
    if (!/^\d+$/.test(userId)) return message.reply('Please provide a valid User ID.');
    
    try {
        await message.guild.bans.fetch(userId);
    } catch (error) {
        return message.reply('This user is not banned.');
    }
    
    await message.guild.bans.remove(userId, 'Unbanned by moderator.');
    
    const unbanEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ User Unbanned')
        .setDescription(`User with ID **${userId}** has been unbanned.`)
        .addFields({ name: 'Moderator', value: `<@${message.author.id}>` })
        .setTimestamp();
        
    message.channel.send({ embeds: [unbanEmbed] });
    sendLog(message.guild, unbanEmbed);
}


// --- Command: Timeout ---
async function timeoutUser(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    return message.reply('🚫 You do not have permission to time out members.');
  }

  const target = message.mentions.members.first();
  const durationString = args[1];
  const reason = args.slice(2).join(' ') || 'No reason provided';

  if (!target) return message.reply('Please mention a user to timeout.');
  if (!durationString) return message.reply('Please provide a duration (e.g., `10m`, `1h`, `1d`).');

  const durationMs = parseDurationToMs(durationString);
  if (!durationMs) return message.reply('Invalid duration format. Use `s`, `m`, `h`, or `d`.');
  if (durationMs > 28 * 24 * 60 * 60 * 1000) return message.reply('Timeout duration cannot exceed 28 days.');

  await target.timeout(durationMs, reason);

  const timeoutEmbed = new EmbedBuilder()
    .setColor('#FFFF00')
    .setTitle('🤫 User Timed Out')
    .setDescription(`**${target.user.tag}** has been put in timeout.`)
    .addFields(
      { name: 'Moderator', value: `<@${message.author.id}>`, inline: true },
      { name: 'Duration', value: durationString, inline: true },
      { name: 'Reason', value: reason }
    )
    .setTimestamp();
    
  message.channel.send({ embeds: [timeoutEmbed] });
  sendLog(message.guild, timeoutEmbed);
}

// --- Command: Clear (Purge) ---
async function clearMessages(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return message.reply('🚫 You do not have permission to delete messages.');
  }

  const amount = parseInt(args[0]);
  const target = message.mentions.users.first();

  if (isNaN(amount) || amount <= 0 || amount > 100) {
    return message.reply('Please provide a number of messages to delete (1-100).');
  }

  const messages = await message.channel.messages.fetch({ limit: amount });
  let filteredMessages = messages;
  if (target) {
    filteredMessages = messages.filter(m => m.author.id === target.id);
  }

  await message.channel.bulkDelete(filteredMessages, true);
  
  const purgeEmbed = new EmbedBuilder()
    .setColor('#36393F')
    .setTitle('🧹 Messages Purged')
    .setDescription(`Successfully deleted **${filteredMessages.size}** messages.`)
    .addFields({ name: 'Moderator', value: `<@${message.author.id}>` })
    .setTimestamp();
    
  const reply = await message.channel.send({ embeds: [purgeEmbed] });
  setTimeout(() => reply.delete(), 5000);
  
  // Also log it permanently
  sendLog(message.guild, purgeEmbed.addFields(
    { name: 'Channel', value: message.channel.toString() },
    { name: 'Target User', value: target ? target.tag : 'All' }
  ));
}

// --- Command: Slowmode ---
async function setSlowmode(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return message.reply('🚫 You do not have permission to manage this channel.');
  }
  
  const duration = parseInt(args[0]);
  if (isNaN(duration)) {
    return message.reply('Please provide a valid number of seconds for the slowmode.');
  }
  
  await message.channel.setRateLimitPerUser(duration);
  
  const slowmodeEmbed = new EmbedBuilder()
    .setColor('#4E5D94')
    .setTitle('⏳ Slowmode Updated')
    .setDescription(`This channel's slowmode has been set to **${duration} seconds**.`)
    .addFields({ name: 'Moderator', value: `<@${message.author.id}>` });
    
  message.channel.send({ embeds: [slowmodeEmbed] });
}


module.exports = {
  kickUser,
  banUser,
  unbanUser,
  timeoutUser,
  clearMessages,
  setSlowmode
};