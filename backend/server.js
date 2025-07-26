import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './utils/db.js';
import userRoute from './routes/user.route.js';
import otpRoute from './routes/otp.route.js';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, Playlist, Song } from './models/index.js';
import isAuthenticated from './middlewares/isAuthenticated.js'; // Import your middleware

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Static folder setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true); // Allow all origins
  },
  credentials: true // Allow cookies
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/user", userRoute);
app.use('/otp', otpRoute);

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
let accessToken = '';

// Mood definitions based on Spotify audio features
const moodProfiles = {
  happy: { valence: [0.6, 1.0], energy: [0.5, 1.0], danceability: [0.5, 1.0] },
  neutral: { valence: [0.3, 0.6], energy: [0.3, 0.7], danceability: [0.3, 0.7] },
  angry: { valence: [0.0, 0.4], energy: [0.7, 1.0], danceability: [0.3, 0.8] },
  sad: { valence: [0.0, 0.3], energy: [0.0, 0.5], danceability: [0.0, 0.5] }
};

// Get Spotify access token
const getAccessToken = async () => {
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.post(tokenUrl, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    accessToken = response.data.access_token;
    console.log('Access token obtained.');
  } catch (error) {
    console.error('Error getting access token:', error.message);
    throw error;
  }
};

// Ensure access token is available
const ensureAccessToken = async () => {
  if (!accessToken) {
    await getAccessToken();
  }
};

// Format tracks for response
const formatTracks = (tracks, mood = null) => {
  return tracks.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((artist) => artist.name).join(', '),
    album: track.album?.name || null,
    image: track.album?.images[0]?.url || null,
    preview_url: track.preview_url || null,
    external_url: track.external_urls?.spotify || null,
    mood: mood
  }));
};

