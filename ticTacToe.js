const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// In-memory store for active games
// Key: `${channelId}_${player1Id}_${player2Id}` -> Value: game state object
const games = new Map();

// All possible winning combinations on the 3x3 board
const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

/**
 * Creates an array of ActionRowBuilders for the Tic-Tac-Toe board.
 * @param {Array<string|null>} board - The current state of the game board.
 * @returns {ActionRowBuilder[]} An array of rows with buttons.
 */
function createBoardComponents(board) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            const button = new ButtonBuilder().setCustomId(`tictactoe_move_${index}`);

            if (board[index] === 'X') {
                button.setLabel('X').setStyle(ButtonStyle.Danger).setDisabled(true);
            } else if (board[index] === 'O') {
                button.setLabel('O').setStyle(ButtonStyle.Primary).setDisabled(true);
            } else {
                // Use a zero-width space for a visually blank button
                button.setLabel('\u200B').setStyle(ButtonStyle.Secondary);
            }
            row.addComponents(button);
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Disables all buttons on the board, typically after a game ends.
 * @param {ActionRowBuilder[]} components - The current board components.
 * @returns {ActionRowBuilder[]} The modified components with all buttons disabled.
 */
function disableAllButtons(components) {
    // This function now only expects the game board rows
    for (const row of components) {
        for (const button of row.components) {
            button.setDisabled(true);
        }
    }
    return components;
}

/**
 * Checks if a player has won.
 * @param {Array<string|null>} board - The game board.
 * @param {string} sym - The player's symbol ('X' or 'O').
 * @returns {boolean} True if the player has won, false otherwise.
 */
function checkWin(board, sym) {
  return winningConditions.some(combination => combination.every(index => board[index] === sym));
}

/**
 * Checks if the game is a draw.
 * @param {Array<string|null>} board - The game board.
 * @returns {boolean} True if the board is full, false otherwise.
 */
function checkDraw(board) {
  return board.every(cell => cell !== null);
}

/**
 * Gets available moves.
 * @param {Array<string|null>} board - The game board.
 * @returns {number[]} Array of available indices.
 */
function getAvailableMoves(board) {
  return board.map((cell, idx) => cell === null ? idx : null).filter(idx => idx !== null);
}

/**
 * Minimax function for AI.
 * @param {Array<string|null>} board - Current board state.
 * @param {string} player - Current player symbol.
 * @param {string} botSym - Bot's symbol.
 * @param {string} userSym - User's symbol.
 * @returns {number} Score for the move.
 */
