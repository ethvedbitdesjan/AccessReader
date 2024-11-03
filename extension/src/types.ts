export interface SpecialIntent {
  prompt: string;
  numPoints: number;
}

export interface ElementDescription {
  element: ElementInfo;
  description: string;
}

export interface ClickPoint {
  x: number;
  y: number;
}

export interface UserPreferences {
  interests: string[];
  voiceSettings: {
    rate: number;
    pitch: number;
    volume: number;
  };
}

export interface NavigationData {
  screenshot: string;
  intent: string;
  width: number;
  height: number;
}

export interface NavigationResults {
  elements: ElementInfo[];
  content: ElementDescription[];
}

// Request types
export interface ContentScriptReadyRequest {
  type: 'contentScriptReady';
}

export interface ProcessNavigationRequest {
  type: 'processNavigation';
  data: NavigationData;
}

export type ExtensionRequest = 
  | ContentScriptReadyRequest 
  | ProcessNavigationRequest;

// Response types
export interface MessageResponse {
  status: 'acknowledged' | 'error';
  error?: string;
}

// Chrome message types
export interface StartNavigationMessage {
  action: 'startNavigation';
}

export interface PresentResultsMessage {
  action: 'presentResults';
  data: NavigationResults;
}

export interface PresentErrorMessage {
  action: 'presentError';
  data: {
    audio: string;
  };
}

export type ExtensionMessage = 
  | StartNavigationMessage 
  | PresentResultsMessage 
  | PresentErrorMessage
  | SelectElementMessage;

export interface ElementInfo {
  element: Element;
  boundingBox: DOMRect;
  text: string;
  role?: string;
  tag: string;
  href?: string;
}

export interface SelectElementMessage {
  action: 'selectElement';
  data: {
    optionIndex: number;
  };
}