// Filter tracks by mood based on audio features
const filterTracksByMood = async (tracks, mood) => {
  const moodProfile = moodProfiles[mood];
  if (!moodProfile) return tracks;

  const trackIds = tracks.map(track => track.id).join(',');
  try {
    const response = await axios.get(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return tracks.filter((track, index) => {
      const features = response.data.audio_features[index];
      if (!features) return false;
      return (
        features.valence >= moodProfile.valence[0] &&
        features.valence <= moodProfile.valence[1] &&
        features.energy >= moodProfile.energy[0] &&
        features.energy <= moodProfile.energy[1] &&
        features.danceability >= moodProfile.danceability[0] &&
        features.danceability <= moodProfile.danceability[1]
      );
    });
  } catch (error) {
    console.error(`Error fetching audio features for mood ${mood}:`, error.message);
    return tracks; // Fallback to unfiltered tracks
  }
};

// Existing endpoint: New releases
app.get('/api/new-releases', async (req, res) => {
  await ensureAccessToken();
  try {
    const response = await axios.get('https://api.spotify.com/v1/browse/new-releases?limit=50', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const songs = response.data.albums.items.map((album) => ({
      id: album.id,
      name: album.name,
      artists: album.artists.map((artist) => artist.name).join(', '),
      image: album.images[0]?.url || null,
      preview_url: null,
      external_url: album.external_urls.spotify,
    }));

    res.json(songs);
  } catch (error) {
    console.error('Error fetching new releases:', error.message);
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

// Existing endpoint: Mixed hits
app.get('/api/mixed-hits', async (req, res) => {
  await ensureAccessToken();
  try {
    const playlists = {
      english: '37i9dQZF1DXcBWIGoYBM5M',
      punjabi: '37i9dQZF1DWSVl9DWKB8AR',
      hindi: '37i9dQZF1DX0XUsuxWHRQd'
    };

    const [englishRes, punjabiRes, hindiRes] = await Promise.all([
      axios.get(`https://api.spotify.com/v1/playlists/${playlists.english}/tracks?limit=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      axios.get(`https://api.spotify.com/v1/playlists/${playlists.punjabi}/tracks?limit=15`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      axios.get(`https://api.spotify.com/v1/playlists/${playlists.hindi}/tracks?limit=15`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ]);

    const allTracks = [
      ...englishRes.data.items,
      ...punjabiRes.data.items,
      ...hindiRes.data.items
    ].filter(item => item.track).map(item => item.track);

    const shuffledTracks = allTracks.sort(() => 0.5 - Math.random());

    const songs = shuffledTracks.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(artist => artist.name).join(', '),
      image: track.album.images[0]?.url || '',
      external_url: track.external_urls.spotify,
      preview_url: track.preview_url,
      language: track.album.available_markets?.includes('IN') ? 
               (track.name.match(/[अ-ह]/) ? 'hindi' : 
                track.name.match(/[ਁ-ੴ]/) ? 'punjabi' : 'english') : 'english'
    }));

    res.json(songs.slice(0, 50));
  } catch (error) {
    console.error('Error fetching mixed hits:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch songs',
      details: error.response?.data || error.message 
    });
  }
});

// Existing endpoint: Mixed artist tracks
app.get('/api/mixed', async (req, res) => {
  await ensureAccessToken();
  try {
    const artists = [
      { id: '6eUKZXaKkcviH0Ku9w2n3V', name: 'Ed Sheeran', count: 4, language: 'english' },
      { id: '4YRxDV8wJFPHPTeXepOstw', name: 'Arijit Singh', count: 7, language: 'hindi' },
      { id: '5f4QpKfy7ptCHwTqspnSJI', name: 'Neha Kakkar', count: 2, language: 'hindi' },
      { id: '2FKWNmZWDBZR4dE5KX4plR', name: 'Diljit Dosanjh', count: 7, language: 'punjabi' },
      { id: '6cEuCEZuGdZg4X9UrhWZ1i', name: 'Yung Kai Blue', count: 3, language: 'punjabi' }
    ];

    const allTracks = [];

    for (const artist of artists) {
      try {
        const response = await axios.get(
          `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=IN`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (response.data.tracks?.length > 0) {
          const tracksToAdd = response.data.tracks.slice(0, artist.count);
          allTracks.push(...tracksToAdd.map(track => ({
            ...track,
            primary_artist: artist.name,
            language: artist.language
          })));
        }
      } catch (error) {
        console.error(`Error fetching tracks for ${artist.name}:`, error.message);
      }
    }

    const songs = allTracks.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      primary_artist: track.primary_artist,
      language: track.language,
      image: track.album?.images?.[0]?.url || '',
      external_url: track.external_urls?.spotify || '',
      preview_url: track.preview_url || ''
    }));

    const shuffledSongs = songs.sort(() => 0.5 - Math.random());
    
    res.json(shuffledSongs);

  } catch (error) {
    console.error('Error in mixed songs endpoint:', error.message);
    res.status(500).json({ error: 'Failed to fetch mixed songs' });
  }
});

// Existing endpoint: Artist top tracks
app.get('/api/artist-top-tracks/:artistId', async (req, res) => {
  await ensureAccessToken();
  try {
    let tracks = [];
    const artistId = req.params.artistId;

    const specialArtists = {
      '5XacWe2kM6K9G2QJ1q8u0E': 'Satinder Sartaaj',
      '6gBhqjKxay1g6pDm1c4G1e': 'Karan Aujla',
      '5T2Qp1HkQJ9QY9Q5Q5Q5Q5': 'Mohammed Rafi',
      '1dRPPaUIU9UqWQY3hQ5Q5q': 'Lata Mangeshkar'
    };

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=IN`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      tracks = response.data.tracks || [];
    } catch (e) {
      console.log('Standard top tracks failed, trying alternatives');
    }

    if (tracks.length === 0) {
      try {
        const albumsResponse = await axios.get(
          `https://api.spotify.com/v1/artists/${artistId}/albums?limit=1&market=IN`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (albumsResponse.data.items.length > 0) {
          const albumTracks = await axios.get(
            `https://api.spotify.com/v1/albums/${albumsResponse.data.items[0].id}/tracks?market=IN`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          tracks = albumTracks.data.items;
        }
      } catch (e) {
        console.log('Album approach failed');
      }

      if (tracks.length === 0 && specialArtists[artistId]) {
        try {
          const searchResponse = await axios.get(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(specialArtists[artistId])}&type=track&limit=10&market=IN`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          tracks = searchResponse.data.tracks.items;
        } catch (e) {
          console.log('Search approach failed');
        }
      }
    }

    res.json(formatTracks(tracks));

  } catch (error) {
    console.error('Error fetching artist top tracks:', error.message);
    res.status(500).json({ error: 'Failed to fetch artist top tracks' });
  }
});

// Existing endpoint: Mood-based tracks
app.get('/api/songs/:mood', async (req, res) => {
  const { mood } = req.params;
  if (!mood) {
    return res.status(400).json({ error: 'Mood parameter is required' });
  }

  await ensureAccessToken();
  const limit = 50;
  const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(mood)}&type=track&limit=${limit}`;

  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const items = response.data.tracks?.items || [];

    if (items.length === 0) {
      return res.status(404).json({ error: `No ${mood} songs found` });
    }

    const songs = items.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name).join(', '),
      album: track.album.name,
      image: track.album.images[0]?.url || null,
      preview_url: track.preview_url,
      external_url: track.external_urls.spotify,
    }));

    res.json(songs);
  } catch (error) {
    console.error('Error getting songs:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch songs from Spotify' });
  }
});

