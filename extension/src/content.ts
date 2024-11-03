import type { 
  NavigationData, 
  NavigationResults, 
  ClickPoint, 
  ElementInfo, 
  ElementDescription 
} from './types';
import { generateAudio, generateAudioList, speak } from './audio';

let currentElements: ElementInfo[] = [];
let isListening = false;

const initContentScript = () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ type: "contentScriptReady" }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Initial connection attempt failed, extension not ready");
          } else {
            console.log("Content script registered with background");
          }
        });
      } catch (error) {
        console.error("Error initializing content script:", error);
      }
    }, 1000);
  } else {
    console.error("Chrome runtime not available");
  }
};

initContentScript();

let speechInitialized = false;
async function initializeSpeech(): Promise<void> {
  if (speechInitialized) return;
  
  // Create and speak an empty utterance to initialize speech synthesis
  const init = "Hello, How are you?";
  await speak(init);
  speechInitialized = true;
  console.log("Speech synthesis initialized");
}

// Selection keyboard handler
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.altKey && /^[1-9]$/.test(event.key)) {
    const optionIndex = parseInt(event.key) - 1;
    if (currentElements[optionIndex]) {
      chrome.runtime.sendMessage({
        type: "requestElementSelection",
        data: {
          optionIndex,
          coordinates: currentElements[optionIndex].boundingBox
        }
      });
    }
  }
});

// Message listener
chrome.runtime.onMessage.addListener((
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => {
  console.log("Content script received message:", request);
  
  switch (request.action) {
    case "startNavigation":
      startNavigationProcess();
      break;
    case "presentResults":
      presentResults(request.data);
      break;
    case "presentError":
      presentError(request.data);
      break;
    case "extractElements":
      const elements = findElementsAtPoints(request.data.points);
      sendResponse(elements);
      break;
    case "selectionFeedback":
      provideFeedback(request.data.optionIndex);
      break;
  }
  return true;
});

async function startNavigationProcess(): Promise<void> {
  try {
      console.log("Starting navigation process");
      // Initialize speech synthesis first
      await initializeSpeech();
      
      const screenshot = await captureVisibleTab();
      const intent = await getUserIntent();
      
      chrome.runtime.sendMessage({
          type: "processNavigation",
          data: {
              screenshot,
              intent
          } as NavigationData
      });
  } catch (error) {
      console.error("Error starting navigation:", error);
  }
}

async function captureVisibleTab(): Promise<string> {
  return "base64_screenshot_data"; // Placeholder
}

async function getUserIntent(): Promise<string> {
  return "navigate"; // Placeholder
}

function presentResults(data: NavigationResults): void {
  if (!data) {
    console.error("No data received in presentResults");
    return;
  }
  
  const { elements, content} = data;
  currentElements = elements;
  
  console.log("Presenting results:", { elements, content});
  try {
    // Instead of creating an Audio element, directly speak the content
    generateAudioList(content);
  }
  catch (error) {
      console.error("Error presenting audio:", error);
  }

  try {
    if (elements) {
      highlightElements(elements);
      console.log("Highlighted elements:", elements);
    }
  } catch (error) {
    console.error("Error highlighting results:", error);
  }
}

async function provideFeedback(optionIndex: number): Promise<void> {
  const selectedElement = currentElements[optionIndex];
  if (selectedElement) {
    await generateAudio(`Selected option ${optionIndex + 1}`);
    
    updateVisualFeedback(selectedElement);
  }
}

function updateVisualFeedback(element: ElementInfo): void {
  document.querySelectorAll('.web-access-selected').forEach(el => 
    el.classList.remove('web-access-selected')
  );
  
  const highlight = document.querySelector(
    `.web-access-highlight[style*="left: ${element.boundingBox.left}px"]`
  );
  if (highlight) {
    highlight.classList.add('web-access-selected');
  }
}

function presentError(message: string): void {
  try {
      generateAudio(message);
  } catch (error) {
      console.error("Error presenting error message:", error);
  }
}

function highlightElements(elements: ElementInfo[]): void {
  try {
    const existingHighlights = document.querySelectorAll('.web-access-highlight');
    existingHighlights.forEach(el => el.remove());
    
    elements.forEach(({boundingBox}, index) => {
      if (boundingBox.width > window.innerWidth * 2 || 
          boundingBox.height > window.innerHeight * 2 ||
          boundingBox.top < -window.innerHeight ||
          boundingBox.left < -window.innerWidth) {
        console.log("Skipping element with invalid bounds:", boundingBox);
        return;
      }

      const highlight = document.createElement('div');
      highlight.className = 'web-access-highlight';
      highlight.setAttribute('data-option-index', index.toString());
      
      highlight.style.cssText = `
        position: absolute;
        left: ${Math.max(0, boundingBox.left)}px;
        top: ${Math.max(0, boundingBox.top)}px;
        width: ${Math.min(boundingBox.width, window.innerWidth)}px;
        height: ${Math.min(boundingBox.height, window.innerHeight)}px;
        border: 2px solid orange;
        background: rgba(255, 165, 0, 0.1);
        pointer-events: none;
        z-index: 10000;
        box-sizing: border-box;
      `;
      
      document.body.appendChild(highlight);
    });
  } catch (error) {
    console.error("Error highlighting elements:", error);
  }
  return;
}

function findElementsAtPoints(points: ClickPoint[]): ElementInfo[] {
  const elements: ElementInfo[] = [];
  
  points.forEach(point => {
    const elementsAtPoint = document.elementsFromPoint(point.x, point.y);
    const relevantElement = findMostRelevantElement(elementsAtPoint);
    
    if (relevantElement) {
      const boundingBox = relevantElement.getBoundingClientRect();
      
      const absoluteBoundingBox = {
        top: boundingBox.top + window.scrollY,
        left: boundingBox.left + window.scrollX,
        right: boundingBox.right + window.scrollX,
        bottom: boundingBox.bottom + window.scrollY,
        width: boundingBox.width,
        height: boundingBox.height,
        x: boundingBox.x + window.scrollX,
        y: boundingBox.y + window.scrollY,
        toJSON() { return this; }
      };
      
      elements.push({
        element: relevantElement,
        boundingBox: absoluteBoundingBox,
        text: extractElementText(relevantElement),
        role: relevantElement.getAttribute('role') || undefined,
        tag: relevantElement.tagName.toLowerCase()
      });
    }
  });
  
  return elements;
}

function findMostRelevantElement(elements: Element[]): Element | null {
  elements = elements.filter(el => {
    if (el.classList.contains('web-access-highlight')) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'main') return false;
    return true;
  });
  
  const interactiveElements = elements.filter(el => {
    const tag = el.tagName.toLowerCase();
    return tag === 'a' || 
           tag === 'button' || 
           tag === 'input' || 
           tag === 'select' || 
           tag === 'textarea' ||
           el.getAttribute('role') === 'button' ||
           el.getAttribute('role') === 'link';
  });
  
  if (interactiveElements.length > 0) {
    return interactiveElements[0];
  }
  
  return elements.find(el => {
    const tag = el.tagName.toLowerCase();
    return tag !== 'div' && tag !== 'span' && tag !== 'section';
  }) || elements[0];
}

function extractElementText(element: Element): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  const title = element.getAttribute('title');
  if (title) return title;
  
  if (element instanceof HTMLInputElement) {
    return element.placeholder || element.value || element.name || '';
  }
  
  return element.textContent?.trim() || '';
}