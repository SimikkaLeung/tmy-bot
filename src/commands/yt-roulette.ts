import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getRandomTrackFromPlaylist } from '../utils/youtube.js'; // Adjust this path to match your layout

export const data = new SlashCommandBuilder()
    .setName('yt-roulette')
    .setDescription('🎰 Pulls a completely random video from a YouTube playlist!')
    .addStringOption(option =>
        option.setName('playlist')
            .setDescription('The YouTube playlist URL or Playlist ID')
            .setRequired(true)
    );

/**
 * Helper function to extract a clean YouTube Playlist ID from user input
 */
function extractPlaylistId(input: string): string {
    // If it looks like a full URL, parse out the 'list=' parameter
    if (input.includes('list=')) {
        try {
            const url = new URL(input);
            const id = url.searchParams.get('list');
            if (id) return id;
        } catch {

        }
    }

    return input.trim();
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {

    await interaction.deferReply();

    const userInput = interaction.options.getString('playlist', true);

    const playlistId = extractPlaylistId(userInput);

    try {
        const track = await getRandomTrackFromPlaylist(playlistId);

    if (!track) {
        await interaction.editReply({
            content: '❌ **Roulette Failed!** I couldn\'t fetch any videos. Please verify the playlist is **public** and the ID/URL is correct.'
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Classic YouTube Red
        .setTitle('🎰 YouTube Roulette Result!')
        .setDescription(`**[${track.title}](${track.videoUrl})**`)
        .addFields({ name: 'Playlist ID', value: `\`${playlistId}\``, inline: true })
        .setURL(track.videoUrl);

    if (track.thumbnail) {
        embed.setImage(track.thumbnail);
    }

    await interaction.editReply({
        content: `🎵 **Here is your random pick!** \n${track.videoUrl}`,
        embeds: [embed]
    });

    } catch (error) {
        if (error instanceof Error) {
            await  interaction.editReply(error.message); 
        }
        await interaction.editReply("An unexpected error occurred.");
    }
}