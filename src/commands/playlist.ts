import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    TextChannel, 
    ThreadChannel,
    PermissionFlagsBits
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage server music playlists')
    .addSubcommand(sub =>
        sub.setName('create')
            .setDescription('Create a new playlist thread')
            .addStringOption(o => o.setName('name').setDescription('Name of the playlist').setRequired(true))
            .addStringOption(o => o.setName('type').setDescription('Platform type').setRequired(true)
                .addChoices({ name: 'YouTube', value: 'youtube' }, { name: 'Spotify', value: 'spotify' }))
    )
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a song or playlist link to a playlist')
            .addStringOption(o => o.setName('playlist').setDescription('Name of the playlist').setRequired(true))
            .addStringOption(o => o.setName('link').setDescription('The URL link').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show all tracks inside a playlist')
            .addStringOption(o => o.setName('playlist').setDescription('Name of the playlist').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a link by its index number')
            .addStringOption(o => o.setName('playlist').setDescription('Name of the playlist').setRequired(true))
            .addIntegerOption(o => o.setName('number').setDescription('The index number to remove').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('delete')
            .setDescription('Delete an entire playlist')
            .addStringOption(o => o.setName('playlist').setDescription('Name of the playlist').setRequired(true))
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel as TextChannel;

    if (!channel || channel.name.toLowerCase() !== 'tmy-settings') {
        return interaction.reply({ 
            content: '❌ This command can only be used inside a channel named `#tmy-settings`.', 
            ephemeral: true 
        });
    }

    if (!(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) 
        || interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers))) {
        return interaction.reply({ 
            content: '❌ Only server Administrators and Moderate Members can manage bot configurations.', 
            ephemeral: true 
        });
    }

    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    const playlistName = interaction.options.getString('playlist')?.toLowerCase() || 
                         interaction.options.getString('name')?.toLowerCase();

    try {
        const threadManager = await channel.threads.fetch();
        let thread = threadManager.threads.find(t => t.name.toLowerCase() === playlistName);

        if (subcommand === 'create') {
            if (thread) return interaction.editReply(`❌ A playlist named "${playlistName}" already exists.`);
            
            const type = interaction.options.getString('type', true);
            
            // Create a dedicated thread for this playlist
            const newThread = await channel.threads.create({
                name: playlistName!,
                autoArchiveDuration: 10080,
                type: 11, // ChannelType.GuildPublicThread or GuildPrivateThread
                reason: 'Secure TMY Playlist Storage Engine',
            });

            await newThread.setLocked(true, 'Prevent non-admin users from corrupting database text data');
            // Post a seed metadata message. This represents index #0.
            await newThread.send(`⚙️ METADATA || TYPE: ${type.toUpperCase()}`);
            return interaction.editReply(`✅ Created new **${type}** playlist thread: <#${newThread.id}>`);
        }

        // For all other commands, the target thread MUST already exist
        if (!thread) return interaction.editReply(`❌ Playlist "${playlistName}" not found. Create it first.`);

        // --- SUBCOMMAND: ADD ---
        if (subcommand === 'add') {
            const link = interaction.options.getString('link', true);
            
            // Fetch messages to compute the next incremental numeric index order
            const messages = await thread.messages.fetch({ limit: 100 });
            const itemRecords = Array.from(messages.values()).filter(m => m.content.includes('TRACK ||'));
            const nextOrderNumber = itemRecords.length + 1;

            // Save row entry
            await thread.send(`TRACK || #${nextOrderNumber} || ${link}`);
            return interaction.editReply(`✅ Added to **${thread.name}** as track **#${nextOrderNumber}**!`);
        }

        // --- SUBCOMMAND: SHOW ---
        if (subcommand === 'show') {
            const messages = await thread.messages.fetch({ limit: 100 });
            // Sort oldest first so order reads 1, 2, 3...
            const trackRecords = Array.from(messages.values())
                .filter(m => m.content.includes('TRACK ||'))
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            if (trackRecords.length === 0) {
                return interaction.editReply(`🎵 **Playlist: ${thread.name}** is currently empty.`);
            }

            let responseMenu = `🎵 **Track list for ${thread.name}:**\n\n`;
            trackRecords.forEach((msg, index) => {
                const parts = msg.content.split(' || ');
                const originalLink = parts[2]
                responseMenu += `**${index + 1}.** ${originalLink}\n`;
            });

            return interaction.editReply(responseMenu);
        }

        // --- SUBCOMMAND: REMOVE ---
        if (subcommand === 'remove') {
            const targetIndex = interaction.options.getInteger('number', true);
            const messages = await thread.messages.fetch({ limit: 100 });
            
            // Sort oldest first to reliably track positional maps
            const trackRecords = Array.from(messages.values())
                .filter(m => m.content.includes('TRACK ||'))
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            if ((targetIndex < 1 || targetIndex > trackRecords.length)) {
                return interaction.editReply(`❌ Invalid track number. Choose a number between 1 and ${trackRecords.length}.`);
            }

            // Find the precise discord message tracking that item index and destroy it
            const messageToDelete = trackRecords[targetIndex - 1];
            if (!messageToDelete) {
                return interaction.editReply(`❌ An error occurs when fetching ${playlistName}.`);
            }
            await messageToDelete.delete();

            const remainingMessages = trackRecords.filter(m => m.id !== messageToDelete.id);
           
            const failedTrackMap = new Map<number, String>();
            let expectedNewIndex = 0;
            for (let i = 0; i < remainingMessages.length; i++) {
                const message = remainingMessages[i];
                if (!message) continue;

                const parts = message.content.split(' || ');
                if ( !parts[2] || parts[2]?.trim().length == 0 ) {
                    continue;
                }

                const urlStr = parts[2]; // Using parts[2] as per your design!

                expectedNewIndex += 1; 
                const str = 'TRACK || ' + expectedNewIndex + ' || ${urlStr}';

                try {
                    // Step A: Delete the old un-indexed/wrongly indexed message record
                    await message.delete();
                    
                    // Step B: Instantly write the corrected tracking entry
                    
                    await thread.send(str);
                    
                } catch (error) {
                    console.error(`❌ Failed to re-index track at position ${expectedNewIndex}:`, error);
                    
                    // Record the failure so we can report it to the admin later
                    failedTrackMap.set(expectedNewIndex, str);
                }
            }

            // 2. Formulate an intelligent response based on the sync outcome
            if (failedTrackMap.size === 0) {
                return interaction.editReply(`🗑️ Successfully removed track #${targetIndex} and cleanly re-sequenced the playlist order!`);
            } else {
                return interaction.editReply(
                    `⚠️ Track #${targetIndex} was removed, but the bot encountered network errors while re-indexing positions: **${failedTrackMap.values()}**. \n` +
                    `Please check <#${thread.id}> to verify your playlist links.`
                );
            }
        }

        // --- SUBCOMMAND: DELETE ---
        if (subcommand === 'delete') {
            await thread.delete('Admin initialized execution termination sequences.');
            return interaction.editReply(`💥 Playlist **${playlistName}** has been completely deleted.`);
        }

    } catch (error) {
        console.error('Playlist router crash:', error);
        return interaction.editReply('❌ System failure while reading or updating the thread parameters.');
    }
}