export type ModelPriority = 'speed' | 'balanced' | 'quality' | 'auto';

export interface GeminiRequestConfig {
  systemPrompt?: string;
  safetySettings?: any;
  maxOutputTokens?: number;
  temperature?: number;
  modelPriority?: ModelPriority;
}

export async function generateTextFromTranscript(
  transcriptText: string,
  config: GeminiRequestConfig = {}
): Promise<string> {
  const {
    systemPrompt,
    safetySettings,
    maxOutputTokens = 150, // default concise for voice
    temperature = 0.7,
    modelPriority = 'auto' // automatically picks Flash Lite for short text, Pro for long text
  } = config;

  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: transcriptText,
      modelType: modelPriority,
      systemPrompt,
      safetySettings,
      maxOutputTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to generate response: ${response.statusText}`);
  }

  const data = await response.json();
  return data.text;
}
