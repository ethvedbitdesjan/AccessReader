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
  const init = "";
  await speak(init);
  speechInitialized = true;
  console.log("Speech synthesis initialized");
}

// Selection keyboard handler
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.altKey && /^[1-9]$/.test(event.key)) {
    console.error("Selection key pressed:", event.key);
    const optionIndex = parseInt(event.key) - 1;
    provideFeedback(optionIndex);
    if (currentElements[optionIndex]) {
      const coordinates= currentElements[optionIndex].boundingBox;
      //find if element is button and has href
      console.log("Element tag: ", currentElements[optionIndex]);
        const redirect_link = currentElements[optionIndex].href;
        if (redirect_link) {
          //redirect to the link
          console.error("Sending selection feedback to content script: ", redirect_link);
          window.location.href = redirect_link;
        }
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
      
      const screenshot = await captureEntireScreen();
      const intent = await getUserIntent();
      const width = window.innerWidth;
      const height = window.innerHeight;
      chrome.runtime.sendMessage({
          type: "processNavigation",
          data: {
              screenshot,
              intent,
              width,
              height
          } as NavigationData
      });
  } catch (error) {
      console.error("Error starting navigation:", error);
  }
}

export async function captureEntireScreen(): Promise<string> {
  return new Promise((resolve, reject) => {
    const { scrollHeight, clientHeight } = document.documentElement;
    const devicePixelRatio = window.devicePixelRatio || 1;
    let capturedHeight = 0;
    let capturedImages: string[] = [];
    let originalScrollPosition = window.scrollY;

    const captureAndScroll = () => {
      const scrollAmount = clientHeight * devicePixelRatio;
      
      chrome.runtime.sendMessage(
        { action: "captureVisibleTab", pixelRatio: devicePixelRatio },
        async (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          capturedImages.push(dataUrl);
          capturedHeight += scrollAmount;
          
          if (capturedHeight < scrollHeight * devicePixelRatio) {
            // Scroll to the next part of the page
            window.scrollTo(0, capturedHeight / devicePixelRatio);
            setTimeout(captureAndScroll, 2000); // 2 second delay between captures
          } else {
            try {
              // Stitch images together
              const stitchedImage = await stitchImages(capturedImages);
              // Restore original scroll position
              window.scrollTo(0, originalScrollPosition);
              resolve(stitchedImage);
            } catch (error) {
              console.error("Error stitching images:", error);
              reject(error);
            }
          }
        }
      );
    };

    try {
      // Start the capture process
      captureAndScroll();
    } catch (error) {
      console.error("Error in captureEntireScreen:", error);
      // Restore original scroll position on error
      window.scrollTo(0, originalScrollPosition);
      reject(error);
    }
  });
}

// Add this new function to content.ts
async function stitchImages(images: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (images.length === 0) {
      reject(new Error("No images to stitch"));
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    if (!context) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    // Load the first image to get dimensions
    const firstImage = new Image();
    firstImage.onload = () => {
      // Set canvas dimensions
      canvas.width = firstImage.width;
      canvas.height = firstImage.height * images.length;

      let imagesLoaded = 0;

      // Function to draw image on canvas
      const drawImageOnCanvas = (image: HTMLImageElement, index: number) => {
        context.drawImage(image, 0, index * firstImage.height);
        imagesLoaded++;

        // Check if all images are loaded and drawn
        if (imagesLoaded === images.length) {
          // Convert the final stitched image to base64
          const stitchedImageBase64 = canvas.toDataURL("image/png")
            .replace(/^data:image\/png;base64,/, '');
          resolve(stitchedImageBase64);
        }
      };

      // Load and draw each image
      images.forEach((dataUrl, index) => {
        const image = new Image();
        image.onload = () => drawImageOnCanvas(image, index);
        image.onerror = () => {
          console.error(`Error loading image at index ${index}`);
          reject(new Error(`Failed to load image at index ${index}`));
        };
        image.src = dataUrl;
      });
    };

    firstImage.onerror = () => {
      reject(new Error("Failed to load first image"));
    };

    firstImage.src = images[0];
  });
}

async function getUserIntent(): Promise<string> {
  return "news"; // Placeholder
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
      
      const href_link = relevantElement.getAttribute('href');
      elements.push({
        element: relevantElement,
        boundingBox: absoluteBoundingBox,
        text: extractElementText(relevantElement),
        role: relevantElement.getAttribute('role') || undefined,
        tag: relevantElement.tagName.toLowerCase(),
        href: href_link? href_link : undefined
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