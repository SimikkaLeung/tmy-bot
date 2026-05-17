import { Client, Events, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';

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