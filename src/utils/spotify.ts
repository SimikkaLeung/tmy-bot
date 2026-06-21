import { SpotifyApi } from '@spotify/web-api-ts-sdk';

const spotify = SpotifyApi.withClientCredentials(
    process.env.SPOTIFY_CLIENT_ID || '',
    process.env.SPOTIFY_CLIENT_SECRET || ''
);

export async function getRandomTrackFromPlaylist(playlistInput: string) {
    try {
        // 1. Clean the ID inputs
        const playlistId = playlistInput.includes('playlist/') 
            ? playlistInput.split('playlist/')[1]?.split('?')[0] 
            : playlistInput.trim();

        if (!playlistId) return null;

        // 2. Fetch size by asking for 0 items (this never returns undefined 'total')
        const trackingPayload = await spotify.playlists.getPlaylistItems(
            playlistId,
            undefined,
            'total', // Ask ONLY for the total number metric
            0        // We want 0 items right now, keeping it ultra fast
        );
        
        console.log(`📡 RAW SPOTIFY RESPONSE FOR ID [${playlistId}]:`, JSON.stringify(trackingPayload));
        console.log(`🔢 EXTRACED TOTAL TRACKS:`, trackingPayload?.total);

        const totalTracks = trackingPayload?.total;
        
        // Safety validation fallback
        if (!totalTracks || totalTracks === 0) {
            console.warn(`⚠️ Playlist ${playlistId} is empty or inaccessible.`);
            return null;
        }

        // 3. Roll your random target index
        const randomIndex = Math.floor(Math.random() * totalTracks);

        // 4. Fetch your single target lucky track
        const result = await spotify.playlists.getPlaylistItems(
            playlistId,
            undefined,
            'items(track(name,artists,external_urls))',
            1,
            randomIndex
        );

        const track: any = result?.items?.[0]?.track;
        if (!track) return null;

        return {
            name: track.name,
            artist: track.artists.map((a: any) => a.name).join(', '),
            url: track.external_urls.spotify
        };

    } catch (error) {
        console.error('🚨 Spotify SDK Error during extraction:', error);
        return null; // Suppress crashing completely
    }
}