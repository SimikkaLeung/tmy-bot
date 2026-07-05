import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ThreadChannel, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('schedule-list')
    .setDescription('📋 Displays a list of all active automated playlist schedules');

export async function execute(interaction: ChatInputCommandInteraction) {
    // 🛡️ Defer instantly to give the bot time to fetch messages
    await interaction.deferReply({ ephemeral: true });

    try {
        // Find our global schedules master configuration thread
        let scheduleThread: ThreadChannel | undefined;
        const channels = interaction.guild?.channels.cache;

        if (channels) {
            for (const [_, ch] of channels) {
                if (ch.type === ChannelType.GuildText) {
                    const found = ch.threads?.cache.find(t => t.name === 'tmy-schedules');
                    if (found) { scheduleThread = found as ThreadChannel; break; }
                }
            }
        }

        if (!scheduleThread) {
            return interaction.editReply({ content: "⚠️ No automation database (`tmy-schedules`) was found in this server." });
        }

        // Fetch the configuration records (bot logs)
        const messages = await scheduleThread.messages.fetch({ limit: 50 });
        const configMessages = messages.filter(msg => msg.content.includes('⚙️ TMY AUTOMATION CONFIGURATION'));

        if (configMessages.size === 0) {
            return interaction.editReply({ content: "ℹ️ There are currently no active automated schedules configured." });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Active Automated Schedules')
            .setColor('#3498db')
            .setTimestamp();

        let count = 1;
        configMessages.forEach(msg => {
            // Regex extractions from your database layout
            const srcId = msg.content.match(/\[SRC:(.*?)\]/)?.[1] ?? 'Unknown';
            const dstId = msg.content.match(/\[DST:(.*?)\]/)?.[1] ?? 'Unknown';
            const freq = msg.content.match(/\[FREQ:(.*?)\]/)?.[1] ?? 'Unknown';
            const time_hhmm = msg.content.match(/\[TIME:(.*?)\]/)?.[1] ?? 'Unknown';
            const action = msg.content.match(/\[ACT:(.*?)\]/)?.[1] ?? 'Unknown';

            embed.addFields({
                name: `Schedule #${count++}`,
                value: `• **Source Thread ID:** \`${srcId}\`\n• **Target Channel ID:** \`${dstId}\`\n• **Frequency:** \`${freq}\`\n• **Time:** \`${time_hhmm}\`\n• **Action Type:** \`${action}\`\n*ID for removal:* \`${msg.id}\``
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("Error generating list:", error);
        await interaction.editReply({ content: "❌ Failed to look up schedule listings." });
    }
}