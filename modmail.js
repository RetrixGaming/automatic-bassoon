// modmail.js
const { EmbedBuilder, ChannelType } = require('discord.js');
const { modmailChannelId, logChannelId } = require('./config.json');

const activeTickets = new Map();

async function sendLog(client, embed) {
  const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
  if (logChannel && logChannel.type === ChannelType.GuildText) {
    await logChannel.send({ embeds: [embed] }).catch(err => console.error("Failed to send log:", err));
  } else {
    console.warn(`[WARN] Log channel with ID ${logChannelId} not found or is invalid.`);
  }
}

function getUserIdFromThread(channel) {
  const match = channel.name.match(/\(([^)]+)\)$/);
  return match ? match[1] : null;
}

async function handleModmail(message) {
    const userId = message.author.id;
    const client = message.client;
    const modChannel = await client.channels.fetch(modmailChannelId).catch(() => null);
  
    if (!modChannel || modChannel.type !== ChannelType.GuildText) {
        console.error('Modmail channel not found or invalid.');
        return message.reply('Sorry, modmail is currently unavailable.');
    }

    let thread = activeTickets.has(userId) ? await modChannel.threads.fetch(activeTickets.get(userId)).catch(() => null) : null;

    if (!thread) {
        thread = await modChannel.threads.create({
            name: `Modmail - ${message.author.tag} (${userId})`,
            autoArchiveDuration: 1440,
            reason: 'New modmail ticket'
        });
        activeTickets.set(userId, thread.id);

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('New Modmail Ticket')
            .setDescription(`User: <@${userId}> (${message.author.tag})\nTicket opened.`)
            .setTimestamp();
        await thread.send({ embeds: [welcomeEmbed] });

        await message.reply('Your message has been sent to the moderators. They will reply here soon.');

        const logEmbed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('📫 New Modmail Ticket Opened')
            .setDescription(`Ticket opened by <@${userId}> (${message.author.tag}).`)
            .addFields({ name: 'Thread', value: `<#${thread.id}>` })
            .setTimestamp();
        await sendLog(client, logEmbed);
    }

    const userEmbed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content || '[No text]')
        .setTimestamp();

    await thread.send({
        embeds: [userEmbed],
        files: [...message.attachments.values()]
    }).catch(err => {
        console.error('Failed to send message to thread:', err);
        message.reply('There was an error sending your message.');
    });
}


/**
 * Relays a moderator's reply from a thread to the user.
 * @param {Message} message The message from the moderator in the thread.
 * @param {string|null} contentOverride The content to send, used for the !reply command.
 */
async function handleModReply(message, contentOverride = null) {
  const userId = getUserIdFromThread(message.channel);
  if (!userId) return;

  const user = await message.client.users.fetch(userId).catch(() => null);
  if (!user) return;

  // Use the override if provided (from !reply), otherwise use the raw message content
  const replyContent = contentOverride !== null ? contentOverride : message.content;

  const modEmbed = new EmbedBuilder()
    .setColor('#E74C3C')
    .setAuthor({ name: `Mod: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
    .setDescription(replyContent || '[No text]') // Use the determined content
    .setTimestamp();

  await user.send({
    embeds: [modEmbed],
    files: [...message.attachments.values()]
  }).then(() => {
    message.react('✅').catch(() => {});
  }).catch(() => {
    message.reply('❌ Failed to send reply to user (their DMs may be closed).');
  });
}

async function handleAnonymousReply(message, args) {
  const userId = getUserIdFromThread(message.channel);
  if (!userId) return;

  const user = await message.client.users.fetch(userId).catch(() => null);
  if (!user) return;
  
  const replyContent = args.join(' ');
  if (!replyContent && message.attachments.size === 0) {
    return message.reply('Please provide a message to send.');
  }

  const anonEmbed = new EmbedBuilder()
    .setColor('#7289DA')
    .setAuthor({ name: 'Moderator Reply' })
    .setDescription(replyContent || '[No text]')
    .setTimestamp();

  await user.send({
    embeds: [anonEmbed],
    files: [...message.attachments.values()]
  }).then(() => {
    message.react('✅').catch(() => {});
  }).catch(() => {
    message.reply('❌ Failed to send anonymous reply to user (their DMs may be closed).');
  });
}

async function closeTicket(message, args) {
  const userId = getUserIdFromThread(message.channel);
  if (!userId) return;

  const reason = args.join(' ') || 'No reason provided';
  const closer = message.author;

  const user = await message.client.users.fetch(userId).catch(() => null);
  if (user) {
    const closeEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Modmail Ticket Closed')
      .setDescription(`Your ticket has been closed by the moderation team.\n**Reason:** ${reason}`)
      .setTimestamp();
    await user.send({ embeds: [closeEmbed] }).catch(() => {});
  }

  await message.reply({ content: `🔒 Closing and archiving ticket...` });
  try {
    await message.channel.setLocked(true, `Ticket closed by ${closer.tag}`);
    await message.channel.setArchived(true, `Ticket closed by ${closer.tag}`);
  } catch (err) {
    console.error("Failed to lock/archive thread:", err);
    await message.channel.send("Could not lock or archive the thread, but the ticket is now closed.");
  }
  
  activeTickets.delete(userId);

  const logEmbed = new EmbedBuilder()
    .setColor('#FF4500')
    .setTitle('📫 Modmail Ticket Closed')
    .setDescription(`Ticket for user <@${userId}> (${user ? user.tag : 'Unknown User'}) was closed.`)
    .addFields(
      { name: 'Closed By', value: `<@${closer.id}>`, inline: true },
      { name: 'Reason', value: reason, inline: true }
    )
    .setTimestamp();
  await sendLog(message.client, logEmbed);
}

module.exports = { handleModmail, handleModReply, closeTicket, handleAnonymousReply };