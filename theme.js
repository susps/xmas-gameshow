// theme.js - Handles theme persistence and switching

const THEME_STORAGE_KEY = 'gameshow_theme';
const DEFAULT_THEME = 'warm'; // Default theme if nothing is stored

/**
 * Applies the given theme class to the document body and saves it to localStorage.
 * @param {string} themeName - 'warm' or 'cold'
 */
function applyTheme(themeName) {
    const body = document.body;
    
    // Clear existing theme classes
    body.classList.remove('theme-warm', 'theme-cold');

    // Add the new theme class
    if (themeName === 'cold') {
        body.classList.add('theme-cold');
    } else {
        // If themeName is 'warm' or null/default
        body.classList.add('theme-warm');
    }

    // Save preference
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    // Update the button visual state (if the settings panel is open)
    updateThemeButtons(themeName);
}

/**
 * Initializes the theme on page load.
 */
function initializeTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
    applyTheme(storedTheme);
}

/**
 * Updates the 'active' state on the theme selection buttons.
 * @param {string} currentTheme - 'warm' or 'cold'
 */
function updateThemeButtons(currentTheme) {
    const warmBtn = document.getElementById('theme-warm-btn');
    const coldBtn = document.getElementById('theme-cold-btn');

    if (warmBtn) {
        warmBtn.classList.toggle('active', currentTheme === 'warm');
    }
    if (coldBtn) {
        coldBtn.classList.toggle('active', currentTheme === 'cold');
    }
}

// --- Settings Panel Logic ---

window.addEventListener('load', () => {
    initializeTheme();

    const settingsBtn = document.getElementById('settings-toggle-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const warmBtn = document.getElementById('theme-warm-btn');
    const coldBtn = document.getElementById('theme-cold-btn');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.toggle('open');
            // Ensure button status is correct when opening the panel
            const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
            updateThemeButtons(currentTheme);
        });
    }

    if (warmBtn) {
        warmBtn.addEventListener('click', () => applyTheme('warm'));
    }
    
    if (coldBtn) {
        coldBtn.addEventListener('click', () => applyTheme('cold'));
    }
});