export interface TTSConfig {
  voice_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  output_format?: string;
}

export async function generateTTSAudio(text: string, config: TTSConfig = {}): Promise<string> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      ...config
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to generate TTS: ${response.statusText}`);
  }

  // Convert the response buffer to a Blob and create a local URL
  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);
  
  return audioUrl;
}

export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string, confidence: number, fallbackMessage?: string }> {
  const formData = new FormData();
  let ext = 'webm';
  if (audioBlob.type.includes('mp4')) ext = 'm4a';
  else if (audioBlob.type.includes('ogg')) ext = 'ogg';
  else if (audioBlob.type.includes('mpeg')) ext = 'mp3';
  
  formData.append('audio', audioBlob, `audio.${ext}`);

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to transcribe audio: ${response.statusText}`);
  }

  return await response.json();
}
