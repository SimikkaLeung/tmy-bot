import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize the internal memory cache mapping
(client as any).commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
// ❌ OLD FILTER:
// const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

const commandFiles = fs.readdirSync(commandsPath).filter(file => {
    // 1. Must be a JS file (production) or TS file (local dev)
    const isTargetFile = file.endsWith('.js') || file.endsWith('.ts');
    // 2. But must NOT be a TypeScript declaration type file (.d.ts)
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
                // This saves the file to your bot's internal brain map
                (client as any).commands.set(command.data.name, command);
                console.log(`🧠 Loaded & cached command memory: /${command.data.name}`);
            }
        } catch (error) {
            console.error(`❌ Failed to load command file ${file}:`, error);
        }
    }
};

// 1. Freeze timeline until memory map is 100% full
await loadCommands();

// 2. Listen for users running commands in chat channels
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = (client as any).commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '⚠️ There was an error executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: '⚠️ There was an error executing this command!', ephemeral: true });
        }
    }
});

// 3. Fire up the gateway engine connection
client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
    console.log(`🤖 Logged in successfully! Bot user is online.`);
});