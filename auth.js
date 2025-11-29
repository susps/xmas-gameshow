// auth.js (Handles Auth, Socket Connection, and Lobby Logic)

// DOM Elements
const joinSection = document.getElementById('join-section');
const lobbySection = document.getElementById('lobby-section');
const lobbyCodeInput = document.getElementById('lobby-code-input');
const enterLobbyButton = document.getElementById('enter-lobby-button');
const readyButton = document.getElementById('ready-button');
const displayLobbyCode = document.getElementById('display-lobby-code');
const playerList = document.getElementById('player-list');
const errorBanner = document.getElementById('error-banner');

let discordUser = null;
let socket = null;
const SERVER_URL = `http://localhost:53134`; // Use the default port

// --- Utility Functions ---

/**
 * Shows a temporary error message in the UI.
 */
function displayError(message) {
    errorBanner.textContent = message;
    errorBanner.style.display = 'block';
    setTimeout(() => {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
    }, 5000);
}

/**
 * Renders the list of players in the lobby.
 */
function renderPlayerList(players, myId) {
    playerList.innerHTML = ''; // Clear existing players

    players.sort((a, b) => b.score - a.score).forEach(player => {
        const isMe = player.discordId === myId;
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${isMe ? 'player-me' : ''} ${!player.isConnected ? 'player-disconnected' : ''}`;
        
        // Construct Discord avatar URL
        const avatarUrl = player.avatar ? 
            `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.jpg` : 
            `https://placehold.co/128x128/FF0000/FFFFFF?text=${player.name.charAt(0)}`;

        playerCard.innerHTML = `
            <img src="${avatarUrl}" alt="${player.name}'s avatar" class="player-avatar" />
            <div class="player-info">
                <div class="player-name">${player.name}${isMe ? ' (You)' : ''}</div>
                <div class="player-score">Score: ${player.score || 0}</div>
            </div>
            <div class="player-status-container">
                <div class="player-status ${player.isReady ? 'ready' : 'waiting'}">
                    ${!player.isConnected ? 'DISCONNECTED' : (player.isReady ? 'READY' : 'WAITING')}
                </div>
            </div>
        `;
        playerList.appendChild(playerCard);
    });
}

/**
 * Handles all Socket.IO events for the lobby and game flow.
 */
function setupLobbyListeners() {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        console.log("Connected to server via Socket.IO");
        // Re-emit join_game if user was already in a lobby (e.g., after a disconnect)
        const lobbyCode = localStorage.getItem('lobbyCode');
        if (lobbyCode) {
            joinLobby(lobbyCode);
        }
    });

    socket.on('connect_error', (err) => {
        console.error("Socket.IO connection error:", err);
        displayError("Could not connect to the game server. Please try refreshing.");
        enterLobbyButton.disabled = false;
        readyButton.disabled = true;
    });

    // Event received when a new lobby is created (only for the creator)
    socket.on('lobby_created', (data) => {
        console.log(`Lobby created: ${data.lobbyCode}`);
        localStorage.setItem('lobbyCode', data.lobbyCode);
        displayLobbyCode.innerText = data.lobbyCode;
    });

    // Event received when the lobby state or player list changes
    socket.on('lobby_update', (data) => {
        const { lobbyCode, players, currentStage } = data;
        console.log('Lobby Update:', data);
        
        localStorage.setItem('lobbyCode', lobbyCode);
        displayLobbyCode.innerText = lobbyCode;
        renderPlayerList(players, discordUser.id);

        if (currentStage === 'LOBBY') {
            joinSection.style.display = 'none';
            lobbySection.style.display = 'flex';
            
            // Enable ready button once in a lobby
            readyButton.disabled = false;
            
            // Update ready button text based on current player's state
            const currentPlayer = players.find(p => p.discordId === discordUser.id);
            if (currentPlayer) {
                readyButton.textContent = currentPlayer.isReady ? 'UNREADY' : 'READY';
                readyButton.classList.toggle('unready', currentPlayer.isReady);
            }
        } else if (currentStage !== 'LOBBY') {
            // Game is starting or in progress
            console.log("Game started! Redirecting to game board...");
            // Use local storage to pass necessary info (Discord user + lobby code)
            sessionStorage.setItem('game_start_data', JSON.stringify({ 
                discordUser, 
                lobbyCode,
                // Pass player scores from the initial update to maintain consistency
                players: players 
            })); 
            window.location.href = `/game.html?code=${lobbyCode}`;
        }
    });
    
    // Event received on specific errors (e.g., lobby not found)
    socket.on('lobby_error', (message) => {
        console.error('Lobby Error:', message);
        displayError(message);
        enterLobbyButton.disabled = false;
    });
    
    // --- Game Flow Events (For Rejoin) ---
    
    // If a player joins a game already in progress
    socket.on('rejoin_game_state', (data) => {
        console.log("Rejoining active game. Redirecting to game board...");
        sessionStorage.setItem('game_start_data', JSON.stringify({ 
            discordUser, 
            lobbyCode: data.lobbyCode,
            rejoinState: data // Pass full game state for re-sync
        })); 
        window.location.href = `/game.html?code=${data.lobbyCode}`;
    });

    // --- Lobby UI Interaction Handlers ---
    
    enterLobbyButton.addEventListener('click', () => {
        const lobbyCode = lobbyCodeInput.value.toUpperCase().trim();
        enterLobbyButton.disabled = true; // Prevent spamming
        joinLobby(lobbyCode);
    });

    readyButton.addEventListener('click', () => {
        if (socket && discordUser) {
            socket.emit('player_ready');
        }
    });
}

/**
 * Emits the join_game event to the server.
 */
function joinLobby(code) {
    if (socket && discordUser) {
        socket.emit('join_game', {
            discordUser: {
                id: discordUser.id,
                name: discordUser.name,
                avatar: discordUser.avatar
            },
            code: code // Will be '' for creating a new lobby
        });
    } else {
        displayError("Authentication failed or socket not ready. Please refresh.");
        enterLobbyButton.disabled = false;
    }
}


// --- INITIAL AUTHENTICATION AND SETUP ---\
window.addEventListener('load', () => {
    // 1. Get Discord OAuth Token from hash fragment
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const tokenType = fragment.get("token_type");
    
    // Clear hash from URL to prevent token logging
    window.history.replaceState({}, document.title, window.location.pathname);

    if (!accessToken) {
        // If no token, redirect back to login page
        window.location.href = "/index.html";
        return;
    }
    
    // 2. Load Socket.IO client script dynamically
    const socketIoScript = document.createElement('script');
    socketIoScript.src = `${SERVER_URL}/socket.io/socket.io.js`;
    socketIoScript.onload = () => {
        // 3. Fetch user data from Discord
        fetch("https://discord.com/api/users/@me", {
            headers: { authorization: `${tokenType} ${accessToken}` },
        })
        .then(r => {
            if (!r.ok) throw new Error("Discord API call failed");
            return r.json();
        })
        .then(user => {
            // Store user info
            discordUser = {
                id: user.id,
                name: `${user.username}#${user.discriminator}`,
                avatar: user.avatar
            };

            // Display user info
            document.getElementById("name").innerText = discordUser.name;
            document.getElementById("avatar").src =
                `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.jpg`;
            
            // Setup Socket.IO connection and lobby events
            setupLobbyListeners();

        })
        .catch(error => {
            console.error("Auth process error:", error);
            displayError("Failed to fetch Discord user data. Please try logging in again.");
            setTimeout(() => window.location.href = "/index.html", 3000);
        });
    };
    document.head.appendChild(socketIoScript);
});