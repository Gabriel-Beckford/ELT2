export interface ValidationResult {
  isValid: boolean;
  reasonCode?: 'NOT_A_DIAGRAM' | 'BANNED_CONTENT' | 'ANSWER_REVEALING' | 'SAFEGUARDING' | 'INVALID_INPUT';
  message?: string;
}

/**
 * Deterministic validation layer for image prompt policy compliance.
 * Aura is a pedagogical assistant that primarily helps with diagrams and visual scaffolds.
 */

const BANNED_KEYWORDS = [
  'violence', 'blood', 'gore', 'porn', 'naked', 'nudity', 
  'hate', 'racist', 'slur', 'weapon', 'gun', 'kill', 'death',
  'exploding', 'scary', 'horror', 'terror', 'offensive'
];

const DIAGRAM_KEYWORDS = [
  'diagram', 'chart', 'graph', 'infographic', 'map', 
  'cycle', 'process', 'flow', 'visual aid', 'schematic',
  'mind map', 'venn', 'table', 'structure', 'architecture',
  'anatomy', 'biological', 'system', 'workflow', 'concept',
  'scaffold', 'educational'
];

const ANSWER_REVEALING_KEYWORDS = [
  'answer', 'solution', 'result', 'key', 'cheat', 'correct',
  'resolved', 'finished task', 'complete answer'
];

/**
 * Validates an image prompt against pedagogical and safety policies.
 */
export function validateImagePrompt(prompt: string): ValidationResult {
  if (!prompt || typeof prompt !== 'string') {
    return { 
      isValid: false, 
      reasonCode: 'INVALID_INPUT', 
      message: 'Image prompt is missing or malformed.' 
    };
  }

  const normalized = prompt.toLowerCase();

  // 1. Safeguarding / Banned Content
  // These are standard safety checks to ensure educational environment integrity.
  for (const word of BANNED_KEYWORDS) {
    if (normalized.includes(word)) {
      return { 
        isValid: false, 
        reasonCode: 'BANNED_CONTENT', 
        message: 'Prompt contains restricted content categories.' 
      };
    }
  }

  // 2. Diagram-only requirement
  // Aura only generates visual aids for learning, not generic artistic images.
  const hasDiagramKeyword = DIAGRAM_KEYWORDS.some(kw => normalized.includes(kw));
  if (!hasDiagramKeyword) {
    return { 
      isValid: false, 
      reasonCode: 'NOT_A_DIAGRAM', 
      message: 'Image prompts must be for educational diagrams or visual scaffolds only.' 
    };
  }

  // 3. No answer-revealing wording
  // Prevents the model from visualizing the solution to an activity before the learner engages.
  for (const word of ANSWER_REVEALING_KEYWORDS) {
    if (normalized.includes(word)) {
      return { 
        isValid: false, 
        reasonCode: 'ANSWER_REVEALING', 
        message: 'Prompt appears to reveal solutions for pending activities.' 
      };
    }
  }

  // 4. Safeguarding Pause Block (Length and complexity limits)
  if (normalized.length > 1500) {
    return { 
      isValid: false, 
      reasonCode: 'SAFEGUARDING', 
      message: 'Prompt complexity exceeds safety guidelines.' 
    };
  }

  return { isValid: true };
}
