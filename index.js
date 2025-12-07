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

// --- NEW IMPORTS ---
const { GameEngine, GameStage } = require('./GameEngine');
const roundsData = require('./roundsData'); // Import mock game data

// --- Configuration (VPS Ready) ---\
const PORT = process.env.PORT || '53134'; 
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1444041775495778398'; 
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord`; 

// --- CORE GAME STATE (In-Memory) ---
// CHANGE: Store GameEngine instances instead of plain objects
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

app.get('/host', (request, response) => {
    return response.sendFile('host.html', { root: '.' });
});

app.get('/editor', (request, response) => {
    return response.sendFile('editor.html', { root: '.' });
});

app.get('/game', (request, response) => {
    return response.sendFile('game_view.html', { root: '.' });
});

// --- Socket.IO Connection Handler ---
io.on('connection', (socket) => {
  
  // Event to join an existing lobby or create a new one
  socket.on('join_game', ({ discordUser, code, isHostRequest = false }) => { // Added isHostRequest
    let gameEngine = GameStates[code];
    
    // 1. Validate Code existence for non-host join
    if (code && !isHostRequest) {
        if (!gameEngine) {
            return socket.emit('lobby_error', `Lobby code ${code} not found.`);
        }
    }
    
    // 2. Add or update player info
    let player = gameEngine ? gameEngine.players.find(p => p.discordId === discordUser.id) : null;
    const isNewPlayer = !player;
    
    if (player) {
        // Update existing player's socket ID and connection status
        player.socketId = socket.id;
        player.isConnected = true; 
    } else {
        // Create the new player (Note: GameEngine.js Player class handles default properties)
        const { Player } = require('./GameEngine'); // Import Player model
        player = new Player(discordUser, socket.id);
        
        // If no lobby code was provided OR it's a HOST request, create a new lobby
        if (isHostRequest || !code) {
            code = generateLobbyCode();
            
            // Player becomes the host
            player.isHost = true; 
            
            // Initialize the GameEngine with imported game data
            gameEngine = new GameEngine(io, code, roundsData, [player]); 
            GameStates[code] = gameEngine;

            socket.emit('lobby_created', { lobbyCode: code });
        } else if (gameEngine) {
            // Joining an existing game
            gameEngine.players.push(player);
        } else {
            // Should not happen if logic is correct, but for safety:
            return socket.emit('lobby_error', 'Failed to join or create lobby.');
        }
    }
    
    // 3. Join the Socket.IO room
    socket.join(code);
    socket.data.lobbyCode = code;
    socket.data.discordId = discordUser.id; // Store ID for quicker lookup on disconnect
    
    // 4. Broadcast the updated lobby list/state
    io.to(code).emit('lobby_update', {
        lobbyCode: code,
        players: gameEngine.getSanitizedPlayers(), // Use GameEngine helper
        currentStage: gameEngine.currentStage,
        isHost: player.isHost || false // Send host status to the joining client
    });
  });

  // NEW: Host-only event to start the game
  socket.on('start_game', () => {
    const code = socket.data.lobbyCode;
    const gameEngine = GameStates[code];
    if (!gameEngine) return;
    
    const player = gameEngine.players.find(p => p.socketId === socket.id);
    
    // Security check: Only the host can start the game (we need to update the Player model or logic to track host better)
    // For now, let's assume the host player object has an 'isHost' property set on creation/join
    // Assuming the host is the one who created the lobby:
    if (gameEngine.players[0].discordId !== socket.data.discordId) { 
        return socket.emit('lobby_error', 'Only the host can start the game.');
    }

    gameEngine.startGame();
  });
  
  // FIX: Change 'player_ready' event name to 'set_ready' to match auth.js
  socket.on('set_ready', ({ isReady }) => { 
    const code = socket.data.lobbyCode;
    const gameEngine = GameStates[code];
    if (!gameEngine) return;

    const player = gameEngine.players.find(p => p.socketId === socket.id);
    if (!player) return;

    // Set ready status based on the client request payload
    player.isReady = isReady; 

    // Broadcast the updated lobby list (the game engine handles emitting the lobby_update)
    io.to(code).emit('lobby_update', {
        lobbyCode: code,
        players: gameEngine.getSanitizedPlayers(),
        currentStage: gameEngine.currentStage
    });
  });

  // NEW: Event for players to submit an answer
  socket.on('submit_answer', ({ answer }) => {
      const code = socket.data.lobbyCode;
      const gameEngine = GameStates[code];
      if (!gameEngine) return;

      gameEngine.processPlayerAnswer(socket.id, answer);
  });
  
  socket.on('disconnect', () => {
    const code = socket.data.lobbyCode;
    const gameEngine = GameStates[code]; // Get GameEngine instance
    
    if (code && gameEngine) {
        // Let the GameEngine handle the disconnect logic
        const player = gameEngine.players.find(p => p.socketId === socket.id);
        
        if (player) {
            // If the host disconnected, shut down the lobby
            if (player.isHost) {
                 delete GameStates[code];
                 io.to(code).emit('lobby_error', 'Host has disconnected. The game has been closed.');
                 return;
            }
            
            // Non-host player: mark as disconnected
            player.isConnected = false; 

            // Broadcast the updated lobby list
            io.to(code).emit('lobby_update', {
                lobbyCode: code,
                players: gameEngine.getSanitizedPlayers(),
                currentStage: gameEngine.currentStage
            });
            
            // Clean up empty lobbies (no connected players)
            if (gameEngine.players.every(p => !p.isConnected)) {
                 setTimeout(() => {
                    if (GameStates[code] && GameStates[code].players.every(p => !p.isConnected)) {
                        console.log(`Lobby ${code} is empty. Deleting.`);
                        delete GameStates[code];
                    }
                 }, 30000); // 30 seconds to reconnect
            }
        }
    }
  });
});

server.listen(PORT, () => console.log(`App listening on port ${PORT}`));