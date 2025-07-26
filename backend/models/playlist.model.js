import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  spotifyId: { type: String, unique: true, sparse: true }, // Spotify playlist ID
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  image: { 
    url: { type: String }, // Playlist image URL
    height: { type: Number },
    width: { type: Number }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
playlistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add a song to playlist
playlistSchema.methods.addSong = async function(songId) {
  try {
    if (!this.songs.includes(songId)) {
      this.songs.push(songId);
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Error adding song to playlist: ${error.message}`);
  }
};

// Method to remove a song from playlist
playlistSchema.methods.removeSong = async function(songId) {
  try {
    this.songs = this.songs.filter(id => id.toString() !== songId.toString());
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Error removing song from playlist: ${error.message}`);
  }
};

// Method to sync playlist with Spotify data
playlistSchema.methods.syncWithSpotify = async function(spotifyData) {
  try {
    this.name = spotifyData.name || this.name;
    this.description = spotifyData.description || this.description;
    this.spotifyId = spotifyData.id || this.spotifyId;
    if (spotifyData.images && spotifyData.images.length > 0) {
      this.image = {
        url: spotifyData.images[0].url,
        height: spotifyData.images[0].height,
        width: spotifyData.images[0].width
      };
    }
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Error syncing playlist with Spotify: ${error.message}`);
  }
};

export const Playlist = mongoose.model('Playlist', playlistSchema);