// Existing endpoint: Alternative mixed artist tracks
app.get('/api/mixed1', async (req, res) => {
  await ensureAccessToken();
  try {
    const artists = [
      { id: '6eUKZXaKkcviH0Ku9w2n3V', name: 'Ed Sheeran', count: 10, language: 'english' },
      { id: '6cEuCEZuGdZg4X9UrhWZ1i', name: 'Yung Kai Blue', count: 5, language: 'english' },
      { id: '06HL4z0CvFAxyc27GXpf02', name: 'Taylor Swift', count: 10, language: 'english' },
      { id: '6M2wZ9GZgrQXHCFfjv46DL', name: 'Dua Lipa', count: 8, language: 'english' },
      { id: '1Xyo4u8uXC1ZmMpatF05PJ', name: 'The Weeknd', count: 8, language: 'english' },
      { id: '7iK8PXO48WeuP03g8YR51W', name: 'Billie Eilish', count: 7, language: 'english' },
      { id: '4V8Sr092nmH6rQvmV0d3zF', name: 'Post Malone', count: 7, language: 'english' },
      { id: '0C8ZW7ezQVs4urJTLi2c5B', name: 'Coldplay', count: 6, language: 'english' },
      { id: '6KImCVD70vtIoJWnq6nGn3', name: 'Harry Styles', count: 6, language: 'english' },
      { id: '4YRxDV8wJFPHPTeXepOstw', name: 'Arijit Singh', count: 10, language: 'hindi' },
      { id: '0oOet2f43PA68X5RxKobEy', name: 'Shreya Ghoshal', count: 8, language: 'hindi' },
      { id: '5f4QpKfy7ptCHwTqspnSJI', name: 'Neha Kakkar', count: 7, language: 'hindi' },
      { id: '2FKWNmZWDBZR4dE5KX4plR', name: 'Diljit Dosanjh', count: 8, language: 'punjabi' },
      { id: '4PULA4EFzYTrxYvOVlwpiQ', name: 'Sidhu Moosewala', count: 7, language: 'punjabi' },
      { id: '5XacWe2kM6K9G2QJ1q8u0E', name: 'Satinder Sartaaj', count: 7, language: 'punjabi' },
      { id: '6gBhqjKxay1g6pDm1c4G1e', name: 'Karan Aujla', count: 7, language: 'punjabi' },
      { id: '0GF4shudTAFv8ak9eWdd4Y', name: 'Kishore Kumar', count: 6, language: 'hindi' },
      { id: '1mYsTxnqsietFxj1OgoGbG', name: 'A.R. Rahman', count: 6, language: 'hindi' }
    ];

    const allTracks = [];

    for (const artist of artists) {
      try {
        const response = await axios.get(
          `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=IN`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (response.data.tracks?.length > 0) {
          const tracksToAdd = response.data.tracks.slice(0, artist.count);
          allTracks.push(...tracksToAdd.map(track => ({
            ...track,
            primary_artist: artist.name,
            language: artist.language
          })));
        }
      } catch (error) {
        console.error(`Error fetching tracks for ${artist.name}:`, error.message);
      }
    }

    const songs = allTracks.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      primary_artist: track.primary_artist,
      language: track.language,
      image: track.album?.images?.[0]?.url || '',
      external_url: track.external_urls?.spotify || '',
      preview_url: track.preview_url || ''
    }));

    const shuffledSongs = songs.sort(() => 0.5 - Math.random()).slice(0, 50);
    
    res.json(shuffledSongs);

  } catch (error) {
    console.error('Error in mixed-alt songs endpoint:', error.message);
    res.status(500).json({ error: 'Failed to fetch mixed-alt songs' });
  }
});

