// index.js (Full Server Implementation)
const path = require('path');
const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io'); 
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app); 
const io = new Server(server); 

// --- Configuration (VPS Ready) ---\
const PORT = process.env.PORT || '53134'; 
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1444041775495778398'; 
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord`; 

// --- CORE GAME STATE (In-Memory) ---
const GameStates = {};

// Utility to generate a unique 4-letter lobby code
function generateLobbyCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
    } while (GameStates[code]); // Ensure the code is unique
    return code;
}

// --- FIX: Static Files Path ---\
// Serve all static files (CSS, JS) from the root directory (where index.js is)
app.use(express.static(path.join(__dirname, '.')));

// --- Express Routes ---\
app.get('/', (request, response) => {
	return response.sendFile('index.html', { root: '.' });
});

app.get('/auth/discord', (request, response) => {
	return response.sendFile('dashboard.html', { root: '.' });
});

// New route for the Host page
app.get('/host', (request, response) => {
    return response.sendFile('host.html', { root: '.' });
});

// --- Socket.IO Connection Handler ---
io.on('connection', (socket) => {
  
  // Event to join an existing lobby or create a new one
  socket.on('join_game', ({ discordUser, code }) => {
    let lobby;
    
    // 1. Validate Code existence
    if (code) {
        lobby = GameStates[code];
        if (!lobby) {
            return socket.emit('lobby_error', `Lobby code ${code} not found.`);
        }
    }
    
    // 2. Add or update player info
    const isHost = lobby ? lobby.hostId === discordUser.id : false;

    // Check if player is already in this lobby (reconnecting)
    const playerIndex = lobby ? lobby.players.findIndex(p => p.discordId === discordUser.id) : -1;
    
    if (playerIndex > -1) {
        // Update existing player's socket ID and connection status
        lobby.players[playerIndex].socketId = socket.id;
        lobby.players[playerIndex].isConnected = true; // Mark as reconnected
    } else {
        // 3. Add the new player
        const newPlayer = {
            discordId: discordUser.id,
            name: discordUser.name,
            avatar: discordUser.avatar,
            socketId: socket.id,
            isReady: false,
            isHost: isHost, // Only true if joining an existing lobby where they are the host
            isConnected: true,
            score: 0 // Initialize score
        };
        // If no lobby code was provided, this user is creating a new lobby from the host page
        if (!lobby) {
            code = generateLobbyCode();
            lobby = {
                lobbyCode: code,
                hostId: discordUser.id,
                players: [newPlayer],
                currentStage: 'LOBBY' // 'LOBBY', 'GAME_ACTIVE', 'GAME_END'
            };
            newPlayer.isHost = true;
            GameStates[code] = lobby;
            socket.emit('lobby_created', { lobbyCode: code });
        } else {
            lobby.players.push(newPlayer);
        }
    }
    
    // 4. Join the Socket.IO room
    socket.join(code);
    socket.data.lobbyCode = code;
    
    // 5. Broadcast the updated lobby list to everyone in this room
    io.to(code).emit('lobby_update', {
        lobbyCode: code,
        players: lobby.players,
        currentStage: lobby.currentStage
    });
  });

  socket.on('player_ready', () => {
    const code = socket.data.lobbyCode;
    const lobby = GameStates[code];
    if (!lobby) return;

    const player = lobby.players.find(p => p.socketId === socket.id);
    if (!player) return;

    // Toggle ready status
    player.isReady = !player.isReady;

    // Broadcast the updated lobby list
    io.to(code).emit('lobby_update', {
        lobbyCode: code,
        players: lobby.players,
        currentStage: lobby.currentStage
    });
  });
  
  socket.on('disconnect', () => {
    const code = socket.data.lobbyCode;
    if (code && GameStates[code]) {
        const lobby = GameStates[code];
        
        // Find the player who disconnected
        const playerIndex = lobby.players.findIndex(p => p.socketId === socket.id);
        
        if (playerIndex > -1) {
            const player = lobby.players[playerIndex];
            player.isConnected = false; // Mark as disconnected instead of removing

            // If the host disconnected, shut down the lobby (or transfer host, but for now, shut down)
            if (player.isHost) {
                 delete GameStates[code];
                 io.to(code).emit('lobby_error', 'Host has disconnected. The game has been closed.');
                 return;
            }
        }
        
        // Broadcast the updated lobby list
        io.to(code).emit('lobby_update', {
            lobbyCode: code,
            players: lobby.players,
            currentStage: lobby.currentStage
        });
        
        // Clean up empty lobbies (no connected players)
        if (lobby.players.every(p => !p.isConnected)) {
            // Give a short timeout before deleting an empty lobby to allow quick reconnects
             setTimeout(() => {
                if (GameStates[code] && GameStates[code].players.every(p => !p.isConnected)) {
                    console.log(`Lobby ${code} is empty. Deleting.`);
                    delete GameStates[code];
                }
             }, 30000); // 30 seconds to reconnect
        }
    }
  });
});

server.listen(PORT, () => console.log(`App listening on port ${PORT}`));