import mongoose from "mongoose";

const songSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true, unique: true }, // Spotify track ID
  title: { type: String, required: true },
  artists: [{ type: String, required: true }], // Array of artist names
  album: {
    name: { type: String, required: true },
    spotifyId: { type: String, required: true }, // Spotify album ID
    image: { 
      url: { type: String }, // Album image URL from Spotify
      height: { type: Number },
      width: { type: Number }
    }
  },
  durationMs: { type: Number, required: true }, // Duration in milliseconds
  previewUrl: { type: String }, // Preview audio URL
  spotifyUri: { type: String, required: true }, // Spotify URI for playback
  addedAt: { type: Date, default: Date.now }
});

export const Song = mongoose.model('Song', songSchema);