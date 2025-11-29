// GameEngine.js

// --- Game Stage Constants ---
const GameStage = {
    LOBBY: 'LOBBY',
    WAITING_FOR_READY: 'WAITING_FOR_READY',
    ROUND_START: 'ROUND_START',
    QUESTION_ASKED: 'QUESTION_ASKED',
    ANSWER_COLLECTION: 'ANSWER_COLLECTION',
    SCORING_REVIEW: 'SCORING_REVIEW',
    ROUND_END: 'ROUND_END',
    GAME_OVER: 'GAME_OVER'
};

// --- Player Model ---
class Player {
    constructor(discordUser, socketId) {
        // Use user.id for consistent identification, user.avatar for display
        this.discordId = discordUser.id; 
        this.name = discordUser.name;
        this.socketId = socketId;
        this.avatar = discordUser.avatar;
        
        // Game-specific properties
        this.score = 0;
        this.isReady = false;
        this.lastAnswer = null;
        this.responseTime = null;
    }
}

// --- Question Model ---
class Question {
    constructor(data) {
        this.questionId = data.questionId || Math.random().toString(36).substring(2, 9);
        this.text = data.text;
        this.type = data.type || 'text_input'; // Default type
        this.options = data.options || null;
        this.correctAnswer = data.correctAnswer;
        this.pointValue = data.pointValue || 100;
        this.timeLimitMs = data.timeLimitMs || 15000;
    }
}

// --- Round Model ---
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

// --- Game Engine Class ---
class GameEngine {
    constructor(io, lobbyCode, roundsData, players = []) {
        this.io = io;
        this.code = lobbyCode;
        this.players = players;
        this.rounds = roundsData.map((r, i) => new Round({ ...r, roundId: i + 1 }));
        
        this.currentStage = GameStage.LOBBY;
        this.currentRoundIndex = 0;
        this.questionTimer = null;
        this.questionStartTime = 0; // To calculate response time
    }

    // --- Core State Management ---

    updateStage(newStage) {
        this.currentStage = newStage;
        
        const currentQuestion = this.rounds[this.currentRoundIndex]?.getCurrentQuestion();

        // Notify all clients in the lobby of the stage change
        this.io.to(this.code).emit('stage_update', { 
            stage: newStage,
            roundIndex: this.currentRoundIndex,
            currentQuestionId: currentQuestion ? currentQuestion.questionId : null
        });

        if (newStage === GameStage.ANSWER_COLLECTION) {
            this.startQuestionTimer();
        } else if (newStage === GameStage.SCORING_REVIEW) {
            this.calculateScores();
        } else if (newStage === GameStage.ROUND_END) {
             // Move to next round or end game after a short delay
            setTimeout(() => {
                this.currentRoundIndex++;
                if (this.currentRoundIndex < this.rounds.length) {
                    this.updateStage(GameStage.ROUND_START);
                    setTimeout(() => this.startNextQuestion(), 3000);
                } else {
                    this.updateStage(GameStage.GAME_OVER);
                }
            }, 5000);
        }
    }
    
    // --- Game Flow Methods ---

    startGame() {
        // Only start if currently in LOBBY or WAITING_FOR_READY and at least two players are ready
        const readyPlayersCount = this.players.filter(p => p.isReady).length;
        if (readyPlayersCount < 2) {
             this.io.to(this.code).emit('error', 'Need at least two ready players to start.');
             return;
        }

        this.currentRoundIndex = 0;
        this.players.forEach(p => { 
            p.score = 0;
            p.isReady = false; // Reset ready status after start
        });
        
        this.updateStage(GameStage.ROUND_START);
        // Start the first question after a brief delay
        setTimeout(() => this.startNextQuestion(), 3000); 
    }

    startNextQuestion() {
        const round = this.rounds[this.currentRoundIndex];
        
        if (!round || round.currentQuestionIndex >= round.questions.length) {
            // End of the current round
            return this.updateStage(GameStage.ROUND_END);
        }
        
        const question = round.getCurrentQuestion();

        // Reset player answers
        this.players.forEach(p => {
            p.lastAnswer = null;
            p.responseTime = null;
        });
        
        // Mark question start time
        this.questionStartTime = Date.now();
        
        this.updateStage(GameStage.QUESTION_ASKED);
        
        // Prepare question object for clients (DO NOT send correctAnswer)
        const clientQuestion = {
            questionId: question.questionId,
            text: question.text,
            type: question.type,
            options: question.options,
            timeLimitMs: question.timeLimitMs,
            currentRound: this.currentRoundIndex + 1,
            totalRounds: this.rounds.length,
            questionNumber: round.currentQuestionIndex + 1,
            totalQuestionsInRound: round.questions.length
        };
        
        this.io.to(this.code).emit('new_question', clientQuestion);
        
        // Immediately move to answer collection stage (where timer starts)
        this.updateStage(GameStage.ANSWER_COLLECTION);
    }

