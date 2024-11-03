import type { 
  SpecialIntent, 
  NavigationData, 
  NavigationResults, 
  UserPreferences, 
  ClickPoint, 
  ElementInfo, 
  ElementDescription 
} from './types';
import { AnthropicProvider } from './llm-providers';
import { ContentGenerator } from './content-generator';
import { ApiStorage } from './api_storage';

const SPECIAL_INTENTS: Record<string, SpecialIntent> = {
  "navigate": {
    prompt: "Find navigation elements like menus and links",
    numPoints: 5
  },
  "news": {
    prompt: "Find news articles and headlines based on user interests",
    numPoints: 3
  },
  "form": {
    prompt: "Find form elements like input fields and buttons",
    numPoints: 4
  }
};

let processingNavigation = false;
let commandTimeout: number | undefined;

chrome.runtime.onMessage.addListener((
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => {
  console.log("Background received message:", request);
  
  if (request.type === "contentScriptReady") {
    console.log("Content script ready in tab:", sender.tab?.id);
    sendResponse({status: "acknowledged"});
  }
  else if (request.type === "processNavigation" && !processingNavigation) {
    processingNavigation = true;
    handleNavigation(request.data, sender.tab?.id)
      .then(() => {
        processingNavigation = false;
      })
      .catch((error) => {
        console.error("Navigation processing error:", error);
        processingNavigation = false;
      });
  }
  else if (request.type === "requestElementSelection" && sender.tab?.id) {
    handleElementSelection(request.data, sender.tab.id);
  }
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "activate-assistant") {
    if (commandTimeout) {
      clearTimeout(commandTimeout);
    }
    
    commandTimeout = setTimeout(async () => {
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tab?.id) {
          console.error('No active tab found');
          return;
        }

        if (!tab.url || tab.url.startsWith('chrome:') || 
            tab.url.startsWith('chrome-extension:') || 
            tab.url.startsWith('edge:') ||
            tab.url.startsWith('about:')) {
          console.log("Extension cannot run on this page type");
          return;
        }

        if (!processingNavigation) {
          try {
            await Promise.all([
              chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['styles.css']
              }),
            ]);

            setTimeout(async () => {
              try {
                await chrome.tabs.sendMessage(tab.id!, {
                  action: "startNavigation"
                });
              } catch (msgError) {
                console.error("Error sending message:", msgError);
              }
            }, 100);
          } catch (scriptError) {
            console.error("Error injecting script:", scriptError);
          }
        }
      } catch (error) {
        console.error("Command handling error:", error);
      }
    }, 300);
  }
});

async function handleElementSelection(
  data: { optionIndex: number; coordinates: DOMRect }, 
  tabId: number
): Promise<void> {
  try {
    const centerX = data.coordinates.left + (data.coordinates.width / 2);
    const centerY = data.coordinates.top + (data.coordinates.height / 2);
    
    await moveMouseToCoordinates(centerX, centerY);
    
    await chrome.tabs.sendMessage(tabId, {
      action: "selectionFeedback",
      data: {
        optionIndex: data.optionIndex
      }
    });
  } catch (error) {
    console.error("Error handling element selection:", error);
  }
}

async function moveMouseToCoordinates(x: number, y: number): Promise<void> {
  console.error(`Moving mouse to coordinates: x=${x}, y=${y}`);
  // Placeholder for actual mouse movement implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Mouse movement complete");
      resolve();
    }, 100);
  });
}

async function handleNavigation(data: NavigationData, tabId?: number): Promise<void> {
  if (!tabId) return;
  
  console.log("Processing navigation data:", data);
    const { screenshot, intent } = data;
    const userPrefs = await getUserPreferences();
    const specialConfig = SPECIAL_INTENTS[intent.toLowerCase()];
    
    const apiKey = await ApiStorage.getApiKey();
    if (!apiKey) {
      await chrome.windows.create({
        url: 'settings.html',
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
      });
      return;
    }

    const clickPoints = await getClickPoints(
      screenshot, 
      specialConfig ? specialConfig.prompt : intent,
      specialConfig ? specialConfig.numPoints : 3,
      userPrefs
    );
    
    const elements = await extractElements(clickPoints);
    const provider = new AnthropicProvider(apiKey);
    const generator = new ContentGenerator(provider);
    const content = await generateReadableContent(elements, generator);
    
    await chrome.tabs.sendMessage(tabId, {
      action: "presentResults",
      data: {
        elements,
        content,
      } as NavigationResults
    });
    
    return;
}

async function getClickPoints(
  screenshot: string, 
  intent: string, 
  numPoints: number, 
  userPrefs: UserPreferences
): Promise<ClickPoint[]> {
  // Placeholder - implement actual vision model integration
  return [
    { x: 800, y: 183 },
    { x: 200, y: 200 }
  ];
}

async function generateReadableContent(
  elements: ElementInfo[], 
  generator: ContentGenerator
): Promise<ElementDescription[]> {
  return generator.generateReadableContent(elements);
}

async function getUserPreferences(): Promise<UserPreferences> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userPreferences'], (result) => {
      resolve(result.userPreferences || {
        interests: [],
        voiceSettings: {
          rate: 1,
          pitch: 1,
          volume: 1
        }
      });
    });
  });
}

async function extractElements(clickPoints: ClickPoint[]): Promise<ElementInfo[]> {
  return new Promise((resolve) => {
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
      if (!tab.id) return resolve([]);
      
      chrome.tabs.sendMessage(tab.id, {
        action: "extractElements",
        data: { points: clickPoints }
      }, (response: ElementInfo[]) => {
        resolve(response || []);
      });
    });
  });
}