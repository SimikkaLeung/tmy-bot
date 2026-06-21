// src/utils/spotify.ts
import { SpotifyApi } from '@spotify/web-api-ts-sdk';

const spotify = SpotifyApi.withClientCredentials(
    process.env.SPOTIFY_CLIENT_ID!,
    process.env.SPOTIFY_CLIENT_SECRET!
);

export async function getRandomTrackFromPlaylist(playlistId: string) {
    try {
        const playlist = await spotify.playlists.getPlaylist(playlistId, undefined, 'tracks.total');
        const totalTracks = playlist.tracks.total;

        if (totalTracks === 0) return null;

        const randomIndex = Math.floor(Math.random() * totalTracks);

        const result = await spotify.playlists.getPlaylistItems(
            playlistId,
            undefined,
            'items(track(name,artists,external_urls))',
            1,
            randomIndex
        );

        const track: any = result.items[0]?.track;
        if (!track) return null;

        return {
            name: track.name,
            artist: track.artists.map((a: any) => a.name).join(', '),
            url: track.external_urls.spotify
        };
    } catch (error) {
        console.error('🚨 Spotify SDK Error:', error);
        throw error;
    }
}