// New endpoint: Search songs
app.get('/api/search/songs', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  await ensureAccessToken();
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20&market=IN`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    const tracks = response.data.tracks?.items || [];
    res.json(formatTracks(tracks));
  } catch (error) {
    console.error('Error searching songs:', error.message);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// Apply isAuthenticated middleware to playlist routes
app.use('/api/playlists', isAuthenticated);

// New endpoint: Create a playlist
app.post('/api/playlists', isAuthenticated, async (req, res) => {
  const { name, description } = req.body;
  const userId = req.id;

  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  try {
    const user = await User.findById(userId).populate('playlists');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if a playlist with the same name already exists for this user
    const existingPlaylist = user.playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingPlaylist) {
      return res.status(400).json({ error: 'A playlist with this name already exists' });
    }

    const playlist = new Playlist({
      name,
      description: description || '',
      user: userId,
    });

    await playlist.save();

    user.playlists.push(playlist._id);
    await user.save();

    res.status(201).json({
      id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      songs: [],
      image: playlist.image,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    });
  } catch (error) {
    console.error('Error creating playlist:', error.message);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

app.get('/api/playlists', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.id).populate({
      path: 'playlists',
      populate: { path: 'songs' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Deduplicate playlists by name (case-insensitive)
    const seenNames = new Set();
    const uniquePlaylists = user.playlists.filter(playlist => {
      const nameLower = playlist.name.toLowerCase();
      if (seenNames.has(nameLower)) {
        return false;
      }
      seenNames.add(nameLower);
      return true;
    });

    const playlists = uniquePlaylists.map(playlist => ({
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      songs: playlist.songs.map(song => ({
        id: song._id.toString(),
        spotifyId: song.spotifyId,
        title: song.title,
        artists: song.artists,
        album: song.album.name,
        image: song.album.image?.url || null,
        previewUrl: song.previewUrl,
        spotifyUri: song.spotifyUri,
      })),
      image: playlist.image,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    }));

    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error.message);
    res.status(500).json({ error: 'Failed to fetch playlists', details: error.message });
  }
});
// New endpoint: Add song to playlist
app.post('/api/playlists/:playlistId/songs', async (req, res) => {
  const { playlistId } = req.params;
  const { spotifyId } = req.body;
  const userId = req.id;

  if (!spotifyId) {
    return res.status(400).json({ error: 'Spotify track ID is required' });
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.user.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized: Not your playlist' });
    }

    await ensureAccessToken();
    const trackResponse = await axios.get(`https://api.spotify.com/v1/tracks/${spotifyId}?market=IN`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const track = trackResponse.data;

    const song = await Song.findOneAndUpdate(
      { spotifyId: track.id },
      {
        spotifyId: track.id,
        title: track.name,
        artists: track.artists.map(artist => artist.name),
        album: {
          name: track.album.name,
          spotifyId: track.album.id,
          image: track.album.images[0] ? {
            url: track.album.images[0].url,
            height: track.album.images[0].height,
            width: track.album.images[0].width,
          } : {},
        },
        durationMs: track.duration_ms,
        previewUrl: track.preview_url,
        spotifyUri: track.uri,
      },
      { upsert: true, new: true }
    );

    await playlist.addSong(song._id);

    res.json({
      id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      songs: (await playlist.populate('songs')).songs.map(song => ({
        id: song._id,
        spotifyId: song.spotifyId,
        title: song.title,
        artists: song.artists,
        album: song.album.name,
        image: song.album.image?.url || null,
        previewUrl: song.previewUrl,
        spotifyUri: song.spotifyUri,
      })),
      image: playlist.image,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    });
  } catch (error) {
    console.error('Error adding song to playlist:', error.message);
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

// New endpoint: Remove song from playlist
app.delete('/api/playlists/:playlistId/songs/:songId', async (req, res) => {
  const { playlistId, songId } = req.params;
  const userId = req.id;

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.user.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized: Not your playlist' });
    }

    await playlist.removeSong(songId);

    res.json({
      id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      songs: (await playlist.populate('songs')).songs.map(song => ({
        id: song._id,
        spotifyId: savsong.spotifyId,
        title: song.title,
        artists: song.artists,
        album: song.album.name,
        image: song.album.image?.url || null,
        previewUrl: song.previewUrl,
        spotifyUri: song.spotifyUri,
      })),
      image: playlist.image,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    });
  } catch (error) {
    console.error('Error removing song from playlist:', error.message);
    res.status(500).json({ error: 'Failed to remove song from playlist' });
  }
});

// New endpoint: Play playlist
app.get('/api/playlists/:playlistId/play', async (req, res) => {
  const { playlistId } = req.params;
  const userId = req.id;

  try {
    const playlist = await Playlist.findById(playlistId).populate('songs');
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.user.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized: Not your playlist' });
    }

    const playbackData = {
      playlistId: playlist._id,
      name: playlist.name,
      songs: playlist.songs.map(song => ({
        id: song._id,
        spotifyId: song.spotifyId,
        title: song.title,
        artists: song.artists,
        album: song.album.name,
        image: song.album.image?.url || null,
        previewUrl: song.previewUrl,
        spotifyUri: song.spotifyUri,
      })),
    };

    res.json(playbackData);
  } catch (error) {
    console.error('Error fetching playlist for playback:', error.message);
    res.status(500).json({ error: 'Failed to fetch playlist for playback' });
  }
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to the database", err);
  });