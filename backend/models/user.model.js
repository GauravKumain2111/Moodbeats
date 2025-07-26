import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  spotifyId: { type: String, unique: true, sparse: true }, // Spotify user ID
  playlists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }]
});

export const User = mongoose.model('User', userSchema);