import { google, youtube_v3 } from 'googleapis';
import type { GaxiosResponseWithHTTP2 } from 'googleapis-common';

// Initialize the YouTube client with your secured API key
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY ?? ''
});

interface YouTubeTrack {
    title: string;
    videoUrl: string;
    thumbnail: string;
}

/**
 * Grabs a completely random video from a public YouTube playlist
 * @param playlistId The string ID from the playlist URL (the part after "list=")
 */
export async function getRandomTrackFromPlaylist(playlistId: string): Promise<YouTubeTrack | null> {
    try {
        
        const playlistResponse = await youtube.playlists.list({
            part: ['contentDetails'],
            id: [playlistId]
        });

        const totalVideos = playlistResponse.data.items?.[0]?.contentDetails?.itemCount || 0;

        if (totalVideos === 0) {
            console.warn(`⚠️ Playlist ${playlistId} is empty, private, or doesn't exist.`);
            return null;
        }

        const randomIndex = Math.floor(Math.random() * totalVideos);

        const maxResultsPerPage = 50;   //50 is the max.
        const targetPageNumber = Math.floor(randomIndex / maxResultsPerPage);
        const itemIndexOnPage = randomIndex % maxResultsPerPage;

        let pageToken: string | undefined = undefined;

        for (let i = 0; i < targetPageNumber; i++) {
            const pageResponse: GaxiosResponseWithHTTP2<youtube_v3.Schema$PlaylistItemListResponse> 
                = await youtube.playlistItems.list({
                        part: ['id'],
                        playlistId: playlistId,
                        maxResults: maxResultsPerPage,
                        pageToken: pageToken ?? ''
                    });
            
            pageToken = pageResponse.data.nextPageToken || undefined;
            if (!pageToken) break; // Safety cutoff if the page boundaries shift mid-request
        }

        const finalPageResponse = await youtube.playlistItems.list({
            part: ['snippet'],
            playlistId: playlistId,
            maxResults: maxResultsPerPage,
            pageToken: pageToken ??''
        });
        // ────────── ADD THESE LOGS HERE ──────────
        console.log("=== YOUTUBE ROUTER DEBUG ===");
        console.log("1. Total items count from API:", totalVideos);
        console.log("2. Chosen global randomIndex:", randomIndex);
        console.log("3. Calculated targetPageNumber:", Math.floor(randomIndex / 50));
        console.log("4. Page Token used for final fetch:", pageToken === undefined ? "undefined (Page 0)" : pageToken);
        console.log("5. Number of items returned on this page:", finalPageResponse.data.items?.length);
        console.log("6. Remainder index used on this page array:", randomIndex % 50);
        console.log("=============================");
        
        const targetItem = finalPageResponse.data.items?.[itemIndexOnPage]?.snippet;

        if (!targetItem || !targetItem.resourceId?.videoId) {
            return null;
        }

        return {
            title: targetItem.title || 'Unknown Title',
            videoUrl: `https://www.youtube.com/watch?v=${targetItem.resourceId.videoId}`,
            thumbnail: targetItem.thumbnails?.high?.url || targetItem.thumbnails?.default?.url || ''
        };

    } catch (error) {
        console.error('🚨 YouTube API Error:', error);
        return null;
    }
}