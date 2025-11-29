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

        playerCard.innerHTML = `
            <img src="${avatarUrl}" alt="${player.name}'s avatar" class="player-avatar" />
            <div class="player-name">${player.name}</div>
            <div class="player-status ${player.isReady ? 'ready' : 'waiting'}">
                ${player.isReady ? 'READY' : 'WAITING'}
            </div>
        `;
        playerList.appendChild(playerCard);
    });
}

/**
 * Sets up the Socket.IO connection and client-side listeners.
 */
function setupLobbyListeners() {
    // FIX 2: Initialize the socket connection to the server
    socket = io(); 

    // Event listener for errors
    socket.on('lobby_error', (message) => {
        console.error('Lobby Error:', message);
        alert(message); // Using alert for now, should be replaced with a proper modal
    });
    
    // Event listener for lobby updates
    socket.on('lobby_update', ({ lobbyCode, players, currentStage }) => {
        // Enable the ready button once a lobby is established
        readyButton.disabled = false;
        
        // Ensure the join section is hidden and lobby is visible
        joinSection.style.display = 'none';
        lobbySection.style.display = 'block';

        // Re-enable the enter button (in case user clicks again or rejoins)
        enterLobbyButton.disabled = false;
        
        // Update the display code and player list
        displayLobbyCode.innerText = lobbyCode;
        renderPlayerList(players);
    });

    // Handle button clicks to join or create a game
    enterLobbyButton.addEventListener('click', () => {
        const code = lobbyCodeInput.value.toUpperCase().trim();
        if (!code && enterLobbyButton.innerText.includes('Join')) {
            alert("Please enter a 4-digit lobby code.");
            return;
        }

        enterLobbyButton.disabled = true;

        // Send a request to the server to join or create a game
        socket.emit('join_game', { 
            discordUser: discordUser, 
            code: code 
        });
    });

    readyButton.addEventListener('click', () => {
        socket.emit('player_ready');
    });
}


// --- INITIAL AUTHENTICATION AND SETUP ---\
window.addEventListener('load', () => {
    // Check if we are on the dashboard page (after Discord redirect)
    const url = new URL(window.location.href);
    if (url.pathname !== '/auth/discord') {
        // If not on the redirect path, don't run auth/socket logic
        return; 
    }

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const tokenType = fragment.get("token_type");

    if (!accessToken) {
        // If token is missing, redirect back to the login page
        window.location.href = "/"; // Use root path instead of index.html
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
            // Use avatar hash to construct the full URL
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
        console.error("Error fetching Discord user data:", error);
        // On error, redirect back to login
        window.location.href = "/";
    });
});