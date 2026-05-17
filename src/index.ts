import { Client, Collection, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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

(client as any).commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commandsData: any[] = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // Dynamically import the file on the fly
    const command = await import(`file://${filePath}`);
    
    if ('data' in command && 'execute' in command) {
        // Save the command into our memory collection using its name as the key
        (client as any).commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
        console.log(`Loaded command: /${command.data.name}`);
    }
}

const PORT = parseInt(process.env['PORT'] || '8000', 10);
const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Health check server listening on port ${PORT}`);
    try {
        await client.login(process.env['DISCORD_TOKEN']);
    } catch (error) {
        console.error('Failed to log in to Discord:', error);
    }
});

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    const token = process.env['DISCORD_TOKEN'];
    if (!token) return;

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log(`Publishing ${commandsData.length} commands to Discord...`);
        await rest.put(
            Routes.applicationCommands(readyClient.user.id),
            { body: commandsData },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying slash commands:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Fetch the matched command object dynamically out of our collection cache
    const command = (client as any).commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        // Run the command's specific file execution code
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

server.on('error', (err) => console.error('Server error:', err.message));