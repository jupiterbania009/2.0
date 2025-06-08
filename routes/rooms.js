const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const User = require('../models/User');

// Create a new room
router.post('/', auth, async (req, res) => {
    try {
        const { name, isPrivate, password } = req.body;
        const roomId = uuidv4();

        const room = new Room({
            roomId,
            name,
            host: req.user.userId,
            isPrivate: isPrivate || true,
            password: password || null,
            participants: [req.user.userId]
        });

        await room.save();

        // Update user's active room
        await User.findByIdAndUpdate(req.user.userId, { activeRoom: roomId });

        res.status(201).json(room);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get room by ID
router.get('/:roomId', auth, async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId })
            .populate('host', 'username email')
            .populate('participants', 'username email');

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.json(room);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Join room
router.post('/:roomId/join', auth, async (req, res) => {
    try {
        const { password } = req.body;
        const room = await Room.findOne({ roomId: req.params.roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        if (room.isPrivate && room.password && room.password !== password) {
            return res.status(401).json({ message: 'Invalid room password' });
        }

        if (!room.participants.includes(req.user.userId)) {
            room.participants.push(req.user.userId);
            await room.save();
        }

        // Update user's active room
        await User.findByIdAndUpdate(req.user.userId, { activeRoom: room.roomId });

        res.json({ message: 'Joined room successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Leave room
router.post('/:roomId/leave', auth, async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        room.participants = room.participants.filter(
            participant => participant.toString() !== req.user.userId
        );

        // If room is empty, delete it
        if (room.participants.length === 0) {
            await Room.deleteOne({ _id: room._id });
        } else {
            // If host leaves, assign new host
            if (room.host.toString() === req.user.userId) {
                room.host = room.participants[0];
            }
            await room.save();
        }

        // Update user's active room
        await User.findByIdAndUpdate(req.user.userId, { activeRoom: null });

        res.json({ message: 'Left room successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update video state
router.put('/:roomId/video', auth, async (req, res) => {
    try {
        const { url, title, duration, currentTime, isPlaying } = req.body;
        const room = await Room.findOne({ roomId: req.params.roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Only host can update video
        if (room.host.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Only host can update video' });
        }

        room.currentVideo = {
            url,
            title,
            duration,
            currentTime: currentTime || 0
        };
        room.isPlaying = isPlaying;
        room.lastActive = Date.now();

        await room.save();

        res.json(room);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get active rooms
router.get('/', auth, async (req, res) => {
    try {
        const rooms = await Room.find()
            .populate('host', 'username email')
            .populate('participants', 'username email')
            .sort({ lastActive: -1 });

        res.json(rooms);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 