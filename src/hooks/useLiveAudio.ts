import { useState, useRef, useCallback } from 'react';

export function useLiveAudio(
  systemInstruction?: string,
  onUserTranscriptChunk?: (text: string) => void,
  onModelTranscriptChunk?: (text: string) => void,
  onTurnComplete?: () => void,
  selectedVoice: string = 'Kore'
) {
  const [isLive, setIsLive] = useState(false); // Used as "isRecording"
  const [isConnecting, setIsConnecting] = useState(false); // Used as "isProcessing"
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const playTTS = async (text: string) => {
    try {
      // Map generic names to ElevenLabs voice IDs if needed, or just default
      // Default ElevenLabs voice ID for example: N2lVS1w4EtoT3g4xXjV7
      const voiceMap: Record<string, string> = {
        'Puck': 'N2lVS1w4EtoT3g4xXjV7', // generic male
        'Charon': 'cjVigY5qzO86HufA1Azz', // generic male deep
        'Kore': 'EXAVITQu4vr4xnSDxMaL', // generic female
        'Fenrir': 'VR6AewLTigWG4xSOukaG', // generic male aggressive
        'Aoede': '21m00Tcm4TlvDq8ikWAM' // generic female smooth
      };
      
      const voiceId = voiceMap[selectedVoice] || 'N2lVS1w4EtoT3g4xXjV7';

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId })
      });
      
      if (!response.ok) throw new Error('Failed to fetch TTS');
      
      const arrayBuffer = await response.arrayBuffer();
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
    } catch (error) {
      console.error("TTS playback error:", error);
    }
  };

  const startLive = useCallback(async (initialHistory?: any[]) => {
    try {
      setIsConnecting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else mimeType = ''; // Let browser choose default
      }
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsConnecting(true);
        const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const formData = new FormData();
        formData.append('file', audioBlob);
        
        try {
          const res = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              setTranscript(data.text);
              onUserTranscriptChunk?.(data.text);
              // Inform that turn is complete so it triggers submission
              setTimeout(() => {
                onTurnComplete?.();
              }, 100);
            }
          }
        } catch (error) {
          console.error("STT Error:", error);
        } finally {
          setIsConnecting(false);
          setIsLive(false);
          // Stop media tracks
          stream.getTracks().forEach(t => t.stop());
        }
      };

      mediaRecorder.start();
      setIsLive(true);
      setIsConnecting(false);
    } catch (error: any) {
      console.error("Failed to start recording:", error);
      setIsConnecting(false);
      let msg = error.message || "Requested device not found";
      
      if (error.name === "NotFoundError" || msg.includes("device not found")) {
        console.error("Microphone not found. Please ensure a microphone is connected or open in a new tab.");
        setError("Microphone not found. Please ensure a microphone is connected. If you're in the preview, open in a new tab.");
      } else {
        console.error(`Microphone error: ${msg}`);
        setError(`Microphone error: ${msg}`);
      }
    }
  }, [onUserTranscriptChunk, onTurnComplete]);

  const stopAudio = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isLive,
    isConnecting,
    transcript,
    error,
    setError,
    startLive,
    stopAudio,
    playTTS
  };
}
