// auth.js (Handles Auth, Socket Connection, and Lobby Logic)

// DOM Elements
const joinSection = document.getElementById('join-section');
const lobbySection = document.getElementById('lobby-section');
const lobbyCodeInput = document.getElementById('lobby-code-input');
const enterLobbyButton = document.getElementById('enter-lobby-button');
const hostLobbyButton = document.getElementById('host-lobby-button');
const displayLobbyCode = document.getElementById('display-lobby-code');
const playerList = document.getElementById('player-list');
const readyButton = document.getElementById('ready-button');

let discordUser = null;
let socket = null;

// --- Helper Functions ---

/**
 * Constructs the correct Discord avatar URL, checking for GIF compatibility.
 * @param {string} userId - The Discord user ID.
 * @param {string} avatarHash - The user's avatar hash.
 * @returns {string} The full, correct URL for the user's avatar.
 */
function getDiscordAvatarUrl(userId, avatarHash) {
    if (!avatarHash) {
        return 'default_avatar.png'; 
    }
    
    // Check if the avatar hash indicates an animated GIF
    const isAnimated = avatarHash.startsWith('a_');
    const extension = isAnimated ? 'gif' : 'jpg';

    // Discord CDN format: /avatars/{user_id}/{avatar_hash}.{extension}?size={size}
    // We will use size=128 for good resolution, and format it correctly.
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=128`;
}


/**
 * Renders the list of players in the lobby.
 */
function renderPlayerList(players) {
    playerList.innerHTML = ''; // Clear existing players

    players.forEach(player => {
        // Construct the correct Discord avatar URL using the new helper function
        const avatarUrl = getDiscordAvatarUrl(player.discordId, player.avatar);

        // Add a class for the current user for visual distinction
        const isCurrentUser = player.discordId === discordUser.id ? 'current-user' : '';

        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';

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
 * Sets up the Socket.IO connection and all lobby event listeners.
 */
function setupLobbyListeners() {
    // 1. Establish Socket.IO Connection
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
        enterLobbyButton.disabled = false;
        hostLobbyButton.disabled = false;
        readyButton.disabled = false;
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        enterLobbyButton.disabled = true;
        hostLobbyButton.disabled = true;
        readyButton.disabled = true;
    });
    
    socket.on('connect_error', (err) => {
        console.error('Socket.IO Connection Error:', err.message);
        alert('Failed to connect to the game server. Please try refreshing the page.');
    });

    // 2. Event Listeners for UI Actions

    // NEW: Host Lobby button listener
    hostLobbyButton.addEventListener('click', () => {
        hostLobbyButton.disabled = true;
        enterLobbyButton.disabled = true;

        // Emit host request to server
        socket.emit('host_game', { discordUser: discordUser });
    });

    // Join Lobby button listener
    enterLobbyButton.addEventListener('click', () => {
        const code = lobbyCodeInput.value.toUpperCase();
        if (code.length === 4) {
            // Disable buttons to prevent double-click while waiting for server response
            enterLobbyButton.disabled = true; 
            hostLobbyButton.disabled = true;
            
            // Send join request to server
            socket.emit('join_game', {
                code,
                discordUser: discordUser
            });
        } else {
            alert('Please enter a 4-character lobby code.');
        }
    });

    // Input change listener to enable/disable join button
    lobbyCodeInput.addEventListener('input', () => {
        enterLobbyButton.disabled = lobbyCodeInput.value.length !== 4;
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

        // Re-enable the join/host buttons in case the user was just joining/hosting
        enterLobbyButton.disabled = false;
        hostLobbyButton.disabled = false;
        
        // Update the display code and player list
        displayLobbyCode.innerText = lobbyCode;
        renderPlayerList(players);
    });

    // Handle errors from the server when trying to join/host
    socket.on('lobby_error', (message) => {
        alert(message); // Show error message to user
        
        // Re-enable buttons if an error occurs
        enterLobbyButton.disabled = false;
        hostLobbyButton.disabled = false;
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
            avatar: user.avatar // This hash is now checked for 'a_' prefix
        };

        // Display user info
        document.getElementById("name").innerText = discordUser.name;
        
        // Use the new helper function for the main avatar as well
        const avatarUrl = getDiscordAvatarUrl(discordUser.id, discordUser.avatar);

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
