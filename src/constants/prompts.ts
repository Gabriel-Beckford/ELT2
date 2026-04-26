import facilitatorPrompt from './facilitatorPrompt.xml?raw';
import reflectiveGuidePrompt from './reflectiveGuidePrompt.xml?raw';

export const SYSTEM_PROMPTS = {
  facilitator: {
    id: 'facilitator',
    name: 'Lesson Facilitator',
    description: 'An interactive lesson facilitator for a professional development module on reflective practice.',
    content: facilitatorPrompt
  },
  reflective_guide: {
    id: 'reflective_guide',
    name: 'Reflective Guide',
    description: 'A reflective guide for experienced online ELT teachers working with Haitian learners.',
    content: reflectiveGuidePrompt
  }
};

export type PromptId = 'facilitator' | 'reflective_guide';

