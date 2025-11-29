function createSnowflakes(count = 60) {
  // Ensure a dedicated container exists so snow can be layered beneath UI
  let container = document.getElementById('snow-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'snow-container';
    document.body.appendChild(container);
  }

  for (let i = 0; i < count; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    flake.textContent = "❄";

    // Random horizontal start position
    flake.style.left = Math.random() * 100 + "vw";

    // Random size
    flake.style.fontSize = (Math.random() * 1.2 + 0.5) + "rem";

    // Random opacity
    flake.style.opacity = Math.random() * 0.6 + 0.4;

    // Falling animation duration (vary speed)
    const fallDuration = Math.random() * 7 + 5; // 5–12s

    // Drifting animation duration (subtle variance)
    const driftDuration = Math.random() * 4 + 3; // 3–7s

    // Start them at different times
    const delay = Math.random() * -15; // negative = already falling

    flake.style.animation = `
      fall ${fallDuration}s linear infinite,
      drift ${driftDuration}s ease-in-out infinite
    `;

    flake.style.animationDelay = `${delay}s`;

    container.appendChild(flake);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  createSnowflakes();
});
