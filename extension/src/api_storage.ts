export class ApiStorage {
    private static readonly STORAGE_KEY = 'anthropicApiKey';

    static async saveApiKey(apiKey: string): Promise<void> {
        if (!apiKey.startsWith('sk-')) {
            throw new Error('Invalid API key format');
        }
        
        try {
            await chrome.storage.sync.set({ [this.STORAGE_KEY]: apiKey });
        } catch (error) {
            console.error('Error saving API key:', error);
            throw new Error('Failed to save API key');
        }
    }

    static async getApiKey(): Promise<string> {
        try {
            const result = await chrome.storage.sync.get([this.STORAGE_KEY]);
            return result[this.STORAGE_KEY] || '';
        } catch (error) {
            console.error('Error retrieving API key:', error);
            throw new Error('Failed to retrieve API key');
        }
    }

    static async removeApiKey(): Promise<void> {
        try {
            await chrome.storage.sync.remove([this.STORAGE_KEY]);
        } catch (error) {
            console.error('Error removing API key:', error);
            throw new Error('Failed to remove API key');
        }
    }
}