    startQuestionTimer() {
        const question = this.rounds[this.currentRoundIndex]?.getCurrentQuestion();
        
        if (this.questionTimer) clearTimeout(this.questionTimer);
        
        if (question) {
            this.questionTimer = setTimeout(() => {
                this.updateStage(GameStage.SCORING_REVIEW);
            }, question.timeLimitMs + 1000); // Add a small buffer
        } 
    }

    // --- Answer and Scoring ---

    processPlayerAnswer(socketId, answerText) {
        const player = this.players.find(p => p.socketId === socketId);
        if (!player || player.lastAnswer !== null || this.currentStage !== GameStage.ANSWER_COLLECTION) {
            // Ignore if player already answered or game is not in answer collection stage
            return;
        }
        
        player.lastAnswer = answerText;
        player.responseTime = Date.now() - this.questionStartTime; 
        
        this.io.to(socketId).emit('answer_received');

        // Check if all active players have answered
        const activePlayers = this.players.filter(p => p.socketId !== null);
        const allAnswered = activePlayers.every(p => p.lastAnswer !== null);
        
        if (allAnswered) {
            clearTimeout(this.questionTimer);
            this.updateStage(GameStage.SCORING_REVIEW);
        }
    }

    calculateScores() {
        const round = this.rounds[this.currentRoundIndex];
        const question = round.getCurrentQuestion();
        
        if (!question) return;

        const correct = question.correctAnswer.toLowerCase().trim();
        let scoresUpdated = [];

        this.players.forEach(player => {
            let pointsEarned = 0;
            // Only score players who submitted an answer
            if (player.lastAnswer) {
                if (player.lastAnswer.toLowerCase().trim() === correct) {
                    pointsEarned = question.pointValue;
                    // Add a small speed bonus
                    const bonus = Math.max(0, 50 - Math.floor(player.responseTime / 1000));
                    pointsEarned += bonus;
                }
            }
            player.score += pointsEarned;
            scoresUpdated.push({ 
                id: player.discordId, 
                score: player.score,
                lastAnswer: player.lastAnswer,
                isCorrect: player.lastAnswer && player.lastAnswer.toLowerCase().trim() === correct
            });
        });
        
        // Advance to the next question in the round
        round.currentQuestionIndex++;
        
        this.io.to(this.code).emit('question_results', {
            correctAnswer: question.correctAnswer,
            scores: scoresUpdated,
            leaderboard: this.getLeaderboard(),
            nextQuestionTimer: 7 // client waits 7 seconds before asking for next question
        });

        // Pause for review (7 seconds) before moving on
        setTimeout(() => {
            // Automatically start the next question or end the round
            if (round.currentQuestionIndex < round.questions.length) {
                this.startNextQuestion();
            } else {
                this.updateStage(GameStage.ROUND_END);
            }
        }, 7000); 
    }
    
    getLeaderboard() {
        return this.players
            .map(p => ({ 
                name: p.name, 
                score: p.score, 
                avatar: p.avatar,
                id: p.discordId
            }))
            .sort((a, b) => b.score - a.score);
    }
    
    // --- Player Management ---
    
    removePlayer(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        if (!player) return false;

        // In a live game, mark player as disconnected, but keep their score until the game is over
        if (this.currentStage !== GameStage.LOBBY) {
             player.socketId = null; // Mark as disconnected but keep in the game state
        } else {
             // If in lobby, permanently remove
             this.players = this.players.filter(p => p.socketId !== socketId);
        }
        
        this.io.to(this.code).emit('lobby_update', {
            lobbyCode: this.code,
            players: this.players,
            currentStage: this.currentStage
        });

        return this.players.length === 0;
    }

    // Helper to get sanitized player list for lobby updates
    getSanitizedPlayers() {
        return this.players.map(p => ({
            discordId: p.discordId,
            name: p.name,
            avatar: p.avatar,
            isReady: p.isReady,
            // Only send socketId if it's the player's own connection (for potential reconnect logic)
            isConnected: p.socketId !== null, 
            score: p.score // Include score in case of late join/rejoin in progress
        }));
    }
}

module.exports = { GameEngine, GameStage, Player };