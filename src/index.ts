import { Client, Events, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import http from 'node:http';

dotenv.config();

// Create a new client instance
// Intents define what data your bot is allowed to receive
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Listen for messages
client.on(Events.MessageCreate, (message) => {
    // Prevent the bot from replying to itself
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
    }
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

const PORT = parseInt(process.env['PORT'] || '8000', 10);

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Operational');
});

// 2. PASS THE PORT NUMBER FIRST, THEN THE STRING IP ADRESS
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Health check web layer successfully tracking on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Network interface observation issue:', err.message);
});