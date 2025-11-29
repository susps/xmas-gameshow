// index.js (Full Server Implementation)
const path = require('path');
const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io'); 

const app = express();
// Create an HTTP server instance from the Express app
const server = http.createServer(app); 
// Initialize Socket.IO to work with the HTTP server
const io = new Server(server, {
    cors: {
        // Allows connections from all origins for local development/testing
        // For production, you would restrict this to your actual domain
        origin: "*", 
        methods: ["GET", "POST"]
    }
}); 

// --- Configuration (VPS Ready) ---
// Use environment variable PORT if available (e.g., from Render/Heroku), otherwise default
const PORT = process.env.PORT || '53134'; 
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1444041775495778398'; 
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord`; 

// --- CORE GAME STATE (In-Memory) ---
// Stores lobby objects, indexed by a 4-character code.
// { 'ABCD': { players: [{discordId, name, socketId, isReady}, ...], hostId: 'discordId' } }
const GameStates = {};

// --- Utility Functions ---

/**
 * Generates a unique 4-character uppercase letter code.
 */
function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (GameStates[code]); // Ensure the code is not already in use
    return code;
}

/**
 * Creates and returns a standardized player object.
 * @param {Object} discordUser - The user data from Discord (id, name, avatar).
 * @param {string} socketId - The Socket.IO ID for the current connection.
 * @returns {Object} A new player object.
 */
function createPlayer(discordUser, socketId) {
    return {
        discordId: discordUser.id,
        name: discordUser.name,
        avatar: discordUser.avatar,
        socketId: socketId,
        isReady: false
    };
}

/**
 * Broadcasts the current state of a lobby to all players in its room.
 * @param {string} code - The lobby code.
 */
function broadcastLobbyUpdate(code) {
    const lobby = GameStates[code];
    if (lobby) {
        io.to(code).emit('lobby_update', {
            lobbyCode: code,
            players: lobby.players
        });
    }
}

// --- FIX: Static Files Path ---
// Serve all static files (CSS, JS) from the root directory (where index.js is)
app.use(express.static(path.join(__dirname, '.')));

// --- Express Routes ---
app.get('/', (request, response) => {
	return response.sendFile('index.html', { root: '.' });
});

// The client-side redirect URL after Discord authentication
app.get('/auth/discord', (request, response) => {
	// The client-side (auth.js) will handle parsing the token from the URL hash
	return response.sendFile('dashboard.html', { root: '.' });
});

// --- Socket.IO Connection Handler ---
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // --- HOST GAME ---
    socket.on('host_game', ({ discordUser }) => {
        const code = generateCode();
        
        // 1. Create a new lobby state
        const hostPlayer = createPlayer(discordUser, socket.id);
        
        GameStates[code] = {
            players: [hostPlayer],
            hostId: discordUser.id,
            status: 'waiting'
        };

        // 2. Join the Socket.IO room for this lobby
        socket.join(code);
        // Store the lobby code on the socket for easy lookup on disconnect
        socket.data.lobbyCode = code;

        console.log(`Lobby created by ${discordUser.name}. Code: ${code}`);
        
        // 3. Send the updated lobby list to the host
        broadcastLobbyUpdate(code);
    });

    // --- JOIN GAME ---
    socket.on('join_game', ({ code, discordUser }) => {
        code = code.toUpperCase();
        const lobby = GameStates[code];

        // 1. Check if lobby exists
        if (!lobby) {
            return socket.emit('lobby_error', `Lobby code ${code} is invalid or has expired.`);
        }

        // 2. Check if player is already in this lobby (reconnecting)
        let playerIndex = lobby.players.findIndex(p => p.discordId === discordUser.id);
        
        if (playerIndex > -1) {
            // Player is already in the lobby, just update their socket ID
            lobby.players[playerIndex].socketId = socket.id;
        } else {
            // 3. Add the new player
            const newPlayer = createPlayer(discordUser, socket.id);
            lobby.players.push(newPlayer);
        }
        
        // 4. Join the Socket.IO room
        socket.join(code);
        socket.data.lobbyCode = code;
        
        console.log(`${discordUser.name} joined lobby ${code}.`);
        
        // 5. Broadcast the updated lobby list to everyone in this room
        broadcastLobbyUpdate(code);
    });

    // --- SET READY STATUS ---
    socket.on('set_ready', ({ isReady }) => {
        const code = socket.data.lobbyCode;
        const lobby = GameStates[code];

        if (lobby) {
            // Find the player by socket ID and update their ready status
            const player = lobby.players.find(p => p.socketId === socket.id);
            if (player) {
                player.isReady = isReady;
                console.log(`${player.name} in lobby ${code} set ready status to: ${isReady}`);

                // Broadcast the change to the whole lobby
                broadcastLobbyUpdate(code);

                // TODO: Add logic here to check if all players are ready, and if so, emit 'start_game'
            }
        }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        const code = socket.data.lobbyCode;
        
        if (code && GameStates[code]) {
            const lobby = GameStates[code];
            
            // Remove the player from the lobby state
            lobby.players = lobby.players.filter(p => p.socketId !== socket.id);
            
            console.log(`Client ${socket.id} disconnected from lobby ${code}. Players left: ${lobby.players.length}`);
            
            if (lobby.players.length === 0) {
                // If the lobby is empty, remove it from the game state
                delete GameStates[code];
                console.log(`Lobby ${code} is empty and has been removed.`);
            } else {
                // Otherwise, broadcast the updated lobby list
                broadcastLobbyUpdate(code);
            }
        } else {
             console.log(`Client ${socket.id} disconnected, not in a lobby.`);
        }
    });
});

// Start the HTTP Server and Socket.IO listener
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Redirect URI set to: ${DISCORD_REDIRECT_URI}`);
});
