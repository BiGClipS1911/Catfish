/**
 * CATFISH - Evolutionary Simulation & Multiplayer Backend Server
 * Express web server with Socket.io real-time multiplayer, global leaderboards,
 * action relay, and Railway container hosting support.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Unrestricted CORS Middleware for Express (Placed at top of pipeline)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control'],
    credentials: false
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Configure Socket.IO with WebSockets + Long Polling for Railway & Proxy Compatibility
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
        credentials: false
    },
    pingTimeout: 25000,
    pingInterval: 10000,
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

const PORT = process.env.PORT || 3000;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

// Helper: Read Leaderboard Data
function getLeaderboard() {
    try {
        if (fs.existsSync(LEADERBOARD_FILE)) {
            const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error("Error reading leaderboard.json:", err);
    }
    return [];
}

// Helper: Save Leaderboard Data
function saveLeaderboard(board) {
    try {
        board.sort((a, b) => (b.points || 0) - (a.points || 0));
        const trimmed = board.slice(0, 1000);
        fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
        return trimmed;
    } catch (err) {
        console.error("Error writing leaderboard.json:", err);
        return board;
    }
}

let leaderboardInMemory = getLeaderboard();
let saveTimeout = null;

function saveLeaderboardDebounced() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveLeaderboard(leaderboardInMemory);
    }, 2000);
}

// Helper: Add or Update Leaderboard Entry in Real-Time
function updateOrAddLeaderboardEntry(name, points = 0, generation = 1, released = 0) {
    if (!name || !name.trim()) return leaderboardInMemory;

    const cleanName = name.trim().substring(0, 24);
    const existingIndex = leaderboardInMemory.findIndex(entry => entry.name.toLowerCase() === cleanName.toLowerCase());

    const prevTopPlayer = leaderboardInMemory.length > 0 ? leaderboardInMemory[0].name : null;

    const entryData = {
        name: cleanName,
        points: Math.max(0, Math.floor(points)),
        generation: Math.max(1, generation || 1),
        released: Math.max(0, released || 0),
        date: new Date().toISOString().split('T')[0]
    };

    let boardChanged = false;
    if (existingIndex >= 0) {
        const existing = leaderboardInMemory[existingIndex];
        if (
            entryData.points > (existing.points || 0) ||
            entryData.generation > (existing.generation || 1) ||
            entryData.released > (existing.released || 0)
        ) {
            leaderboardInMemory[existingIndex] = {
                ...existing,
                ...entryData,
                points: Math.max(entryData.points, existing.points || 0),
                generation: Math.max(entryData.generation, existing.generation || 1),
                released: Math.max(entryData.released, existing.released || 0)
            };
            boardChanged = true;
        }
    } else {
        leaderboardInMemory.push(entryData);
        boardChanged = true;
    }

    if (boardChanged) {
        leaderboardInMemory.sort((a, b) => (b.points || 0) - (a.points || 0));
        saveLeaderboardDebounced();

        const newTopPlayer = leaderboardInMemory.length > 0 ? leaderboardInMemory[0].name : null;
        if (newTopPlayer && prevTopPlayer && newTopPlayer.toLowerCase() !== prevTopPlayer.toLowerCase()) {
            broadcastChatMessage(
                'system',
                'System',
                `🏆 LEADERBOARD CROWN: Aquarist ${newTopPlayer} has claimed #1 on the Global Railway Leaderboard with ${leaderboardInMemory[0].points.toLocaleString()} PTS!`,
                true
            );
        }

        io.emit('leaderboard_update', leaderboardInMemory);
    }
    return leaderboardInMemory;
}

// REST APIs
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CATFISH Railway Server',
        onlinePlayers: Object.keys(players).length,
        uptimeSeconds: Math.floor(process.uptime()),
        railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN || null,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboardInMemory);
});

app.post('/api/leaderboard', (req, res) => {
    const { name, points, generation, released } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Invalid score submission payload' });
    }
    const updatedBoard = updateOrAddLeaderboardEntry(name, points || 0, generation || 1, released || 0);
    res.json({ success: true, leaderboard: updatedBoard });
});

// Socket.io Real-Time Multiplayer State
const players = {}; // socketId -> player object
const chatHistory = []; // Rolling buffer for last 50 global messages

function broadcastChatMessage(senderId, senderName, text, isSystem = false) {
    if (!text || !text.trim()) return null;
    const msgPayload = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        senderId: senderId || 'system',
        sender: senderName || 'System',
        text: text.trim().substring(0, 300),
        isSystem: !!isSystem,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    chatHistory.push(msgPayload);
    if (chatHistory.length > 50) chatHistory.shift();

    io.emit('receive_global_chat', msgPayload);
    return msgPayload;
}

io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id} from ${socket.handshake.address}`);

    // Send current leaderboard, chat history & online count on connect
    socket.emit('leaderboard_update', leaderboardInMemory);
    socket.emit('chat_history', chatHistory);
    io.emit('online_count', Object.keys(players).length);

    // Heartbeat / ping listener
    socket.on('client_ping', () => {
        socket.emit('server_pong', { time: Date.now() });
    });

    // Player registers fish & name into online lobby
    socket.on('join_online_lobby', (playerData) => {
        const isNewPlayer = !players[socket.id];
        players[socket.id] = {
            id: socket.id,
            name: playerData.name || `Aquarist_${socket.id.substring(0, 4)}`,
            fish: playerData.fish || [],
            points: playerData.points || 0,
            generation: playerData.generation || 1,
            joinedAt: Date.now()
        };

        console.log(`🌊 ${players[socket.id].name} joined global aquarium lobby.`);

        if (isNewPlayer) {
            broadcastChatMessage('system', 'System', `🌐 Aquarist ${players[socket.id].name} connected to live global chat!`, true);
        }

        // Immediately add/update player on real-time leaderboard
        updateOrAddLeaderboardEntry(
            players[socket.id].name,
            players[socket.id].points,
            players[socket.id].generation,
            playerData.released || 0
        );

        // Notify caller of current active room state
        socket.emit('lobby_state', {
            players: Object.values(players)
        });

        // Broadcast to all other clients
        socket.broadcast.emit('player_joined', players[socket.id]);
        io.emit('online_count', Object.keys(players).length);
    });

    // Real-time fish state sync (relayed to all other connected clients)
    socket.on('sync_fish_state', (data) => {
        if (players[socket.id] && data) {
            if (data.name && data.name.trim()) {
                players[socket.id].name = data.name.trim().substring(0, 24);
            }
            players[socket.id].fish = data.fish || [];
            players[socket.id].points = data.points || 0;
            players[socket.id].generation = data.generation || 1;

            // Sync score & stats to real-time leaderboard
            updateOrAddLeaderboardEntry(
                players[socket.id].name,
                data.points || 0,
                data.generation || 1,
                data.released || 0
            );

            socket.broadcast.emit('remote_fish_update', {
                playerId: socket.id,
                playerName: players[socket.id].name,
                fish: data.fish || [],
                points: data.points || 0,
                generation: data.generation || 1
            });
        }
    });

    // Real-Time Score Submission Relay
    socket.on('submit_score', (scoreData) => {
        if (!scoreData) return;
        const senderName = (players[socket.id] ? players[socket.id].name : scoreData.name) || `Aquarist_${socket.id.substring(0, 4)}`;
        updateOrAddLeaderboardEntry(
            senderName,
            scoreData.points || 0,
            scoreData.generation || 1,
            scoreData.released || 0
        );
    });

    // Global Multiplayer Live Chat Relay
    socket.on('send_global_chat', (data) => {
        if (!data || !data.text || !data.text.trim()) return;
        const senderName = players[socket.id] ? players[socket.id].name : 'Aquarist';
        console.log(`💬 [Live Chat] ${senderName}: ${data.text}`);
        broadcastChatMessage(socket.id, senderName, data.text, false);
    });

    // Multiplayer Action Relay (feeding pellets, glass taps, aphrodisiacs, squeegee clean, mating, elder release, env toggles, poops)
    socket.on('player_action', (actionData) => {
        if (!actionData) return;
        const senderName = players[socket.id] ? players[socket.id].name : 'Aquarist';
        
        // If releasing elder frog-fish, broadcast system announcement
        if (actionData.type === 'release' && actionData.fishName) {
            broadcastChatMessage(
                'system',
                'System',
                `🌿 RELEASE CELEBRATION: Aquarist ${senderName} released ${actionData.fishName} (Elder Frog-Fish) into the wild! (+1000 PTS)`,
                true
            );
        }

        socket.broadcast.emit('remote_player_action', {
            ...actionData,
            senderId: socket.id,
            sender: senderName
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].name} left online lobby.`);
            broadcastChatMessage('system', 'System', `🚪 Aquarist ${players[socket.id].name} disconnected.`, true);
            delete players[socket.id];
            io.emit('player_left', { id: socket.id });
            io.emit('online_count', Object.keys(players).length);
        }
    });
});

// Start Server (Binds 0.0.0.0 for Railway / Container hosting)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CATFISH Railway Server running on port ${PORT} (http://0.0.0.0:${PORT})`);
});

