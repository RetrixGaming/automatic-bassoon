const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Key format: `${channelId}_${userId}`
const games = new Map();

/**
 * Starts a new Guess The Number game.
 */
function startGame(channelId, userId, message) {
  const key = `${channelId}_${userId}`;

  // Prevent duplicate games by same user in the same channel
  if (games.has(key)) {
    return message.reply('⚠️ You already have a guessing game in progress here!');
  }

  // Generate a random number between 1 and 100
  const number = Math.floor(Math.random() * 100) + 1;

  const game = {
    number,
    attempts: 12,
    player: userId,
    message: null, // Store the message for editing
    collector: null // Store the collector to stop it later
  };

  // Create stop button row
  const stopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('guess_stop')
      .setLabel('Stop Game')
      .setStyle(ButtonStyle.Danger)
  );

  const startEmbed = new EmbedBuilder()
    .setColor('#00BFFF')
    .setTitle('🎯 Guess The Number!')
    .setDescription('I’ve thought of a number between **1–100**.\nYou have **12 attempts** — type your guesses below!')
    .addFields({ name: 'Attempts Left', value: `${game.attempts}`, inline: true })
    .setFooter({ text: 'Good luck! Click "Stop Game" to quit anytime.' });

  message.channel.send({ embeds: [startEmbed], components: [stopRow] }).then(gameMsg => {
    game.message = gameMsg;

    // Set up component collector for stop button
    const collector = gameMsg.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === userId && interaction.customId === 'guess_stop',
      time: 180000 // 3 minutes timeout
    });

    collector.on('collect', async (interaction) => {
      games.delete(key);
      collector.stop('stopped');
      const stoppedEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🛑 Game Stopped')
        .setDescription('You decided to stop the game early.')
        .addFields(
          { name: 'The Number Was', value: `**${game.number}**`, inline: true }
        )
        .setFooter({ text: 'Better luck next time! Start a new game with !guess.' });
      await interaction.update({ embeds: [stoppedEmbed], components: [] });
    });

    collector.on('end', (collected, reason) => {
      // If timed out and game still active, end it
      if (reason === 'time' && games.has(key)) {
        games.delete(key);
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('⌛ Game Timed Out')
          .setDescription('The game ended due to inactivity.')
          .addFields(
            { name: 'The Number Was', value: `**${game.number}**`, inline: true }
          );
        gameMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
      }
    });

    game.collector = collector;
    games.set(key, game);
  });
}

/**
 * Handles each user guess.
 */
async function handleGuess(channelId, userId, content, message) {
  const key = `${channelId}_${userId}`;
  const game = games.get(key);
  if (!game || !game.message) return false;

  // Try to parse guess as an integer
  const guess = parseInt(content);
  if (isNaN(guess) || guess < 1 || guess > 100) {
    // Optionally reply to invalid guesses, but for now, ignore and delete
    setTimeout(() => {
      message.delete().catch(() => {});
    }, 3000);
    return false;
  }

  // 🧹 Auto-delete user’s guess message after 3 seconds
  setTimeout(() => {
    message.delete().catch(() => {});
  }, 3000);

  // Reduce attempts
  game.attempts--;
  let feedback = '';
  let color = '#00BFFF';

  // Check guess
  if (guess === game.number) {
    feedback = `🎉 Correct! The number was **${game.number}**! Great job!`;
    color = '#00FF00';
    if (game.collector) game.collector.stop('won');
    games.delete(key);
  } else if (game.attempts <= 0) {
    feedback = `💀 Out of attempts! The number was **${game.number}**. Better luck next time!`;
    color = '#FF0000';
    if (game.collector) game.collector.stop('lost');
    games.delete(key);
  } else if (guess < game.number) {
    feedback = `📉 Too low! Try a higher number.`;
  } else {
    feedback = `📈 Too high! Try a lower number.`;
  }

  // Create updated embed
  const updatedEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎯 Guess The Number!')
    .setDescription(feedback)
    .addFields({ name: 'Attempts Left', value: `${Math.max(game.attempts, 0)}`, inline: true })
    .setFooter({ text: game.attempts > 0 ? 'Keep guessing!' : 'Game over! Start a new one with !guess.' });

  // Create stop button row (only if game not ended)
  let components = [];
  if (game.attempts > 0) {
    const stopRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('guess_stop')
        .setLabel('Stop Game')
        .setStyle(ButtonStyle.Danger)
    );
    components = [stopRow];
  }

  // Update existing message
  await game.message.edit({ embeds: [updatedEmbed], components });

  return true;
}

module.exports = { startGame, handleGuess };