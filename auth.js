// auth.js (Handles Auth, Socket Connection, and Lobby Logic)

// DOM Elements
const joinSection = document.getElementById('join-section');
const lobbySection = document.getElementById('lobby-section');
const lobbyCodeInput = document.getElementById('lobby-code-input');
const enterLobbyButton = document.getElementById('enter-lobby-button');
const displayLobbyCode = document.getElementById('display-lobby-code');
const playerList = document.getElementById('player-list');
const readyButton = document.getElementById('ready-button');

let discordUser = null;
let socket = null;

// --- Helper Functions ---

/**
 * Renders the list of players in the lobby.
 */
function renderPlayerList(players) {
    playerList.innerHTML = ''; // Clear existing players

    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        // Construct Discord avatar URL
        const avatarUrl = player.avatar ? 
            `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.jpg` : 
            'default_avatar.png'; 

        // Add a class for the current user for visual distinction
        const isCurrentUser = player.discordId === discordUser.id ? 'current-user' : '';

        playerCard.innerHTML = `
            <img src="${avatarUrl}" alt="${player.name}'s avatar" class="player-avatar" />
            <div class="player-name ${isCurrentUser}">${player.name}</div>
            <div class="player-status ${player.isReady ? 'ready' : 'waiting'}">
                ${player.isReady ? 'READY' : 'WAITING'}
            </div>
        `;
        playerList.appendChild(playerCard);
    });
}

/**
 * Hides the join section and shows the lobby section.
 * @param {string} code The lobby code
 */
function enterLobbyView(code) {
    joinSection.style.display = 'none';
    lobbySection.style.display = 'block';
    displayLobbyCode.innerText = code;
}

/**
 * Fixes the Socket.IO connection error by not hardcoding the port.
 * When deployed to Render, the client should connect to the current origin (https://domain.com)
 */
function setupLobbyListeners() {
    // 1. Establish Socket.IO Connection
    // FIX: Call io() with no arguments to connect to the host that served the page.
    // This is crucial for environments like Render that use a reverse proxy 
    // and where hardcoding the internal port (like :53134) causes a timeout.
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
        enterLobbyButton.disabled = false;
        readyButton.disabled = false;
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        enterLobbyButton.disabled = true;
        readyButton.disabled = true;
    });
    
    // Listen for connection errors
    socket.on('connect_error', (err) => {
        console.error('Socket.IO Connection Error:', err.message);
        // Display a user-friendly error message
        alert('Failed to connect to the game server. Please try refreshing the page.');
    });

    // 2. Event Listeners for UI Actions
    enterLobbyButton.addEventListener('click', () => {
        const code = lobbyCodeInput.value.toUpperCase();
        if (code.length === 4) {
            // Disable button to prevent double-click while waiting for server response
            enterLobbyButton.disabled = true; 
            
            // Send join request to server
            socket.emit('join_game', {
                code,
                discordUser: discordUser
            });
        } else {
            alert('Please enter a 4-character lobby code.');
        }
    });

    readyButton.addEventListener('click', () => {
        // Toggle the ready state and inform the server
        const isCurrentlyReady = readyButton.dataset.ready === 'true';
        socket.emit('set_ready', { isReady: !isCurrentlyReady });
    });

    // 3. Socket.IO Event Handlers
    
    // Receive updated lobby data
    socket.on('lobby_update', (data) => {
        const { lobbyCode, players } = data;
        
        // Find the current user's ready status
        const currentUser = players.find(p => p.discordId === discordUser.id);
        if (currentUser) {
            readyButton.dataset.ready = currentUser.isReady;
            readyButton.innerHTML = currentUser.isReady ? 
                '<i class="fa-solid fa-hourglass-half"></i><span>WAITING</span>' : 
                '<i class="fa-solid fa-play"></i><span>READY</span>';
        }

        // Switch to lobby view and render list
        enterLobbyView(lobbyCode);

        // Re-enable the join button in case the user was just joining (and clicks again or rejoins)
        enterLobbyButton.disabled = false;
        
        // Update the display code and player list
        displayLobbyCode.innerText = lobbyCode;
        renderPlayerList(players);
    });
}


// --- INITIAL AUTHENTICATION AND SETUP ---
window.addEventListener('load', () => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const tokenType = fragment.get("token_type");

    if (!accessToken) {
        // Redirect to login if token is missing (not authenticated)
        window.location.href = "/index.html"; 
        return;
    }

    // Fetch user data from Discord
    fetch("https://discord.com/api/users/@me", {
        headers: { authorization: `${tokenType} ${accessToken}` },
    })
    .then(r => r.json())
    .then(user => {
        // Store user info
        discordUser = {
            id: user.id,
            name: `${user.username}#${user.discriminator}`,
            avatar: user.avatar
        };

        // Display user info
        document.getElementById("name").innerText = discordUser.name;
        // Construct the full avatar URL
        const avatarUrl = user.avatar ? 
            `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.jpg` : 
            'default_avatar.png'; // Fallback

        document.getElementById("avatar").src = avatarUrl;
        
        // Setup Socket.IO connection and lobby events
        setupLobbyListeners();

    })
    .catch(error => {
        console.error("Discord API fetch error:", error);
        // In case of error, redirect to login page
        window.location.href = "/index.html"; 
    });
});
