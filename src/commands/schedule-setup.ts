import { 
    SlashCommandBuilder, 
    ChannelType, 
    ChatInputCommandInteraction, 
    TextChannel, 
    ThreadChannel 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('schedule-setup')
    .setDescription('Configure automatic scheduling for track tracking')
    // .addChannelOption(option =>
    //     option.setName('playlist_thread')
    //         .setDescription('The Discord thread containing your track list')
    //         .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
    //         .setRequired(true)
    // )
    .addStringOption(option => 
        option.setName('playlist_thread')
            .setDescription('The Discord thread containing your track list')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option.setName('target_channel')
            .setDescription('The text channel where the bot will automatically post')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('actions')
            .setDescription('The logic the scheduler should execute')
            .setRequired(true)
            .addChoices(
                { name: 'YoutTube Roulette Only', value: 'yt-roulette' },
                // { name: 'Lyric Only', value: 'lyric' },
                // { name: 'Both', value: 'both' }
            )
    )
    .addStringOption(option =>
        option.setName('frequency')
            .setDescription('How often should this run?')
            .setRequired(true)
            .addChoices(
                { name: 'Hourly', value: 'hourly' },
                { name: 'Daily', value: 'daily' },
                { name: 'Weekly', value: 'weekly' }
            )
    )
    .addStringOption(option =>
        option.setName('time')
            .setDescription('At what time? (Ignored for Hourly schedules) (UTC)')
            .setRequired(false)
            .addChoices(
                { name: 'Midnight (00:00 UTC)', value: '00:00' },
                { name: 'Morning (08:00 UTC)', value: '08:00' },
                { name: 'Noon (12:00 UTC)', value: '12:00' },
                { name: 'Evening (20:00 UTC)', value: '20:00' }
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel as TextChannel;
    const threadManager = await channel.threads.fetch();
    const playlistThread = threadManager.threads.find(t => t.name.toLowerCase() === interaction.options.getString('playlist_thread', true));

    // const playlistThread = interaction.options.getChannel('playlist_thread', true) as ThreadChannel;
    const targetChannel = interaction.options.getChannel('target_channel', true);
    const frequency = interaction.options.getString('frequency', true);
    const timeChoice = interaction.options.getString('time', false) ?? "00:00";
    // const timeChoice = interaction.options.getString('time', false) ?? new Date().getTime;
    const actions = interaction.options.getString('actions', true);

    try {
        const parentChannel = interaction.channel as TextChannel;
        let scheduleThread = parentChannel.threads.cache.find(t => t.name === 'tmy-schedules') as ThreadChannel;

        if (!scheduleThread) {
            scheduleThread = await parentChannel.threads.create({
                name: 'tmy-schedules',
                autoArchiveDuration: 60,
                reason: 'TMY Automation Schedules Monitoring',
            });
        }

        // 📌 CRUCIAL: We format this string very specifically. 
        // We put raw IDs inside brackets [ID] so the background loop can parse them perfectly.
        const summaryMessage = [
            `⚙️ **TMY AUTOMATION CONFIGURATION**`,
            `Do not edit the brackets below manually.`,
            `───`,
            `🧵 **Source Thread:** ${playlistThread} \`[SRC:${playlistThread?.id}]\``,
            `📢 **Post Destination:** ${targetChannel} \`[DST:${targetChannel.id}]\``,
            `📅 **Frequency:** \`${frequency}\` \`[FREQ:${frequency}]\``,
            `⏰ **Scheduled Time:** \`${timeChoice}\` \`[TIME:${timeChoice}]\``,
            `🛠️ **Actions:** \`${actions}\` \`[ACT:${actions}]\``,
            `⏱️ **Last Run Timestamp:** \`[RUN:${Date.now()}]\``,
            `───`,
            `*Last updated: <t:${Math.floor(Date.now() / 1000)}:R>*`
        ].join('\n');

        // Post the configuration message into the thread
        await scheduleThread.send(summaryMessage);

        await interaction.editReply("✅ Schedule successfully created and logged in #tmy-schedules!");
        return;

    } catch (error) {
        console.error(error);
        await interaction.editReply("❌ An error occurred setting up the schedule.");
        return;
    }
}