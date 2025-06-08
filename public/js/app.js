// Socket.IO connection
const socket = io();

// Global state
let currentUser = null;
let currentRoom = null;
let videoPlayer = null;

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const createRoomBtn = document.querySelector('.btn-primary');
const learnMoreBtn = document.querySelector('.btn-secondary');
const videoContainer = document.querySelector('.video-container');
const controlBtns = document.querySelectorAll('.control-btn');

// API endpoints
const API_URL = '';  // Empty string means same domain
const endpoints = {
    register: `${API_URL}/api/auth/register`,
    login: `${API_URL}/api/auth/login`,
    createRoom: `${API_URL}/api/rooms`,
    joinRoom: (roomId) => `${API_URL}/api/rooms/${roomId}/join`,
    leaveRoom: (roomId) => `${API_URL}/api/rooms/${roomId}/leave`,
};

// Authentication functions
async function register(username, email, password) {
    try {
        const response = await fetch(endpoints.register, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            return data;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

async function login(email, password) {
    try {
        const response = await fetch(endpoints.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            return data;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Room functions
async function createRoom(name) {
    try {
        const response = await fetch(endpoints.createRoom, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token'),
            },
            body: JSON.stringify({ name }),
        });
        const data = await response.json();
        if (response.ok) {
            currentRoom = data;
            joinRoomSocket(data.roomId);
            return data;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Create room error:', error);
        throw error;
    }
}

async function joinRoom(roomId, password = '') {
    try {
        const response = await fetch(endpoints.joinRoom(roomId), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token'),
            },
            body: JSON.stringify({ password }),
        });
        const data = await response.json();
        if (response.ok) {
            currentRoom = data;
            joinRoomSocket(roomId);
            return data;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Join room error:', error);
        throw error;
    }
}

async function leaveRoom(roomId) {
    try {
        const response = await fetch(endpoints.leaveRoom(roomId), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token'),
            },
        });
        const data = await response.json();
        if (response.ok) {
            socket.emit('leave_room', { roomId, userId: currentUser.id });
            currentRoom = null;
            return data;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Leave room error:', error);
        throw error;
    }
}

// Socket.IO event handlers
function joinRoomSocket(roomId) {
    socket.emit('join_room', { roomId, userId: currentUser.id });
}

socket.on('user_joined', ({ userId, room }) => {
    console.log(`User ${userId} joined the room`);
    // Update UI to show new participant
    updateParticipantsList(room.participants);
});

socket.on('user_left', ({ userId }) => {
    console.log(`User ${userId} left the room`);
    // Update UI to remove participant
    if (currentRoom) {
        currentRoom.participants = currentRoom.participants.filter(p => p.id !== userId);
        updateParticipantsList(currentRoom.participants);
    }
});

socket.on('video_state', ({ currentVideo, isPlaying }) => {
    if (videoPlayer) {
        videoPlayer.src = currentVideo.url;
        videoPlayer.currentTime = currentVideo.currentTime;
        if (isPlaying) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    }
});

socket.on('video_play', ({ currentTime }) => {
    if (videoPlayer) {
        videoPlayer.currentTime = currentTime;
        videoPlayer.play();
    }
});

socket.on('video_pause', ({ currentTime }) => {
    if (videoPlayer) {
        videoPlayer.currentTime = currentTime;
        videoPlayer.pause();
    }
});

socket.on('video_seek', ({ currentTime }) => {
    if (videoPlayer) {
        videoPlayer.currentTime = currentTime;
    }
});

socket.on('new_message', ({ message, user, timestamp }) => {
    // Add message to chat UI
    addMessageToChat(message, user, timestamp);
});

// UI update functions
function updateParticipantsList(participants) {
    // Update the UI to show current participants
    const participantsList = document.querySelector('.participants-list');
    if (participantsList) {
        participantsList.innerHTML = participants
            .map(p => `<div class="participant">${p.username}</div>`)
            .join('');
    }
}

function addMessageToChat(message, user, timestamp) {
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        messageElement.innerHTML = `
            <span class="message-user">${user.username}</span>
            <span class="message-time">${new Date(timestamp).toLocaleTimeString()}</span>
            <div class="message-content">${message}</div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Event listeners
createRoomBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please log in first!');
        return;
    }
    
    const roomName = prompt('Enter room name:');
    if (roomName) {
        try {
            const room = await createRoom(roomName);
            window.location.href = `/room/${room.roomId}`;
        } catch (error) {
            alert(error.message);
        }
    }
});

// Video player controls
controlBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        if (!currentRoom) return;

        if (this.classList.contains('end-call')) {
            leaveRoom(currentRoom.roomId);
        } else {
            this.classList.toggle('active');
            const icon = this.querySelector('i');
            
            if (icon.classList.contains('fa-microphone')) {
                // Toggle microphone
                const isEnabled = !icon.classList.contains('fa-microphone-slash');
                // Implement WebRTC audio toggle here
            } else if (icon.classList.contains('fa-video')) {
                // Toggle video
                const isEnabled = !icon.classList.contains('fa-video-slash');
                // Implement WebRTC video toggle here
            }
        }
    });
}); 