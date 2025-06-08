const Room = require('../models/Room');
const User = require('../models/User');

const handleSocketConnection = (io, socket) => {
    console.log('New client connected:', socket.id);

    // Join room
    socket.on('join_room', async ({ roomId, userId }) => {
        try {
            const room = await Room.findOne({ roomId })
                .populate('host', 'username email')
                .populate('participants', 'username email');

            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            socket.join(roomId);
            socket.to(roomId).emit('user_joined', {
                userId,
                room
            });

            // Send current video state to new user
            socket.emit('video_state', {
                currentVideo: room.currentVideo,
                isPlaying: room.isPlaying
            });
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Server error' });
        }
    });

    // Leave room
    socket.on('leave_room', async ({ roomId, userId }) => {
        try {
            socket.leave(roomId);
            socket.to(roomId).emit('user_left', { userId });
        } catch (error) {
            console.error('Error leaving room:', error);
            socket.emit('error', { message: 'Server error' });
        }
    });

    // Video control events
    socket.on('video_play', ({ roomId, currentTime }) => {
        socket.to(roomId).emit('video_play', { currentTime });
    });

    socket.on('video_pause', ({ roomId, currentTime }) => {
        socket.to(roomId).emit('video_pause', { currentTime });
    });

    socket.on('video_seek', ({ roomId, currentTime }) => {
        socket.to(roomId).emit('video_seek', { currentTime });
    });

    socket.on('video_buffer', ({ roomId }) => {
        socket.to(roomId).emit('video_buffer');
    });

    socket.on('video_buffered', ({ roomId }) => {
        socket.to(roomId).emit('video_buffered');
    });

    // Change video
    socket.on('change_video', async ({ roomId, videoData }) => {
        try {
            const room = await Room.findOne({ roomId });
            if (room) {
                room.currentVideo = {
                    ...videoData,
                    currentTime: 0
                };
                room.isPlaying = false;
                await room.save();

                io.to(roomId).emit('video_changed', {
                    currentVideo: room.currentVideo,
                    isPlaying: room.isPlaying
                });
            }
        } catch (error) {
            console.error('Error changing video:', error);
            socket.emit('error', { message: 'Server error' });
        }
    });

    // Chat messages
    socket.on('send_message', ({ roomId, message, user }) => {
        io.to(roomId).emit('new_message', {
            message,
            user,
            timestamp: Date.now()
        });
    });

    // Video sync request
    socket.on('request_sync', ({ roomId }) => {
        socket.to(roomId).emit('sync_requested');
    });

    // Video sync response
    socket.on('sync_response', ({ roomId, currentTime, isPlaying }) => {
        socket.to(roomId).emit('sync_received', { currentTime, isPlaying });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
};

module.exports = { handleSocketConnection }; 