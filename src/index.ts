import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import http from 'node:http';
import * as pingCommand from './commands/ping.js';

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
    res.end('OK');
});

// 2. PASS THE PORT NUMBER FIRST, THEN THE STRING IP ADRESS
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌐 Health check server listening on port ${PORT}`);

    try {
        console.log('Connecting to Discord Gateway...');
        await client.login(process.env['DISCORD_TOKEN']);
    } catch (error) {
        console.error('Failed to log in to Discord:', error);
    }
});

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🤖 Logged in as ${readyClient.user.tag}`);

    const token = process.env['DISCORD_TOKEN'];
    if (!token) return console.error('Missing DISCORD_TOKEN env variable.');

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');

        // This publishes your /ping command directly to Discord's servers
        await rest.put(
            Routes.applicationCommands(readyClient.user.id),
            { body: [pingCommand.data.toJSON()] },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying slash commands:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        try {
            await pingCommand.execute(interaction);
        } catch (error) {
            console.error('Error executing ping command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
            }
        }
    }
});

server.on('error', (err) => console.error('Server error:', err.message));