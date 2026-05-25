import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Genius from 'genius-lyrics';

// Initialize the Genius Client using your environment variable
const Client = new Genius.Client(process.env['GENIUS_ACCESS_TOKEN']);

export const data = new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Finds the lyrics for a specific song')
    .addStringOption(option =>
        option.setName('song')
            .setDescription('The title and artist of the song (e.g., I Want It That Way Backstreet Boys)')
            .setRequired(true)
    )
    ;

export async function execute(interaction: ChatInputCommandInteraction) {
    const songQuery = interaction.options.getString('song', true);

    await interaction.deferReply();

    try {
        const searches = await Client.songs.search(songQuery);

        if (!searches || searches.length === 0) {
            await interaction.editReply(`❌ No lyrics found for "**${songQuery}**". Try adding the artist's name!`);
            return;
        }

        // const firstSong = searches[0];
        if (searches && searches[0]) {
            let songResult = searches[0];
            let lyrics = await songResult?.lyrics();

            if (lyrics?.length && lyrics.length > 1800) {
                lyrics = lyrics.substring(0, 1750) + `...\n\n[Read the full lyrics on Genius](${songResult.url})`;
            }

            const embed = new EmbedBuilder()
            .setTitle(songResult.title)
            .setURL(songResult.url)
            .setAuthor({ name: songResult.artist.name, iconURL: songResult.artist.image })
            .setThumbnail(songResult.image)
            .setDescription(lyrics || "*Instrumental track / No lyrics text found.*")
            .setColor('#FFFF00') // Genius Yellow brand color!
            .setFooter({ text: 'Powered by Genius API & genius-lyrics wrapper' });

        await interaction.editReply({ embeds: [embed] });

        }


    } catch (error) {
        console.error('Error fetching lyrics:', error);
        await interaction.editReply('⚠️ An error occurred while trying to fetch the lyrics. Please try again later.');
    }
}