function minimax(board, player, botSym, userSym) {
  const avail = getAvailableMoves(board);

  if (checkWin(board, userSym)) return -10;
  if (checkWin(board, botSym)) return 10;
  if (avail.length === 0) return 0;

  if (player === botSym) {
    let maxScore = -Infinity;
    for (let i of avail) {
      board[i] = botSym;
      const score = minimax(board, userSym, botSym, userSym);
      board[i] = null;
      maxScore = Math.max(score, maxScore);
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (let i of avail) {
      board[i] = userSym;
      const score = minimax(board, botSym, botSym, userSym);
      board[i] = null;
      minScore = Math.min(score, minScore);
    }
    return minScore;
  }
}

/**
 * Finds the best move for the bot.
 * @param {Array<string|null>} board - Current board state.
 * @param {string} botSym - Bot's symbol.
 * @param {string} userSym - User's symbol.
 * @returns {number} Best move index.
 */
function findBestMove(board, botSym, userSym) {
  const avail = getAvailableMoves(board);
  let bestScore = -Infinity;
  let bestMove = -1;

  for (let i of avail) {
    board[i] = botSym;
    const score = minimax(board, userSym, botSym, userSym);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}

/**
 * Generate the game embed based on the current state
 * @param {Object} game - The game state.
 * @param {string|null} resultText - Result text if game over.
 * @returns {EmbedBuilder} The embed.
 */
function createGameEmbed(game, resultText = null) {
  if (resultText) {
    const embed = new EmbedBuilder()
        .setColor(resultText.includes('wins') ? '#00FF00' : '#FFFF00')
        .setTitle('🏁 Game Over')
        .setDescription(resultText);
    
    if (resultText.includes('wins')) {
      embed.setImage('https://media.tenor.com/rH3Yh7-6UhsAAAAM/cereal-tic-tac-toe.gif') // Cool winning GIF
           .addFields({ name: 'Congratulations!', value: 'You nailed it! 🎉🏆' });
    } else {
      embed.addFields({ name: 'Tie Game!', value: 'Well played by both! 🤝' });
    }
    
    return embed;
  }
  const opponent = game.players[1] === 'bot' ? 'Bot (⭕)' : `<@${game.players[1]}> (⭕)`;
  const turn = game.currentPlayer === 'bot' ? "Bot's turn (⭕)" : `<@${game.currentPlayer}>'s turn (${game.symbols[game.currentPlayer]})`;
  return new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🎮 Tic-Tac-Toe')
      .setDescription(`<@${game.players[0]}> (❌) vs ${opponent}`)
      .addFields({ name: 'Turn', value: turn })
      .setFooter({ text: 'Click a button to make your move!' });
}

/**
 * Handles bot's move.
 * @param {Object} game - The game state.
 * @param {Message} gameMessage - The game message to edit.
 * @param {ActionRowBuilder} stopRow - The stop button row.
 */
async function botMove(game, gameMessage, stopRow) {
  const botSym = game.symbols['bot'];
  const userSym = game.symbols[game.players[0]];
  const position = findBestMove([...game.board], botSym, userSym);
  game.board[position] = botSym;

  const winner = checkWin(game.board, botSym);
  const draw = !winner && checkDraw(game.board);

  let resultText = null;
  if (winner) {
    resultText = '🎉 Bot (⭕) wins!';
  } else if (draw) {
    resultText = '🤝 It’s a draw!';
  }

  if (winner || draw) {
    games.delete(game.key);
    await gameMessage.edit({
      embeds: [createGameEmbed(game, resultText)],
      components: disableAllButtons(createBoardComponents(game.board))
    });
    return;
  }

  // Switch back to user
  game.currentPlayer = game.players[0];

  await gameMessage.edit({
    embeds: [createGameEmbed(game)],
    components: [...createBoardComponents(game.board), stopRow]
  });
}

/**
 * Starts a new Tic-Tac-Toe game and handles the game flow via button interactions.
 */
async function startTicTacToe(channelId, player1Id, player2Id, message) {
  const isBotGame = player2Id === 'bot';
  const key = `${channelId}_${player1Id}_${isBotGame ? 'bot' : [player1Id, player2Id].sort().join('_')}`;
  if (games.has(key)) {
    return message.reply('⚠️ You already have a game running in this channel!');
  }

  const game = {
    board: Array(9).fill(null),
    players: [player1Id, isBotGame ? 'bot' : player2Id],
    symbols: { [player1Id]: 'X', [isBotGame ? 'bot' : player2Id]: 'O' },
    currentPlayer: player1Id,
    key: key // For deletion
  };
  games.set(key, game);

  // Create a row for the stop game button
  const stopRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
          .setCustomId('tictactoe_stop')
          .setLabel('Stop Game')
          .setStyle(ButtonStyle.Danger)
  );

  const gameMessage = await message.channel.send({
      embeds: [createGameEmbed(game)],
      components: [...createBoardComponents(game.board), stopRow]
  });

  const filter = (interaction) => {
    // Allow player1 to stop the game (or both in PvP)
    if (interaction.customId === 'tictactoe_stop') {
        return game.players.includes(interaction.user.id);
    }
    // Only allow the current human player to make a move
    if (interaction.customId.startsWith('tictactoe_move_')) {
        return interaction.user.id === game.currentPlayer && game.currentPlayer !== 'bot';
    }
    return false;
  };

  const collector = gameMessage.createMessageComponentCollector({
      filter,
      time: 180_000 // 3-minute timeout for the game
  });

  collector.on('collect', async (interaction) => {
    // Handle the stop button interaction
    if (interaction.customId === 'tictactoe_stop') {
        games.delete(key);
        collector.stop('user_stopped'); // Provide a custom reason
        const stopEmbed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('🛑 Game Stopped')
            .setDescription(`The game was stopped by <@${interaction.user.id}>.`);
        
        await interaction.update({
            embeds: [stopEmbed],
            components: disableAllButtons(createBoardComponents(game.board))
        });
        return;
    }

    // Handle a regular game move (human only)
    const position = parseInt(interaction.customId.split('_')[2]);
    const symbol = game.symbols[game.currentPlayer];
    game.board[position] = symbol;

    const winner = checkWin(game.board, symbol);
    const draw = !winner && checkDraw(game.board);

    // End game if there's a winner or a draw
    if (winner || draw) {
      collector.stop();
      games.delete(key);
      const result = winner ? `🎉 <@${game.currentPlayer}> (${symbol}) wins!` : '🤝 It’s a draw!';
      await interaction.update({
          embeds: [createGameEmbed(game, result)],
          components: disableAllButtons(createBoardComponents(game.board))
      });
      return;
    }

    // Switch to the other player
    game.currentPlayer = game.players.find(p => p !== game.currentPlayer);

    await interaction.update({
        embeds: [createGameEmbed(game)],
        components: [...createBoardComponents(game.board), stopRow]
    });

    // If it's a bot game and now bot's turn, make bot move
    if (isBotGame && game.currentPlayer === 'bot') {
      await botMove(game, gameMessage, stopRow);
    }
  });

  // Handle the end of the collector (e.g., due to timeout)
  collector.on('end', (collected, reason) => {
      // Only show timeout message if the game hasn't been manually stopped or finished
      if (reason === 'time' && games.has(key)) {
          games.delete(key);
          const timeoutEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('⌛ Game Timed Out')
              .setDescription('The game has ended due to inactivity.');
          
          gameMessage.edit({
              embeds: [timeoutEmbed],
              components: disableAllButtons(createBoardComponents(game.board))
          }).catch(() => {}); // Ignore error if message was deleted
      }
  });
}

module.exports = { startTicTacToe };