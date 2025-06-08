const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    isPrivate: {
        type: Boolean,
        default: true
    },
    password: {
        type: String,
        default: null
    }
});

module.exports = mongoose.model('Room', roomSchema); 