// game_view.js (Handles game stage logic for the player)

// DOM Elements
const lobbyCodeDisplay = document.getElementById('lobby-code-display');
const scoreDisplay = document.getElementById('player-score-display');
const timerDisplay = document.getElementById('timer-display');
const questionTextElement = document.getElementById('question-text');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const submitButton = document.getElementById('submit-answer-btn');
const statusMessage = document.getElementById('game-status-message');

let discordUser = null;
let socket = null;
let currentLobbyCode = null;
let questionStartTime = null;

// --- Helper Functions ---

/**
 * Initializes the game view after successful authentication.
 */
function initGameView() {
    socket = io();

    // Get lobby code from URL
    const params = new URLSearchParams(window.location.search);
    currentLobbyCode = params.get('code');
    lobbyCodeDisplay.innerText = `Lobby: ${currentLobbyCode}`;

    socket.on('connect', () => {
        console.log('Connected to game server.');
        
        // Re-join the game room, sending the cached discordUser info
        socket.emit('join_game', {
            code: currentLobbyCode,
            discordUser: discordUser
        });
    });

    socket.on('lobby_error', (message) => {
        alert('Game Error: ' + message);
        // If there's an error, redirect them back to the dashboard
        window.location.href = "/dashboard.html"; 
    });

    // --- Core Game Event Handlers ---
    
    // 1. Initial/Game State Update (for re-connects or general info)
    socket.on('lobby_update', (data) => {
        const currentUser = data.players.find(p => p.discordId === discordUser.id);
        if (currentUser) {
            scoreDisplay.innerText = `Score: ${currentUser.score}`;
        }
        
        // If the game stage reverts to LOBBY, redirect them back
        if (data.currentStage === 'LOBBY' || data.currentStage === 'WAITING_FOR_READY') {
             console.log("Game stopped, returning to lobby view.");
             window.location.href = "/dashboard.html";
        }
    });

    // 2. New Question Event
    socket.on('new_question', (question) => {
        console.log("New Question Received:", question);
        questionTextElement.innerText = question.text;
        statusMessage.innerText = `Question for ${question.pointValue} points!`;
        answerInput.value = ''; // Clear previous answer
        answerInput.disabled = false;
        submitButton.disabled = false;
        questionStartTime = Date.now();
        
        // Start Timer (simple client-side timer for display)
        let timeLeft = Math.floor(question.timeLimitMs / 1000);
        timerDisplay.innerText = `${timeLeft}s`;

        const timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.innerText = `${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerDisplay.innerText = 'TIME UP';
                answerInput.disabled = true;
                submitButton.disabled = true;
                statusMessage.innerText = 'Time is up! Waiting for results.';
            }
            
            // Host will send stage_update to ANSWER_COLLECTION_END when the server timer is truly up
            // This client timer is just for visual feedback.
        }, 1000);

        socket.once('stage_update', (data) => {
            if (data.stage === 'SCORING_REVIEW') {
                clearInterval(timerInterval);
            }
        });
    });

    // 3. Question Results Event
    socket.on('question_results', (data) => {
        console.log("Question Results:", data);
        
        // Disable input
        answerInput.disabled = true;
        submitButton.disabled = true;

        // Display results
        const isCorrect = data.isCorrect;
        const correctText = `Correct Answer was: ${data.correctAnswer}`;
        const scoreChange = data.scoreChange > 0 ? `+${data.scoreChange}` : data.scoreChange;
        
        statusMessage.innerHTML = `
            ${isCorrect ? 
                `<i class="fa-solid fa-check-circle" style="color: green;"></i> CORRECT! (${scoreChange} points)` : 
                `<i class="fa-solid fa-times-circle" style="color: red;"></i> INCORRECT.`}
        `;
        questionTextElement.innerText = `RESULTS:\n${correctText}`;
        
        // Update score from the new leaderboard data
        const currentUserScore = data.leaderboard.find(p => p.id === discordUser.id)?.score || 'ERROR';
        scoreDisplay.innerText = `Score: ${currentUserScore}`;
    });
    
    // 4. Game Stage Update (to clear question UI, show leaderboard, etc.)
    socket.on('stage_update', (data) => {
        console.log('Game Stage Update:', data.stage);
        
        if (data.stage === 'ROUND_START') {
            questionTextElement.innerText = `Round ${data.roundIndex + 1}: ${data.roundName} is about to begin!`;
            statusMessage.innerText = 'Get ready...';
        } else if (data.stage === 'SCORING_REVIEW' || data.stage === 'ROUND_END') {
            // After results, wait for the next stage (handled by the host/engine)
        } else if (data.stage === 'GAME_OVER') {
            questionTextElement.innerText = 'GAME OVER! Final Leaderboard:';
            // Simple display of final results
            const leaderboardHtml = data.leaderboard.map(p => 
                `<li>${p.name}: ${p.score} points</li>`
            ).join('');
            statusMessage.innerHTML = `<ul>${leaderboardHtml}</ul>`;
        }
    });


    // --- Form Submission Handler ---
    answerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const answer = answerInput.value.trim();
        if (!answer || submitButton.disabled) return;

        submitButton.disabled = true; // Disable after submission
        answerInput.disabled = true;

        // Calculate response time
        const responseTime = Date.now() - questionStartTime;

        // Send the answer to the server
        socket.emit('submit_answer', { 
            answer: answer, 
            responseTime: responseTime 
        });
        
        statusMessage.innerText = `Answer submitted: "${answer}". Waiting for results...`;
    });
}

// --- INITIAL AUTHENTICATION AND SETUP (Copied from auth.js, simplified) ---
window.addEventListener('load', () => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const tokenType = fragment.get("token_type");

    // We must check if the user is authenticated first
    if (!accessToken) {
        // Redirect to login if token is missing
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
        
        initGameView(); // Start the game logic
    })
    .catch(error => {
        console.error("Discord API fetch error:", error);
        window.location.href = "/index.html"; 
    });
});