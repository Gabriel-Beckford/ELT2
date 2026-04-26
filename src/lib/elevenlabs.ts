export async function getElevenLabsAudio(text: string, voiceId: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        }
      })
    });
    
    if (!response.ok) {
      console.error("ElevenLabs Error:", await response.text());
      return null;
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("ElevenLabs Exception:", error);
    return null;
  }
}
