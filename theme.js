// theme.js

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const settingsPanel = document.getElementById('settings-panel');
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const warmBtn = document.getElementById('theme-warm-btn');
    const coldBtn = document.getElementById('theme-cold-btn');
    const logoImage = document.getElementById('app-logo'); 

    // Load theme from localStorage or default to warm
    let currentTheme = localStorage.getItem('appTheme') || 'warm';

    /**
     * Applies the selected theme and updates the logo image source.
     * @param {string} theme - 'warm' or 'cold'
     */
    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem('appTheme', theme);

        // 1. Update body class for CSS variables
        if (theme === 'cold') {
            body.classList.add('theme-cold');
            warmBtn.classList.remove('active');
            coldBtn.classList.add('active');
        } else {
            body.classList.remove('theme-cold');
            warmBtn.classList.add('active');
            coldBtn.classList.remove('active');
        }
        
        // 2. Update the logo source based on the theme
        if (logoImage) {
            // NOTE: Assumes logos are named logo-warm.svg and logo-cold.svg
            logoImage.src = theme === 'cold' ? '/logo-cold.svg' : '/logo-warm.svg';
            logoImage.alt = theme === 'cold' ? 'Cold Theme Logo' : 'Warm Theme Logo';
        }
    }

    // Initialize the theme on load
    applyTheme(currentTheme);

    // Event listeners for theme buttons
    if (warmBtn) warmBtn.addEventListener('click', () => applyTheme('warm'));
    if (coldBtn) coldBtn.addEventListener('click', () => applyTheme('cold'));

    // Event listener for settings panel toggle
    if (settingsToggleBtn) {
        settingsToggleBtn.addEventListener('click', () => {
            if (settingsPanel) settingsPanel.classList.toggle('open');
        });
    }
});
