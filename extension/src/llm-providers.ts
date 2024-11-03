import type { ElementInfo, ElementDescription } from './types';

export interface LLMProvider {
    generateDescription(element: ElementInfo): Promise<ElementDescription>;
  }
  
export class AnthropicProvider implements LLMProvider {
    private apiKey: string;
    private apiEndpoint = 'https://api.anthropic.com/v1/messages';
    
    constructor(apiKey: string) {
      this.apiKey = apiKey;
    }

    async generateDescription(element: ElementInfo): Promise<ElementDescription> {
        const prompt = this.formatElementPrompt(element);
        
        try {
          const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 1024,
              messages: [{ 
                role: "user", 
                content: prompt 
              }]
            })
          });
    
          if (!response.ok) {
            console.error('API request response:', response);
            throw new Error(`API request failed: ${response.statusText}`);
          }
    
          const data = await response.json();
          return {
            element,
            description: data.content[0].text.trim()
          };
        } catch (error) {
          console.error('Error calling Anthropic API:', error);
          return {
            element,
            description: "Failed to generate description for this element."
          };
        }
      }
    
    private formatElementPrompt(element: ElementInfo): string {
        return `Describe this webpage element concisely for a blind user, focusing on its purpose and functionality:
        ${element.tag} element with text "${element.text}"${element.role ? ` and role "${element.role}"` : ''}

        Provide a brief, clear description in a single sentence.`;
    }
}