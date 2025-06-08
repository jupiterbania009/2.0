const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isPrivate: {
        type: Boolean,
        default: true
    },
    password: {
        type: String
    },
    currentVideo: {
        url: String,
        title: String,
        duration: Number,
        currentTime: {
            type: Number,
            default: 0
        }
    },
    isPlaying: {
        type: Boolean,
        default: false
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for better query performance
roomSchema.index({ roomId: 1 });
roomSchema.index({ host: 1 });
roomSchema.index({ participants: 1 });
roomSchema.index({ lastActive: 1 });

module.exports = mongoose.model('Room', roomSchema); 
