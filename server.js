/**
 * CATFISH - Evolutionary Simulation & Multiplayer Backend Server
 * Express web server with Socket.io real-time multiplayer, global leaderboards,
 * and Railway container hosting support.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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

// Helper: Save Leaderboard Data (keeps all registered players, sorted by points)
function saveLeaderboard(board) {
    try {
        // Sort descending by points
        board.sort((a, b) => (b.points || 0) - (a.points || 0));
        // Keep up to 1000 players so every player is tracked
        const trimmed = board.slice(0, 1000);
        fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
        return trimmed;
    } catch (err) {
        console.error("Error writing leaderboard.json:", err);
        return board;
    }
}

// Helper: Add or Update Leaderboard Entry in Real-Time
function updateOrAddLeaderboardEntry(name, points = 0, generation = 1, released = 0) {
    if (!name || !name.trim()) return getLeaderboard();

    const cleanName = name.trim().substring(0, 24);
    const currentBoard = getLeaderboard();
    const existingIndex = currentBoard.findIndex(entry => entry.name.toLowerCase() === cleanName.toLowerCase());

    const entryData = {
        name: cleanName,
        points: Math.max(0, Math.floor(points)),
        generation: Math.max(1, generation || 1),
        released: Math.max(0, released || 0),
        date: new Date().toISOString().split('T')[0]
    };

    let boardChanged = false;
    if (existingIndex >= 0) {
        if (entryData.points >= currentBoard[existingIndex].points) {
            currentBoard[existingIndex] = {
                ...currentBoard[existingIndex],
                ...entryData
            };
            boardChanged = true;
        }
    } else {
        currentBoard.push(entryData);
        boardChanged = true;
    }

    if (boardChanged) {
        const updatedBoard = saveLeaderboard(currentBoard);
        io.emit('leaderboard_update', updatedBoard);
        return updatedBoard;
    }
    return currentBoard;
}

// REST APIs
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', onlinePlayers: Object.keys(players).length, timestamp: new Date().toISOString() });
});

app.get('/api/leaderboard', (req, res) => {
    res.json(getLeaderboard());
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

io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // Send current leaderboard & online count on connect
    socket.emit('leaderboard_update', getLeaderboard());
    io.emit('online_count', Object.keys(players).length);

    // Player registers fish & name into online lobby
    socket.on('join_online_lobby', (playerData) => {
        players[socket.id] = {
            id: socket.id,
            name: playerData.name || `Aquarist_${socket.id.substring(0, 4)}`,
            fish: playerData.fish || [],
            points: playerData.points || 0,
            generation: playerData.generation || 1,
            joinedAt: Date.now()
        };

        console.log(`🌊 ${players[socket.id].name} joined global aquarium lobby.`);

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
        if (players[socket.id]) {
            players[socket.id].fish = data.fish;
            players[socket.id].points = data.points;
            players[socket.id].generation = data.generation;

            // Sync score & stats to real-time leaderboard
            updateOrAddLeaderboardEntry(
                players[socket.id].name,
                data.points,
                data.generation,
                data.released || 0
            );

            socket.broadcast.emit('remote_fish_update', {
                playerId: socket.id,
                playerName: players[socket.id].name,
                fish: data.fish,
                points: data.points,
                generation: data.generation
            });
        }
    });

    // Global Multiplayer Live Chat Relay
    socket.on('send_global_chat', (data) => {
        if (!data || !data.text || !data.text.trim()) return;
        const senderName = players[socket.id] ? players[socket.id].name : 'Aquarist';
        const msgPayload = {
            senderId: socket.id,
            sender: senderName,
            text: data.text.trim().substring(0, 300),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        console.log(`💬 [Live Chat] ${senderName}: ${msgPayload.text}`);
        io.emit('receive_global_chat', msgPayload);
    });

    // Multiplayer Action Relay (e.g. feeding pellets or releasing hearts in public tank)
    socket.on('player_action', (actionData) => {
        const senderName = players[socket.id] ? players[socket.id].name : 'Aquarist';
        socket.broadcast.emit('remote_player_action', {
            sender: senderName,
            type: actionData.type,
            x: actionData.x,
            y: actionData.y
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].name} left online lobby.`);
            delete players[socket.id];
            io.emit('player_left', { id: socket.id });
            io.emit('online_count', Object.keys(players).length);
        }
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 CATFISH Server running on http://localhost:${PORT}`);
});
