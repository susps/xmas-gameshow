// auth.js (Modified)

// DOM Elements
const joinSection = document.getElementById('join-section'); // Only on dashboard.html
const lobbySection = document.getElementById('lobby-section'); // Only on dashboard.html
const lobbyCodeInput = document.getElementById('lobby-code-input'); // Only on dashboard.html
const enterLobbyButton = document.getElementById('enter-lobby-button'); // Only on dashboard.html
const hostLobbyButton = document.getElementById('host-lobby-button'); // Only on dashboard.html

const displayLobbyCode = document.getElementById('display-lobby-code');
const playerList = document.getElementById('player-list');
const readyButton = document.getElementById('ready-button'); // Only on dashboard.html
// NEW Host Elements
const startGameButton = document.getElementById('start-game-button'); // Only on host.html
const readyStatusText = document.getElementById('ready-status-text'); // Only on host.html

let discordUser = null;
let socket = null;
let currentLobbyCode = null;
let isHost = false; // NEW state flag

// --- Helper Functions ---

/**
 * Renders the list of players in the lobby.
 */
function renderPlayerList(players) {
    playerList.innerHTML = ''; // Clear existing players
    
    // Host page specific: Calculate ready status
    const readyPlayers = players.filter(p => p.isReady).length;
    const totalConnectedPlayers = players.filter(p => p.isConnected).length;

    if (window.IS_HOST_PAGE && readyStatusText) {
        readyStatusText.innerText = `${readyPlayers}/${totalConnectedPlayers} players ready.`;
        // Enable start button if at least 2 players are ready and game is in LOBBY stage
        startGameButton.disabled = readyPlayers < 2; 
    }

    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        // Construct Discord avatar URL
        const avatarUrl = player.avatar ? 
            `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.jpg` : 
            'default_avatar.png'; 

        // Add a class for the current user for visual distinction
        const isCurrentUser = player.discordId === discordUser.id ? 'current-user' : '';

        // Host info for Host page
        const hostTag = player.isHost ? '<span class="host-tag"><i class="fa-solid fa-crown"></i> HOST</span>' : '';

        playerCard.innerHTML = `
            <img src="${avatarUrl}" alt="${player.name}'s avatar" class="player-avatar ${player.isConnected ? '' : 'disconnected-avatar'}" />
            <div class="player-name ${isCurrentUser}">${player.name} ${hostTag}</div>
            <div class="player-status ${player.isReady ? 'ready' : (player.isConnected ? 'waiting' : 'disconnected')}">
                ${player.isReady ? 'READY' : (player.isConnected ? 'WAITING' : 'DISCONNECTED')}
            </div>
        `;
        playerList.appendChild(playerCard);
    });
}

/**
 * Hides the join section and shows the lobby section (Dashboard Player View).
 * @param {string} code The lobby code
 */
function enterLobbyView(code) {
    if (joinSection && lobbySection) { // Check if on dashboard.html
        joinSection.style.display = 'none';
        lobbySection.style.display = 'block';
    }
    displayLobbyCode.innerText = code;
    currentLobbyCode = code;
}

/**
 * Connects to Socket.IO and sets up all event listeners.
 */
