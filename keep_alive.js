const express = require('express');
const server = express();

// This is the endpoint that will be pinged by an uptime service.
server.all('/', (req, res) => {
  // When this URL is visited, it sends back a response to show the bot is active.
  res.send('Bot status: Online');
});

function keepAlive() {
  // Start the server and listen on port 3000, or the port defined by the environment.
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`✅ Web server is listening on port ${port}`);
  });
}

// Export the function to be used in your main bot file.
module.exports = keepAlive;
