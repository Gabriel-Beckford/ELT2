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