function setupLobbyListeners() {
    // 1. Establish Socket.IO Connection
    socket = io();

    socket.on('lobby_update', (data) => {
        const { lobbyCode, players, currentStage } = data;
        
        // --- Shared Logic ---
        displayLobbyCode.innerText = lobbyCode;
        renderPlayerList(players);

        // --- Player Page (Dashboard) Logic ---
        if (!window.IS_HOST_PAGE) {
             enterLobbyView(lobbyCode);
             const currentUser = players.find(p => p.discordId === discordUser.id);
             if (currentUser) {
                 // Update ready button state
                 readyButton.dataset.ready = currentUser.isReady;
                 readyButton.innerHTML = currentUser.isReady ? 
                     '<i class="fa-solid fa-hourglass-half"></i><span>WAITING</span>' : 
                     '<i class="fa-solid fa-play"></i><span>READY</span>';
             }
             
             // Check if the game has started (stage moves beyond LOBBY/WAITING_FOR_READY)
             if (currentStage !== 'LOBBY' && currentStage !== 'WAITING_FOR_READY') {
                 // REDIRECT TO GAME VIEW
                 window.location.href = "/game?code=" + lobbyCode + window.location.hash;
             }
        } 
        
        // --- Host Page Logic ---
        if (window.IS_HOST_PAGE) {
             if (currentStage !== 'LOBBY' && currentStage !== 'WAITING_FOR_READY') {
                 // Host will typically have a different view, but for now, they can stay on host page or be redirected
                 // For now, let the host stay on host.html to manually advance rounds (in a future step).
                 // The "temporary alert" should be removed or replaced with host game control UI.
                 console.log(`Game started. Current stage: ${currentStage}`);
                 startGameButton.style.display = 'none'; // Hide start button once game is underway
             } else {
                 startGameButton.disabled = players.filter(p => p.isReady).length < 2;
                 startGameButton.style.display = 'block';
             }
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        if (enterLobbyButton) enterLobbyButton.disabled = true;
        if (hostLobbyButton) hostLobbyButton.disabled = true;
        if (readyButton) readyButton.disabled = true;
        if (startGameButton) startGameButton.disabled = true;
    });
    
    socket.on('connect_error', (err) => {
        console.error('Socket.IO Connection Error:', err.message);
        alert('Failed to connect to the game server. Please try refreshing the page.');
    });

    // 2. Event Listeners for UI Actions (Player Page)
    if (enterLobbyButton) { // Only present on dashboard.html
        enterLobbyButton.addEventListener('click', () => {
            const code = lobbyCodeInput.value.toUpperCase();
            if (code.length === 4) {
                enterLobbyButton.disabled = true; 
                socket.emit('join_game', {
                    code,
                    discordUser: discordUser
                });
            } else {
                alert('Please enter a 4-character lobby code.');
            }
        });
    }

    if (hostLobbyButton) { // Only present on dashboard.html
        hostLobbyButton.addEventListener('click', () => {
            // Direct the user to the host page
            window.location.href = "/host";
        });
    }

    if (readyButton) { // Only present on dashboard.html
        readyButton.addEventListener('click', () => {
            // Toggle the ready state and inform the server
            const isCurrentlyReady = readyButton.dataset.ready === 'true';
            socket.emit('set_ready', { isReady: !isCurrentlyReady });
        });
    }

    // 3. Event Listeners for UI Actions (Host Page)
    if (startGameButton) { // Only present on host.html
         startGameButton.addEventListener('click', () => {
            startGameButton.disabled = true; // Prevent spamming
            socket.emit('start_game');
         });
    }

    // 4. Socket.IO Event Handlers
    
    // Host-specific event when a new lobby code is generated
    socket.on('lobby_created', (data) => {
        currentLobbyCode = data.lobbyCode;
        displayLobbyCode.innerText = data.lobbyCode;
        // On the host page, we don't 'enter' a view, we just update the code
        if (!window.IS_HOST_PAGE) {
             enterLobbyView(data.lobbyCode);
        }
        isHost = true;
    });

    socket.on('lobby_error', (message) => {
        alert('Lobby Error: ' + message);
        if (enterLobbyButton) enterLobbyButton.disabled = false; // Re-enable if player fails to join
        if (startGameButton) startGameButton.disabled = false; // Re-enable if host fails to start
        
        // If host error, redirect player back to dashboard
        if (window.IS_HOST_PAGE) {
             window.location.href = "/dashboard.html"; 
        }
    });
    
    // Receive updated lobby data
    socket.on('lobby_update', (data) => {
        const { lobbyCode, players, currentStage } = data;
        
        // --- Shared Logic ---
        displayLobbyCode.innerText = lobbyCode;
        renderPlayerList(players);

        // --- Player Page (Dashboard) Logic ---
        if (!window.IS_HOST_PAGE) {
             enterLobbyView(lobbyCode);
             const currentUser = players.find(p => p.discordId === discordUser.id);
             if (currentUser) {
                 // Update ready button state
                 readyButton.dataset.ready = currentUser.isReady;
                 readyButton.innerHTML = currentUser.isReady ? 
                     '<i class="fa-solid fa-hourglass-half"></i><span>WAITING</span>' : 
                     '<i class="fa-solid fa-play"></i><span>READY</span>';
             }
             
             // If game starts, move to a game view (NEXT STEP: Create game_view.html)
             if (currentStage !== 'LOBBY' && currentStage !== 'WAITING_FOR_READY') {
                 // Temporary alert for game start
                 alert(`Game starting in stage: ${currentStage}`);
                 // window.location.href = "/game_view.html?code=" + lobbyCode;
             }
        } 
        
        // --- Host Page Logic ---
        if (window.IS_HOST_PAGE) {
             if (currentStage !== 'LOBBY' && currentStage !== 'WAITING_FOR_READY') {
                 // Temporary alert for game start
                 alert(`Game starting in stage: ${currentStage}`);
                 // window.location.href = "/game_view.html?code=" + lobbyCode + "&host=true";
             } else {
                 startGameButton.disabled = players.filter(p => p.isReady).length < 2;
             }
        }
    });

    // Handle new question (This is where the game UI would be driven)
    socket.on('new_question', (question) => {
        console.log("New Question Received:", question);
        // This is a placeholder for the actual game display logic
        alert(`New Question: ${question.text} (Time: ${question.timeLimitMs / 1000}s)`);

        // For testing, let's auto-submit a wrong answer after a delay
        // setTimeout(() => {
        //     socket.emit('submit_answer', { answer: 'wrong answer' });
        //     console.log('Auto-submitted answer: wrong answer');
        // }, 2000); 
    });

    // Handle question results
    socket.on('question_results', (data) => {
        console.log("Question Results:", data);
        alert(`Correct Answer: ${data.correctAnswer}. Leaderboard: ${JSON.stringify(data.leaderboard)}`);
    });

    // Handle stage updates (LOBBY -> ROUND_START -> QUESTION_ASKED etc.)
    socket.on('stage_update', (data) => {
        console.log('Game Stage Update:', data.stage);
    });
}


// --- INITIAL AUTHENTICATION AND SETUP ---
// ... (rest of the window.addEventListener('load', ...) remains the same)
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
        document.getElementById("name").innerText = window.IS_HOST_PAGE ? `Host: ${discordUser.name}` : discordUser.name;
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