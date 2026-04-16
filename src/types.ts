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
  soloAssessment?: string;
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
  createdAt: number;
  updatedAt: number;
}
