import { scaffoldPrompt } from './scaffoldPrompt';
import { facilitatorPrompt } from './facilitatorPrompt';

export const SYSTEM_PROMPTS = {
  scaffold: {
    id: 'scaffold',
    name: 'Reflective Practice Scaffold',
    description: 'A reflective-practice scaffold for experienced online ELT teachers working with Haitian learners.',
    content: scaffoldPrompt
  },
  facilitator: {
    id: 'facilitator',
    name: 'Lesson Facilitator',
    description: 'An interactive lesson facilitator for a professional development module on reflective practice.',
    content: facilitatorPrompt
  }
};

export type PromptId = keyof typeof SYSTEM_PROMPTS;

