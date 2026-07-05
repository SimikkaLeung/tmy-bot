import { ThreadChannel } from 'discord.js';

/**
 * Fetches recent messages from a thread and returns one random message content.
 */
export async function getRandomTrackFromThread(thread: ThreadChannel): Promise<string | null> {
    try {
        const messagesCollection = await thread.messages.fetch({ limit: 100 });
        
        const validTracks = messagesCollection.filter(
            msg => msg.author.bot && msg.content.trim().length > 0 && !msg.content.includes('METADATA | TYPE: ')
        );

        if (validTracks.size === 0) {
            console.log(`⚠️ No valid tracks found in thread: ${thread.name}`);
            return null;
        }

        const tracksArray = Array.from(validTracks.values());

        const randomIndex = Math.floor(Math.random() * tracksArray.length);
        const parts = tracksArray?.[randomIndex]?.content.split(' | ');
        return parts?.[2] ?? null;
    } catch (error) {
        console.error(`❌ Failed to fetch tracks from thread ${thread.id}:`, error);
        return null;
    }
}