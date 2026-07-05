import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('schedule-remove')
    .setDescription('🗑️ Remove an existing automation schedule configuration')
    .addStringOption(option =>
        option.setName('config_id')
            .setDescription('Paste the Message ID/Config ID of the schedule (Get it using /schedule-list)')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    const configId = interaction.options.getString('config_id', true);

    try {
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
            return interaction.editReply({ content: "❌ No automation master thread found to delete configurations from." });
        }

        // Fetch and directly target the configuration text block to erase it
        const targetConfigMessage = await scheduleThread.messages.fetch(configId);
        
        if (!targetConfigMessage || !targetConfigMessage.content.includes('⚙️ TMY AUTOMATION CONFIGURATION')) {
            return interaction.editReply({ content: "❌ Invalid target! That ID does not correspond to a valid schedule configuration row." });
        }

        // Delete the entry from the text log base
        await targetConfigMessage.delete();

        await interaction.editReply({ 
            content: `🗑️ **Success!** Schedule option \`${configId}\` has been erased. The background scheduler will skip this task on its next tick.` 
        });

    } catch (error) {
        console.error("Error attempting schedule removal:", error);
        await interaction.editReply({ content: "❌ Could not delete the requested schedule. Ensure the structural configuration ID exists." });
    }
}