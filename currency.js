// Updated currency.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Temporary in-memory data (resets when bot restarts)
const users = new Map();
const cooldowns = new Map();

// Helper: ensure user entry exists
function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, { balance: 100, bank: 0, lastBeg: 0, lastWork: 0, lastFlip: 0 });
  }
  return users.get(userId);
}

// --- Command: !bal (Updated to show bank too) ---
function showBalance(userId, message) {
  const user = getUser(userId);

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('💰 Your Wallet')
    .addFields(
      { name: '💵 Balance', value: `🪙 ${user.balance} coins`, inline: true },
      { name: '🏦 Bank', value: `🪙 ${user.bank} coins`, inline: true },
      { name: 'Total', value: `🪙 ${user.balance + user.bank} coins`, inline: true }
    )
    .setFooter({ text: 'Keep earning to grow your fortune!' });

  message.channel.send({ embeds: [embed] });
}

// --- Command: !beg (unchanged) ---
function begCoins(userId, message) {
  const user = getUser(userId);
  const now = Date.now();
  const cooldown = 30 * 1000; // 30 seconds cooldown

  if (now - user.lastBeg < cooldown) {
    const remaining = Math.ceil((cooldown - (now - user.lastBeg)) / 1000);
    return message.reply(`⏳ You must wait **${remaining}s** before begging again.`);
  }

  const amount = Math.floor(Math.random() * 50) + 1; // 1–50 coins
  user.balance += amount;
  user.lastBeg = now;

  const embed = new EmbedBuilder()
    .setColor('#00FF7F')
    .setTitle('🙇 Begging Results')
    .setDescription(`Someone took pity and gave you **🪙 ${amount} coins!**`)
    .addFields({ name: 'New Balance', value: `${user.balance} 🪙` })
    .setFooter({ text: 'Try again in 30s' });

  message.channel.send({ embeds: [embed] });
}

