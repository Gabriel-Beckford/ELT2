export interface Source {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draftContent?: string;
  imageUrl?: string;
  thoughts?: string;
  draftThoughts?: string;
  reviewThoughts?: string;
  phase?: 'drafting' | 'reviewing' | 'finalizing';
  model?: string;
  modelSettings?: {
    label: string;
    speed: string;
    thinking: string;
  };
  sources?: Source[];
  status: 'draft' | 'finalized';
  timestamp: number;
}

export interface UserProfile {
  name: string;
  age: string;
  gender: string;
  uniqueLearningNeeds: string;
  qualifications: string;
  kolbLearningStyle: string;
  lastUpdatedAt?: number;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  selectedPromptId: string;
  model?: string;
  sliderValue?: number;
  useGrounding?: boolean;
  selectedModel?: string;
  selectedTheme?: string;
  voiceEnabled?: boolean;
  autoReadResponses?: boolean;
  ttsVoiceName?: string;
  ttsRate?: number;
  ttsPitch?: number;
  sttMode?: 'browser' | 'server';
  createdAt: number;
  updatedAt: number;
}
