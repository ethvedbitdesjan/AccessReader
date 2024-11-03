import { ApiStorage } from './api_storage';

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const statusDiv = document.getElementById('status')!;
const form = document.querySelector('form')!;

async function loadApiKey() {
    try {
        const apiKey = await ApiStorage.getApiKey();
        if (apiKey) {
            apiKeyInput.value = apiKey;
            showStatus('API key loaded', 'success', false);
        }
    } catch (error) {
        showStatus('Error loading API key', 'error');
    }
}

// Prevent form submission and handle save
form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveApiKey();
});

// Save API key when input changes
apiKeyInput.addEventListener('change', saveApiKey);

// Handle keyboard shortcuts
apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveApiKey();
    }
    if (e.key === 'Escape') {
        // Announce closing
        showStatus('Closing settings', 'success', false);
        setTimeout(() => window.close(), 500); // Give time for screen reader to announce
    }
});

async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    
    try {
        await ApiStorage.saveApiKey(apiKey);
        apiKeyInput.setAttribute('aria-invalid', 'false');
        showStatus('API key saved successfully. You can now close this window.', 'success');
    } catch (error) {
        apiKeyInput.setAttribute('aria-invalid', 'true');
        if (error instanceof Error) {
            showStatus(error.message, 'error');
        } else {
            showStatus('Error saving API key', 'error');
        }
    }
}

function showStatus(message: string, type: 'success' | 'error', autoHide: boolean = true) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    
    // Ensure the status message is properly associated with the input
    apiKeyInput.setAttribute('aria-describedby', 'apikey-hint apikey-status');
    
    if (autoHide) {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
            // Remove the status from aria-describedby when it's hidden
            apiKeyInput.setAttribute('aria-describedby', 'apikey-hint');
        }, 5000);
    }
}

loadApiKey();