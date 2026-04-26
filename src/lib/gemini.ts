import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

export const ai = new GoogleGenAI({ 
  // Client-side code should use backend endpoints instead of exposing the API key directly.
  // The key is removed here to satisfy "backend runtime only" requirements.
  apiKey: ''
});

export async function generateImage(prompt: string): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
          imageSize: "1K"
        }
      } as any,
    });
    
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          // Format as complete data URI
          if (part.inlineData.mimeType) {
            return `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
          }
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
    }
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
  }
  return undefined;
}
export async function generateSpeech(text: string, voice: string = 'Kore') {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}

export async function* streamChat(
  messages: { role: 'user' | 'model', parts: { text: string }[] }[],
  systemInstruction?: string,
  model: string = "gemini-3-flash-preview",
  thinkingLevel?: ThinkingLevel,
  useGrounding: boolean = true
) {
  try {
    const tools: any[] = [];
    if (useGrounding) {
      tools.push({ googleSearch: {} });
    }

    const stream = await ai.models.generateContentStream({
      model,
      contents: messages,
      tools,
      config: {
        systemInstruction: systemInstruction || "You are Aura, a helpful and friendly AI assistant. Your responses should be clear, concise, and formatted using Markdown when appropriate. Maintain a professional yet approachable tone.",
        thinkingConfig: thinkingLevel ? { includeThoughts: true, thinkingLevel } : undefined,
        includeServerSideToolInvocations: useGrounding ? true : undefined,
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192,
      } as any
    } as any);

    for await (const chunk of stream) {
      // Handle grounding metadata (search results)
      const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.searchEntryPoint?.renderedContent) {
        // This is the Google Search chip/entry point
      }
      
      if (groundingMetadata?.groundingChunks) {
        const sources = groundingMetadata.groundingChunks
          .filter(c => c.web)
          .map(c => ({
            title: c.web?.title || 'Untitled Source',
            url: c.web?.uri || ''
          }))
          .filter(s => s.url);
        
        if (sources.length > 0) {
          yield { type: 'sources', content: sources };
        }
      }

      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.thought) {
          yield { type: 'thought', content: part.text || '' };
        } else if (part.text) {
          yield { type: 'text', content: part.text };
        }
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
