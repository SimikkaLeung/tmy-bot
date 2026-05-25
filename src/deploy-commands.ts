import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Locate and read your commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

const commandsJson = [];

// 2. Loop through and pull the raw layout data out of each file
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const importedFile = await import(fileUrl);
    const command = importedFile.default ? importedFile.default : importedFile;
    
    if (command && command.data) {
        commandsJson.push(command.data.toJSON());
    }
}

// 3. Set up the Discord REST client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// 4. Send the payload to Discord to publish them globally
(async () => {
    try {
        console.log(`📡 Sending ${commandsJson.length} application commands to Discord's servers...`);

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: commandsJson },
        );

        console.log('✅ Successfully published all slash commands! They are now live.');
    } catch (error) {
        console.error('❌ Error publishing commands:', error);
    }
})();