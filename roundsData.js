// Example Game Content for "Christmas Quiz Classic"
const roundsData = [
    {
        name: "Round 1: Christmas Trivia",
        questions: [
            {
                text: "In the song 'The Twelve Days of Christmas', how many gold rings are mentioned?",
                type: "text_input", // Simple text answer
                correctAnswer: "five",
                pointValue: 100,
                timeLimitMs: 15000 
            },
            {
                text: "What is the name of the alternate personality of Ebenezer Scrooge's nephew, Fred, in 'A Christmas Carol'?",
                type: "text_input",
                correctAnswer: "topper",
                pointValue: 150,
                timeLimitMs: 20000
            },
            {
                text: "Which US state was the first to recognize Christmas as a legal holiday?",
                type: "text_input",
                correctAnswer: "alabama",
                pointValue: 100,
                timeLimitMs: 15000 
            }
        ]
    },
    {
        name: "Round 2: Movie Quotes",
        questions: [
            {
                text: "Finish the quote: 'You smell like a Waffle House, and...' from Elf.",
                type: "text_input",
                correctAnswer: "you smell like a new years eve party",
                pointValue: 200,
                timeLimitMs: 20000
            },
            {
                text: "In Home Alone, what is the name of the two robbers?",
                type: "text_input",
                correctAnswer: "harry and marv",
                pointValue: 250,
                timeLimitMs: 25000
            }
        ]
    }
];

module.exports = roundsData;