import type { ElementInfo, ElementDescription, ClickPoint } from './types';

export interface LLMProvider {
    generateDescription(element: ElementInfo): Promise<ElementDescription>;
    getCoordinatesFromScreenshot(screenshot: string, intent: string, numPoints: number): Promise<ClickPoint[]>;
  }
  
export class AnthropicProvider implements LLMProvider {
    private apiKey: string;
    private apiEndpoint = 'https://api.anthropic.com/v1/messages';
    private width: number;
    private height: number;
    
    constructor(apiKey: string, width: number, height: number) {
      this.apiKey = apiKey;
      this.width = width;
      this.height = height;
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

    async getCoordinatesFromScreenshot(
        screenshot: string, 
        intent: string,
        numPoints: number = 3
      ): Promise<ClickPoint[]> {
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
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1024,
              messages: [{ 
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Given this screenshot of a webpage, find atmost 2 elements that best match this user intent: "${intent}". You don't always have 2 elements, so return only the good ones.
                    Return ONLY an array of coordinate objects in the format [\{x: number, y: number\}], nothing else. The device resolution is "${this.width}x${this.height}".`
                  },
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/png',
                      data: screenshot
                    }
                  }
                ]
              }]
            })
          });
    
          if (!response.ok) {
            const data = await response.json();
            console.error("type ", data.type);
            console.error("error ", data.error.message);
            throw new Error(`API request failed: ${response.statusText}`);
          }
    
          const data = await response.json();
          console.log('Vision API response:', data);
          const responseText = data.content[0].text.trim();
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("Could not find coordinate array in response");
            }

            let jsonStr = jsonMatch[0];
            
            // Add quotes around property names if they're missing
            jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
            
            console.log("Processed JSON string:", jsonStr);

            try {
                const coordinates = JSON.parse(jsonStr);
                
                // Validate the structure
                if (!Array.isArray(coordinates)) {
                    throw new Error("Response is not an array");
                }

                // Validate and clean each coordinate
                return coordinates.map((coord: any, index: number) => {
                    if (typeof coord.x !== 'number' || typeof coord.y !== 'number') {
                        console.error(`Invalid coordinate at index ${index}:`, coord);
                        throw new Error(`Invalid coordinate format: ${JSON.stringify(coord)}`);
                    }
                    return {
                        x: Math.round(coord.x),
                        y: Math.round(coord.y)
                    };
                });
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError);
                console.error("Attempted to parse:", jsonStr);
                throw new Error(`Failed to parse coordinates: ${parseError}`);
            }
        } catch (error) {
          console.error('Error getting coordinates from vision API:', error);
          throw error;
        }
      }
}