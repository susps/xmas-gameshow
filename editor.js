// editor.js

const roundsContainer = document.getElementById('rounds-container');
const addRoundBtn = document.getElementById('add-round-btn');
const saveGameBtn = document.getElementById('save-game-btn');
const saveMessage = document.getElementById('save-message');

const GAME_DATA_STORAGE_KEY = 'christmasQuizGameData';

// --- Core Data Structure ---
let gameData = [];

// --- Helper Functions ---

function loadGameData() {
    const storedData = localStorage.getItem(GAME_DATA_STORAGE_KEY);
    if (storedData) {
        try {
            gameData = JSON.parse(storedData);
            renderAllRounds();
            updateSaveButtonStatus();
            saveMessage.innerText = 'Loaded previously saved game data.';
        } catch (e) {
            console.error("Error parsing stored game data:", e);
            gameData = [];
            renderAllRounds(); // Render empty state
        }
    }
    if (gameData.length === 0) {
        addNewRound(); // Start with one empty round if no data
    }
}

function updateSaveButtonStatus() {
    // Check if there is at least one round and one question in the first round
    const hasContent = gameData.length > 0 && gameData[0].questions.length > 0;
    saveGameBtn.disabled = !hasContent;
}

function saveGameData() {
    // 1. Sanitize/Extract data from the UI
    const rounds = [];
    document.querySelectorAll('.round-section').forEach(roundEl => {
        const roundName = roundEl.querySelector('.round-name-input').value.trim();
        const questions = [];

        roundEl.querySelectorAll('.question-section').forEach(questionEl => {
            const text = questionEl.querySelector('.question-text-input').value.trim();
            const correctAnswer = questionEl.querySelector('.correct-answer-input').value.trim();
            const pointValue = parseInt(questionEl.querySelector('.point-value-input').value) || 100;
            const timeLimitMs = (parseInt(questionEl.querySelector('.time-limit-input').value) || 20) * 1000;
            
            if (text && correctAnswer) {
                 questions.push({
                    text,
                    type: "text_input", // Hardcoded for now
                    correctAnswer,
                    pointValue,
                    timeLimitMs
                });
            }
        });

        if (roundName && questions.length > 0) {
            rounds.push({ name: roundName, questions });
        }
    });

    // 2. Update and Store
    gameData = rounds;
    if (gameData.length > 0) {
        localStorage.setItem(GAME_DATA_STORAGE_KEY, JSON.stringify(gameData));
        saveMessage.innerText = `Game saved successfully on ${new Date().toLocaleTimeString()}.`;
        saveMessage.style.color = 'green';
    } else {
        saveMessage.innerText = `Cannot save empty game. Add at least one round and question.`;
        saveMessage.style.color = 'red';
    }
    updateSaveButtonStatus();
}


// --- Rendering Functions ---

function renderQuestion(roundIndex, questionData = {}) {
    const questionEl = document.createElement('div');
    questionEl.className = 'question-section';
    questionEl.innerHTML = `
        <div class="question-header">
            <h3>Question</h3>
            <button class="add-button remove-button remove-question-btn">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <input class="question-input question-text-input" placeholder="Question Text" value="${questionData.text || ''}">
        <input class="question-input correct-answer-input" placeholder="Correct Answer (e.g., Santa Claus)" value="${questionData.correctAnswer || ''}">
        <div style="display: flex; gap: 10px;">
            <input class="question-input point-value-input" type="number" min="10" placeholder="Points (e.g., 100)" value="${questionData.pointValue || 100}">
            <input class="question-input time-limit-input" type="number" min="5" max="60" placeholder="Time Limit (seconds)" value="${questionData.timeLimitMs ? questionData.timeLimitMs / 1000 : 20}">
        </div>
    `;
    
    // Bind remove event
    questionEl.querySelector('.remove-question-btn').addEventListener('click', () => {
        questionEl.remove();
        updateSaveButtonStatus(); // Check if content is empty after removal
    });

    return questionEl;
}

function renderRound(roundData = {}, index) {
    const roundEl = document.createElement('div');
    roundEl.className = 'round-section';
    roundEl.dataset.index = index;
    
    const questionsList = document.createElement('div');
    questionsList.className = 'questions-list';

    // Add existing questions
    (roundData.questions || []).forEach(q => {
        questionsList.appendChild(renderQuestion(index, q));
    });

    roundEl.innerHTML = `
        <div class="round-header">
            <h2>Round ${index + 1}:</h2>
            <div>
                <button class="add-button remove-button remove-round-btn">
                    <i class="fa-solid fa-trash"></i> Remove Round
                </button>
            </div>
        </div>
        <input class="round-input round-name-input" placeholder="Round Name (e.g., Christmas Movie Quotes)" value="${roundData.name || ''}">
        
    `;
    
    // Append the dynamically created questions container
    roundEl.appendChild(questionsList);
    
    const addQuestionBtn = document.createElement('button');
    addQuestionBtn.className = 'add-button';
    addQuestionBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Question';
    
    // Bind "Add Question" event
    addQuestionBtn.addEventListener('click', () => {
        questionsList.appendChild(renderQuestion(index, {}));
        updateSaveButtonStatus();
    });

    roundEl.appendChild(addQuestionBtn);
    
    // Bind "Remove Round" event
    roundEl.querySelector('.remove-round-btn').addEventListener('click', () => {
        if (confirm(`Are you sure you want to remove Round ${index + 1}?`)) {
            roundEl.remove();
            // Re-render all to fix indices, or just update gameData and re-save
            updateSaveButtonStatus();
        }
    });

    return roundEl;
}

function renderAllRounds() {
    roundsContainer.innerHTML = '';
    gameData.forEach((round, index) => {
        roundsContainer.appendChild(renderRound(round, index));
    });
}

function addNewRound() {
    // We add an empty round and immediately render it
    gameData.push({ name: '', questions: [] });
    roundsContainer.appendChild(renderRound({}, gameData.length - 1));
    updateSaveButtonStatus();
}

// --- Event Listeners ---
addRoundBtn.addEventListener('click', addNewRound);
saveGameBtn.addEventListener('click', saveGameData);

// Listen for any input changes to re-enable the save button after initial load
roundsContainer.addEventListener('input', updateSaveButtonStatus);


// --- Initialization ---
loadGameData();