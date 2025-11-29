// --- 1. Player Model (Extends existing lobby structure) ---
// Stored on the server within the game state.
class Player {
    constructor(discordUser, socketId) {
        this.discordId = discordUser.id;
        this.name = discordUser.name;
        this.socketId = socketId;
        this.avatar = discordUser.avatar;
        
        // Game-specific properties
        this.score = 0;              // Total score
        this.isReady = false;        // Lobby ready status
        this.lastAnswer = null;      // Last submitted answer
        this.responseTime = null;    // Time taken to answer (for tie-breaking/speed bonuses)
    }
}

// --- 2. Question Model ---
class Question {
    constructor(data) {
        this.questionId = data.questionId || Math.random().toString(36).substring(2, 9);
        this.text = data.text;
        this.type = data.type;          // 'multiple_choice', 'true_false', 'text_input'
        this.options = data.options || null; // Array of strings for MCQs
        this.correctAnswer = data.correctAnswer; // The correct answer string
        this.pointValue = data.pointValue || 100;
        this.timeLimitMs = data.timeLimitMs || 15000; // 15 seconds
    }
}

// --- 3. Round Model ---
class Round {
    constructor(data) {
        this.roundId = data.roundId;
        this.name = data.name;
        this.questions = data.questions.map(q => new Question(q));
        this.currentQuestionIndex = 0;
    }
    
    getCurrentQuestion() {
        return this.questions[this.currentQuestionIndex];
    }
}