// --- Command: !work (Fixed with await) ---
async function startWork(userId, message) {
  const user = getUser(userId);
  const now = Date.now();
  const cooldown = 60 * 1000; // 1 minute cooldown

  if (now - user.lastWork < cooldown) {
    const remaining = Math.ceil((cooldown - (now - user.lastWork)) / 1000);
    return message.reply(`⏳ You must wait **${remaining}s** before working again.`);
  }

  const jobs = {
    farmer: { min: 50, max: 100, desc: 'Harvest crops in the field' },
    programmer: { min: 150, max: 300, desc: 'Code a new app feature' },
    chef: { min: 80, max: 150, desc: 'Prepare a gourmet meal' },
    gamer: { min: 40, max: 120, desc: 'Stream a gaming session' },
    hunter: { min: 100, max: 200, desc: 'Track down wild game' },
    driver: { min: 70, max: 140, desc: 'Deliver packages across town' }
  };

  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('💼 Choose Your Job')
    .setDescription('Select a job from the dropdown below to earn some coins!')
    .setFooter({ text: 'Cooldown: 1 minute after completion' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('work_select')
    .setPlaceholder('Pick a job...')
    .addOptions(
      Object.keys(jobs).map(job => 
        new StringSelectMenuOptionBuilder()
          .setLabel(job.charAt(0).toUpperCase() + job.slice(1))
          .setDescription(jobs[job].desc)
          .setValue(job)
          .setEmoji('💼')
      )
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const workMessage = await message.channel.send({ embeds: [embed], components: [row] });

  const collector = workMessage.createMessageComponentCollector({
    filter: (interaction) => interaction.user.id === userId,
    time: 60000 // 1 minute to choose
  });

  collector.on('collect', async (interaction) => {
    const selectedJob = interaction.values[0];
    const jobData = jobs[selectedJob];
    const amount = Math.floor(Math.random() * (jobData.max - jobData.min + 1)) + jobData.min;
    
    user.balance += amount;
    user.lastWork = Date.now();

    const resultEmbed = new EmbedBuilder()
      .setColor('#00FF7F')
      .setTitle(`✅ ${selectedJob.charAt(0).toUpperCase() + selectedJob.slice(1)} Job Complete!`)
      .setDescription(`You worked as a **${selectedJob}** and earned **🪙 ${amount} coins!**`)
      .addFields({ name: 'New Balance', value: `${user.balance} 🪙` })
      .setFooter({ text: 'Cooldown started. Try again in 1 minute!' });

    await interaction.update({ embeds: [resultEmbed], components: [] });
    collector.stop();
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      workMessage.edit({ content: '⏰ Time to choose a job expired. Use !work to start again.', embeds: [], components: [] }).catch(() => {});
    }
  });
}

// --- Command: !coinflip <amount> or !cf <amount> ---
function coinFlip(userId, message, args) {
  const user = getUser(userId);
  const amount = parseInt(args[0]);
  
  if (isNaN(amount) || amount <= 0 || amount > user.balance) {
    return message.reply('❌ Invalid amount! You must bet a positive number you can afford.');
  }

  // Simple 50% chance
  const result = Math.random() < 0.5 ? 'win' : 'lose';
  
  if (result === 'win') {
    user.balance += amount; // Double the bet (original + win amount)
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🪙 Coin Flip - HEADS!')
      .setDescription(`You won! Your **🪙 ${amount}** bet doubled to **🪙 ${amount * 2}**!`)
      .addFields({ name: 'New Balance', value: `${user.balance} 🪙` });
    message.channel.send({ embeds: [embed] });
  } else {
    user.balance -= amount;
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🪙 Coin Flip - TAILS!')
      .setDescription(`Tough luck! You lost your **🪙 ${amount}** bet.`)
      .addFields({ name: 'New Balance', value: `${user.balance} 🪙` });
    message.channel.send({ embeds: [embed] });
  }
}

// --- Command: !deposit <amount> ---
function depositCoins(userId, message, args) {
  const user = getUser(userId);
  const amount = parseInt(args[0]);
  
  if (isNaN(amount) || amount <= 0 || amount > user.balance) {
    return message.reply('❌ Invalid amount! You must deposit a positive number from your balance.');
  }

  user.balance -= amount;
  user.bank += amount;

  const embed = new EmbedBuilder()
    .setColor('#00FF7F')
    .setTitle('🏦 Deposit Successful')
    .setDescription(`Deposited **🪙 ${amount}** to your bank.`)
    .addFields(
      { name: 'New Balance', value: `${user.balance} 🪙`, inline: true },
      { name: 'New Bank', value: `${user.bank} 🪙`, inline: true }
    );

  message.channel.send({ embeds: [embed] });
}

// --- Command: !withdraw <amount> ---
function withdrawCoins(userId, message, args) {
  const user = getUser(userId);
  const amount = parseInt(args[0]);
  
  if (isNaN(amount) || amount <= 0 || amount > user.bank) {
    return message.reply('❌ Invalid amount! You must withdraw a positive number from your bank.');
  }

  user.bank -= amount;
  user.balance += amount;

  const embed = new EmbedBuilder()
    .setColor('#00FF7F')
    .setTitle('🏦 Withdrawal Successful')
    .setDescription(`Withdrew **🪙 ${amount}** from your bank.`)
    .addFields(
      { name: 'New Balance', value: `${user.balance} 🪙`, inline: true },
      { name: 'New Bank', value: `${user.bank} 🪙`, inline: true }
    );

  message.channel.send({ embeds: [embed] });
}

// --- Admin Command: !addcoins [amount] (For owner only: if no amount, infinite; else add specific) ---
function addCoins(adminId, amountStr, message) {
  const ownerId = '1411701005984202924';
  if (adminId !== ownerId) {
    return message.reply('🚫 This command is only available to the <@1411701005984202924>.');
  }

  const user = getUser(adminId); // Always add to self for owner
  let amount;
  const infiniteAmount = 999999999;

  if (!amountStr) {
    // No amount specified: give infinite
    amount = infiniteAmount;
    user.balance = infiniteAmount; // Set to infinite
  } else {
    amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('❌ Invalid amount! Please provide a positive number or omit for infinite.');
    }
    user.balance += amount;
  }

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('💰 Coins Added (REAPER MODE)')
    .setDescription(amount === infiniteAmount ? `Set your balance to **🪙 ${infiniteAmount}** (infinite coins)!` : `Added **🪙 ${amount}** coins to your balance.`)
    .addFields(
      { name: 'Owner', value: `<@${adminId}>`, inline: true },
      { name: 'New Balance', value: `${user.balance} 🪙`, inline: true }
    );

  message.channel.send({ embeds: [embed] });
}

// --- New Command: !give @user <amount> (Public transfer from balance) ---
function giveCoins(senderId, receiverId, amountStr, message) {
  if (senderId === receiverId) {
    return message.reply('🚫 You cannot give coins to yourself.');
  }

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return message.reply('❌ Invalid amount! Please provide a positive number.');
  }

  const sender = getUser(senderId);
  if (amount > sender.balance) {
    return message.reply('🚫 You do not have enough coins in your balance to give that amount.');
  }

  const receiver = getUser(receiverId);
  sender.balance -= amount;
  receiver.balance += amount;

  const embed = new EmbedBuilder()
    .setColor('#00FF7F')
    .setTitle('💸 Coins Transferred')
    .setDescription(`<@${senderId}> gave **🪙 ${amount}** coins to <@${receiverId}>.`)
    .addFields(
      { name: 'Sender New Balance', value: `${sender.balance} 🪙`, inline: true },
      { name: 'Receiver New Balance', value: `${receiver.balance} 🪙`, inline: true }
    );

  message.channel.send({ embeds: [embed] });
}

module.exports = {
  showBalance,
  begCoins,
  startWork,
  coinFlip,
  depositCoins,
  withdrawCoins,
  addCoins,
  giveCoins
};