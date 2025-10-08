// Updated bot.js
// --- Imports ---
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  ChannelType,
  Partials
} = require('discord.js');
require('dotenv').config();
const { prefix } = require('./config.json');
const keepAlive = require('./keep_alive.js'); // Import the keep-alive server

// --- Initialize Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [Partials.Channel]
});

// --- Import Modules ---
const { startGame, handleGuess } = require('./guess.js');
const { startTicTacToe } = require('./ticTacToe.js'); // <-- CORRECTED LINE
const { showBalance, begCoins, startWork, coinFlip, depositCoins, withdrawCoins, addCoins, giveCoins } = require('./currency.js');
const { kickUser, banUser, unbanUser, timeoutUser, clearMessages, setSlowmode } = require('./moderation.js');
const { handleModmail, handleModReply, closeTicket, handleAnonymousReply } = require('./modmail.js');
// ... rest of bot.js

// --- Bot Ready Event ---
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Message Event ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Handle DMs to create/continue a ticket
  if (message.channel.type === ChannelType.DM) {
    return handleModmail(message);
  }

  // Handle prefix-less handlers like the guess game
  if (await handleGuess(message.channel.id, message.author.id, message.content, message)) return;
  
  // FIX: Using message.channel.isThread() for a more reliable check
  const isModmailThread = message.channel.isThread() && message.channel.name.startsWith('Modmail -');

  // Handle intuitive replies in modmail threads (messages without a prefix)
  if (isModmailThread && !message.content.startsWith(prefix)) {
    return handleModReply(message);
  }

  // Handle bot mentions
  if (message.mentions.has(client.user) && !message.content.startsWith(prefix)) {
    return message.channel.send(`👋 Hello! My prefix is \`${prefix}\`. Use \`${prefix}help\` to see my commands.`);
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- COMMAND HANDLER ---
  if (command === 'help') {
    const initialEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📜 Help Menu')
      .setDescription('Select a category below to view the available commands:')
      .setFooter({ text: 'Created by Reaper 🧠 | Interactive Help' })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Choose a category...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🛡️ Moderation').setDescription('Kick, ban, timeout, and more moderation tools').setValue('moderation'),
        new StringSelectMenuOptionBuilder().setLabel('🎯 Games').setDescription('Fun games like Guess the Number and Tic-Tac-Toe').setValue('games'),
        new StringSelectMenuOptionBuilder().setLabel('💰 Economy').setDescription('Manage your coins with beg, work, flip, bank').setValue('economy'),
        new StringSelectMenuOptionBuilder().setLabel('🤖 General').setDescription('Simple fun commands and bot info').setValue('general'),
        new StringSelectMenuOptionBuilder().setLabel('📫 Modmail').setDescription('How to use modmail for support tickets').setValue('modmail')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const helpMessage = await message.channel.send({ embeds: [initialEmbed], components: [row] });

    const collector = helpMessage.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === message.author.id,
      time: 60000
    });

    collector.on('collect', async (interaction) => {
      const selectedValue = interaction.values[0];
      const categoryEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📜 ${selectedValue.charAt(0).toUpperCase() + selectedValue.slice(1)} Commands`)
        .setFooter({ text: 'Created by Reaper 🧠 | Interactive Help' })
        .setTimestamp();

      switch (selectedValue) {
        case 'modmail':
          categoryEmbed.setDescription('Contact moderators privately by DMing the bot.').addFields({ name: 'For Users', value: 'Simply DM this bot with your message to open or continue a ticket.', inline: false }, { name: 'For Moderators', value: `**To Reply:** Simply type in the thread, OR use \`${prefix}reply <message>\`.\n**Anonymous Reply:** \`${prefix}areply <message>\`\n**Close Ticket:** \`${prefix}close [reason]\``, inline: false });
          break;
        case 'moderation':
          categoryEmbed.setDescription('Here are the advanced moderation commands:').addFields({ name: `\`${prefix}kick @user [reason]\``, value: 'Kick a user from the server' }, { name: `\`${prefix}ban @user [reason]\``, value: 'Ban a user (with confirmation)' }, { name: `\`${prefix}unban <userID>\``, value: 'Unban a user by ID' }, { name: `\`${prefix}timeout @user <duration> [reason]\``, value: 'Timeout a user (e.g., 10m, 1h)' }, { name: `\`${prefix}clear <amount> [@user]\``, value: 'Delete up to 100 messages' }, { name: `\`${prefix}slowmode <seconds>\``, value: 'Set slowmode for the channel' });
          break;
        case 'games':
          categoryEmbed.setDescription('Dive into some fun games:').addFields({ name: `\`${prefix}guess\``, value: 'Start a Guess the Number game' }, { name: `\`${prefix}tictoe [@user]\``, value: 'Challenge a friend or the bot to Tic-Tac-Toe' });
          break;
        case 'economy':
           categoryEmbed.setDescription('Earn and manage your coins:').addFields({ name: `\`${prefix}bal\``, value: 'Check your balance and bank' }, { name: `\`${prefix}beg\``, value: 'Beg for coins' }, { name: `\`${prefix}work\``, value: 'Choose a job to work' }, { name: `\`${prefix}coinflip <amount>\` or \`${prefix}cf <amount>\``, value: 'Flip a coin to double or lose your bet' }, { name: `\`${prefix}deposit <amount>\``, value: 'Deposit coins to your bank' }, { name: `\`${prefix}withdraw <amount>\``, value: 'Withdraw coins from your bank' }, { name: `\`${prefix}addcoins [amount]\``, value: 'Owner only: Add coins to yourself' }, { name: `\`${prefix}give @user <amount>\``, value: 'Transfer coins to another user' });
          break;
        case 'general':
          // NOTE: Added new commands to the help menu description for 'general'
          categoryEmbed.setDescription('General bot commands:').addFields({ name: `\`${prefix}ping\``, value: 'Check bot latency' }, { name: `\`${prefix}hi\``, value: 'Get a friendly greeting' }, { name: `\`${prefix}d\``, value: 'A special greeting for a special devil' }, { name: `\`${prefix}v\``, value: 'A special greeting for a certain user' }, { name: `\`${prefix}help\``, value: 'Show this help menu' });
          break;
      }
      await interaction.update({ embeds: [categoryEmbed], components: [row] });
    });
    
    collector.on('end', () => helpMessage.edit({ content: '⏰ Help menu timed out.', embeds: [], components: [] }).catch(() => {}));
  } 
  // --- GENERAL COMMANDS ---
  else if (command === 'ping') {
    const sent = await message.reply('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    sent.edit(`🏓 Pong! Latency: **${latency}ms** | WebSocket: **${client.ws.ping}ms**`);
  } else if (command === 'hi') {
    return message.reply('Hello 👋');
  } 
  // --- NEW CUSTOM REPLY COMMANDS ---
  else if (command === 'd') {
    // Reply for command 'd'
    return message.reply('<@1263004358379966504> is the real devil');
  } else if (command === 'v') {
    // Reply for command 'v'
    return message.reply('<@1195808542628774001> Hello There');
  }
  // --- MODERATION COMMANDS ---
  else if (command === 'kick') {
    return kickUser(message, args);
  } else if (command === 'ban') {
    return banUser(message, args);
  } else if (command === 'unban') {
    return unbanUser(message, args);
  } else if (command === 'timeout') {
    return timeoutUser(message, args);
  } else if (command === 'clear' || command === 'purge') {
    return clearMessages(message, args);
  } else if (command === 'slowmode') {
    return setSlowmode(message, args);
  } 
  // --- ECONOMY & GAME COMMANDS ---
  else if (command === 'guess') {
    return startGame(message.channel.id, message.author.id, message);
  } else if (command === 'tictoe') {
    const opponent = message.mentions.users.first();
    let opponentId = opponent ? opponent.id : 'bot';
    if (opponent && (opponentId === message.author.id || opponent.bot)) {
        return message.reply("You can't play against yourself or other bots!");
    }
    return startTicTacToe(message.channel.id, message.author.id, opponentId, message);
  } else if (command === 'bal') {
    return showBalance(message.author.id, message);
  } else if (command === 'beg') {
    return begCoins(message.author.id, message);
  } else if (command === 'work') {
    return startWork(message.author.id, message);
  } else if (command === 'coinflip' || command === 'cf') {
    return coinFlip(message.author.id, message, args);
  } else if (command === 'deposit') {
    return depositCoins(message.author.id, message, args);
  } else if (command === 'withdraw') {
    return withdrawCoins(message.author.id, message, args);
  } else if (command === 'addcoins') {
    return addCoins(message.author.id, args[0], message);
  } else if (command === 'give') {
    const receiver = message.mentions.users.first();
    if (!receiver) return message.reply('Please mention a user to give coins to.');
    return giveCoins(message.author.id, receiver.id, args[1], message);
  } 
  // --- MODMAIL-ONLY COMMANDS ---
  else if (command === 'reply' && isModmailThread) {
    const replyContent = args.join(' ');
    if (!replyContent && message.attachments.size === 0) {
        return message.reply("Please provide a message to reply with.");
    }
    return handleModReply(message, replyContent);
  } else if (command === 'areply' && isModmailThread) {
    return handleAnonymousReply(message, args);
  } else if (command === 'close' && isModmailThread) {
    return closeTicket(message, args);
  }
  // --- UNKNOWN COMMAND / CONTEXT ERROR ---
  else {
    const modmailCommands = ['reply', 'areply', 'close'];
    if (modmailCommands.includes(command) && !isModmailThread) {
        return message.reply(`The \`${command}\` command can only be used inside a modmail thread.`);
    }
    return message.reply(`❓ Unknown command. Use \`${prefix}help\` for the list of commands.`);
  }
});

// --- Login the Bot ---
keepAlive(); // Start the web server
client.login(process.env.DISCORD_TOKEN);

