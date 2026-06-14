import { Client, Collection, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Initialize the internal memory cache mapping
(client as any).commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

// Read local files while safely ignoring .d.ts files
const commandFiles = fs.readdirSync(commandsPath).filter(file => {
    const isTargetFile = file.endsWith('.js') || file.endsWith('.ts');
    const isDeclarationFile = file.endsWith('.d.ts');
    return isTargetFile && !isDeclarationFile;
});

const loadCommands = async () => {
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const fileUrl = pathToFileURL(filePath).href;
        
        try {
            const importedFile = await import(fileUrl);
            const command = importedFile.default ? importedFile.default : importedFile;

            if (command && 'data' in command && 'execute' in command) {
                (client as any).commands.set(command.data.name, command);
                console.log(`🧠 Loaded & cached command memory: /${command.data.name}`);
            }
        } catch (error) {
            console.error(`❌ Failed to load command file ${file}:`, error);
        }
    }
};

// 1. Load your local commands into memory first
await loadCommands();

// 2. Setup the Web Service Health Check Server for Koyeb
const PORT = parseInt(process.env['PORT'] || '8000', 10);
const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

// 3. Open Port 8000 to pass Koyeb checks, then safely connect the Discord client
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`📡 Health check server listening on port ${PORT}`);
    try {
        await client.login(process.env['DISCORD_TOKEN']);
    } catch (error) {
        console.error('Failed to log in to Discord:', error);
    }
});

// 4. Client Handlers & Interaction Gateways
client.once('clientReady', (readyClient) => {
    console.log(`🤖 Logged in successfully! Connected as ${readyClient.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = (client as any).commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }
});

client.on('warn', (warning) => {
    console.warn(`⚠️ [Discord Warning] ${warning}`);
});

server.on('error', (err) => console.error('Server error:', err.message));