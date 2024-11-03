import { LLMProvider } from './llm-providers';
import { ElementInfo, ElementDescription, ClickPoint } from './types';

export class ContentGenerator {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async generateReadableContent(elements: ElementInfo[]): Promise<ElementDescription[]> {
    if (!elements.length) {
      return [];
    }

    // Process each element individually
    const descriptions = await Promise.all(
      elements.map(element => this.provider.generateDescription(element))
    );

    return descriptions;
  }

  async getCoordinatesFromScreenshot(
    screenshot: string, 
    intent: string,
    numPoints: number = 3
  ): Promise<ClickPoint[]> {
    return await this.provider.getCoordinatesFromScreenshot(screenshot, intent, numPoints);
  }
}