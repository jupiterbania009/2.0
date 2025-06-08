const Room = require('../models/Room');
const User = require('../models/User');

// Store room states in memory for better performance
const roomStates = new Map();

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

            // Initialize room state if not exists
            if (!roomStates.has(roomId)) {
                roomStates.set(roomId, {
                    currentVideo: room.currentVideo,
                    isPlaying: false,
                    currentTime: 0,
                    lastUpdate: Date.now(),
                    participants: new Set()
                });
            }

            const roomState = roomStates.get(roomId);
            roomState.participants.add(userId);

            socket.join(roomId);
            
            // Notify others in the room
            socket.to(roomId).emit('user_joined', {
                userId,
                room: {
                    ...room.toObject(),
                    participants: Array.from(roomState.participants).map(id => ({
                        id,
                        username: room.participants.find(p => p._id.toString() === id)?.username || 'Unknown'
                    }))
                }
            });

            // Send current video state to new user
            socket.emit('video_state', {
                currentVideo: roomState.currentVideo,
                isPlaying: roomState.isPlaying,
                currentTime: calculateCurrentTime(roomState)
            });
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Server error' });
        }
    });

    // Leave room
    socket.on('leave_room', async ({ roomId, userId }) => {
        try {
            const roomState = roomStates.get(roomId);
            if (roomState) {
                roomState.participants.delete(userId);
                if (roomState.participants.size === 0) {
                    roomStates.delete(roomId);
                }
            }

            socket.leave(roomId);
            io.to(roomId).emit('user_left', { userId });
        } catch (error) {
            console.error('Error leaving room:', error);
            socket.emit('error', { message: 'Server error' });
        }
    });

    // Video control events
    socket.on('video_play', ({ roomId, currentTime }) => {
        const roomState = roomStates.get(roomId);
        if (roomState) {
            roomState.isPlaying = true;
            roomState.currentTime = currentTime;
            roomState.lastUpdate = Date.now();
            socket.to(roomId).emit('video_play', { currentTime });
        }
    });

    socket.on('video_pause', ({ roomId, currentTime }) => {
        const roomState = roomStates.get(roomId);
        if (roomState) {
            roomState.isPlaying = false;
            roomState.currentTime = currentTime;
            roomState.lastUpdate = Date.now();
            socket.to(roomId).emit('video_pause', { currentTime });
        }
    });

    socket.on('video_seek', ({ roomId, currentTime }) => {
        const roomState = roomStates.get(roomId);
        if (roomState) {
            roomState.currentTime = currentTime;
            roomState.lastUpdate = Date.now();
            socket.to(roomId).emit('video_seek', { currentTime });
        }
    });

    // Time synchronization
    socket.on('time_sync', ({ roomId, currentTime }) => {
        const roomState = roomStates.get(roomId);
        if (roomState) {
            const serverTime = calculateCurrentTime(roomState);
            if (Math.abs(serverTime - currentTime) > 2) { // 2 seconds threshold
                socket.emit('sync_time', { currentTime: serverTime });
            }
        }
    });

    // Change video
    socket.on('change_video', async ({ roomId, videoData }) => {
        try {
            const room = await Room.findOne({ roomId });
            if (room) {
                const roomState = roomStates.get(roomId);
                if (roomState) {
                    roomState.currentVideo = videoData;
                    roomState.currentTime = 0;
                    roomState.isPlaying = false;
                    roomState.lastUpdate = Date.now();
                }

                room.currentVideo = videoData;
                await room.save();

                io.to(roomId).emit('video_state', {
                    currentVideo: videoData,
                    isPlaying: false,
                    currentTime: 0
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

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
};

// Helper function to calculate current video time
function calculateCurrentTime(roomState) {
    if (!roomState.isPlaying) return roomState.currentTime;
    
    const timePassed = (Date.now() - roomState.lastUpdate) / 1000;
    return roomState.currentTime + timePassed;
}

module.exports = { handleSocketConnection }; 
