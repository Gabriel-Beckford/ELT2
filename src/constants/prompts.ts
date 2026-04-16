import facilitatorPrompt from './facilitatorPrompt.xml?raw';

export const SYSTEM_PROMPTS = {
  facilitator: {
    id: 'facilitator',
    name: 'Lesson Facilitator',
    description: 'An interactive lesson facilitator for a professional development module on reflective practice.',
    content: facilitatorPrompt
  }
};

export type PromptId = 'facilitator';

