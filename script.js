// DOM Elements
const elements = {
    threadInput: document.getElementById('threadInput'),
    narrateBtn: document.getElementById('narrateBtn'),
    podcastBtn: document.getElementById('podcastBtn'),
    loading: document.getElementById('loading'),
    audioPlayerContainer: document.getElementById('audioPlayerContainer')
};

// API Endpoints
const API_ENDPOINTS = {
    narrate: '/api/narrate',
    podcastify: '/api/podcastify'
};

// UI State Management
const ui = {
    showLoading() {
        elements.loading.classList.remove('hidden');
        elements.audioPlayerContainer.classList.add('hidden');
    },

    hideLoading() {
        elements.loading.classList.add('hidden');
    },

    showAudioPlayer(audioUrl) {
        elements.audioPlayerContainer.innerHTML = `
            <audio controls src="${audioUrl}" id="audioPlayer"></audio>
        `;
        elements.audioPlayerContainer.classList.remove('hidden');
    },

    showError(message) {
        alert(`Error: ${message}`);
    }
};

// API Communication
const api = {
    async processThread(endpoint, thread) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ thread })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.audioUrl;
        } catch (error) {
            throw new Error(`Failed to process thread: ${error.message}`);
        }
    }
};

// Event Handlers
const handlers = {
    async handleThreadProcessing(endpoint) {
        const thread = elements.threadInput.value.trim();
        
        if (!thread) {
            ui.showError('Please paste a Twitter thread first');
            return;
        }

        ui.showLoading();

        try {
            const audioUrl = await api.processThread(endpoint, thread);
            ui.hideLoading();
            ui.showAudioPlayer(audioUrl);
        } catch (error) {
            ui.hideLoading();
            ui.showError(error.message);
        }
    }
};

// Initialize Event Listeners
function initializeEventListeners() {
    elements.narrateBtn.addEventListener('click', () => {
        handlers.handleThreadProcessing(API_ENDPOINTS.narrate);
    });

    elements.podcastBtn.addEventListener('click', () => {
        handlers.handleThreadProcessing(API_ENDPOINTS.podcastify);
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading and audio player initially
    elements.loading.classList.add('hidden');
    elements.audioPlayerContainer.classList.add('hidden');
    
    // Set up event listeners
    initializeEventListeners();
}); 