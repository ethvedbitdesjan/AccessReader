import { ElementDescription } from "./types";

// Basic function to speak text
export function speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Optional: Configure voice settings
            utterance.rate = 1.0;  // Speed: 0.1 to 10
            utterance.pitch = 1.0; // Pitch: 0 to 2
            utterance.volume = 1.0; // Volume: 0 to 1
            
            // Get available voices and set to first English voice if available
            const voices = window.speechSynthesis.getVoices();
            const englishVoice = voices.find(voice => voice.lang.includes('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
            }

            utterance.onend = () => {
                resolve();
            };

            utterance.onerror = (event) => {
                reject(new Error(`Speech synthesis error: ${event.error}`));
            };

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            reject(error);
        }
    });
}

// Update these functions to directly use speak instead of returning audio data
export function generateAudio(content: string): void {
    console.error("content to audio: ", content);
    speak(content).catch(error => {
        console.error('Error generating audio:', error);
    });
}

export function generateAudioList(content: ElementDescription[]): void {
    const formattedText = content.map((desc, index) => 
        `Option ${index + 1}: ${desc.description}`
    ).join('. ');

    speak(formattedText).catch(error => {
        console.error('Error generating audio list:', error);
    });
}