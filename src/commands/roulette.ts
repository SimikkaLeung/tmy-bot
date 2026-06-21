// src/commands/roulette.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getRandomTrackFromPlaylist } from '../utils/spotify.js';

export const data = new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Get a random song from a Spotify playlist')
    .addStringOption(option => 
        option.setName('playlist_id')
            .setDescription('The Spotify Playlist ID')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    const playlistId = interaction.options.getString('playlist_id', true);

    try {
        const luckyTrack = await getRandomTrackFromPlaylist(playlistId);

        if (!luckyTrack) {
            return interaction.editReply("🎲 That playlist appears to be empty!");
        }

        const embed = {
            title: `🎲 Playlist Roulette Selection!`,
            description: `🎵 **[${luckyTrack.name}](${luckyTrack.url})**\n🎤 *By ${luckyTrack.artist}*`,
            color: 0x1DB954,
            footer: { text: "Click the link to open it in Spotify" }
        };

        await interaction.editReply({ embeds: [embed] });

    } catch (err) {
        await interaction.editReply("❌ Something went wrong while connecting to Spotify.");
    }
}