import { auth } from './firebase';

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const token = await user.getIdToken();
  return { 'Authorization': `Bearer ${token}` };
}

export const ai = {
  live: {
    connect: async (options: any) => {
      const { model, config, callbacks } = options;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ai/live`;
      const ws = new WebSocket(wsUrl);

      const session = {
        sendRealtimeInput: (data: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ realtimeInput: data }));
          }
        },
        sendClientContent: (data: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ clientContent: data }));
          }
        },
        send: (data: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
          }
        }
      };

      ws.onopen = () => {
        // Send initial config
        ws.send(JSON.stringify({ setup: { model, generationConfig: config } }));
        callbacks?.onopen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callbacks?.onmessage?.(data);
        } catch (e) {
          console.error("Error parsing Live message:", e);
        }
      };

      ws.onclose = () => {
        callbacks?.onclose?.();
      };

      ws.onerror = (err) => {
        callbacks?.onerror?.(err);
      };

      return session;
    }
  }
};

export async function generateImage(prompt: string, model?: string, options?: any, signal?: AbortSignal, traceId?: string): Promise<{url: string, traceId: string} | undefined> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch('/api/ai/image', {
      method: 'POST',
      headers: { 
        ...headers,
        'Content-Type': 'application/json',
        'X-Trace-Id': traceId || crypto.randomUUID()
      },
      body: JSON.stringify({ prompt, model, options }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();
    return { url: data.url, traceId: data.traceId || traceId };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return undefined;
    console.error("Gemini Image Gen Error:", error);
  }
  return undefined;
}

export async function generateSpeech(text: string, voice: string = 'Kore', signal?: AbortSignal) {
  try {
    const headers = await getAuthHeader();
    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}

export async function* streamChat(
  messages: { role: 'user' | 'model', parts: { text: string }[] }[],
  systemInstruction?: string,
  model: string = "gemini-3-flash-preview",
  thinkingLevel?: any,
  useGrounding: boolean = true,
  signal?: AbortSignal,
  traceId?: string
) {
  try {
    const headers = await getAuthHeader();
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'X-Trace-Id': traceId || crypto.randomUUID()
      },
      body: JSON.stringify({
        messages,
        systemInstruction,
        model,
        thinkingLevel,
        useGrounding
      }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.statusText}`);
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') return;
          
          try {
            const chunk = JSON.parse(dataStr);
            if (chunk.type === 'error') {
              throw new Error(chunk.content);
            }
            yield chunk;
          } catch (e) {
            console.error("Error parsing SSE chunk:", e);
          }
        }
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
