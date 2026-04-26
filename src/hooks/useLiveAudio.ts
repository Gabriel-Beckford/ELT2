import { useState, useRef, useCallback } from 'react';
import { transcribeAudio, generateTTSAudio } from '../services/audioService';
import { generateTextFromTranscript } from '../services/geminiService';

export function useLiveAudio(
  systemInstruction: string,
  onUserTranscriptChunk?: (text: string) => void,
  onModelTranscriptChunk?: (text: string) => void,
  onTurnComplete?: () => void,
  selectedVoice: string = 'Kore'
) {
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const callbacksRef = useRef({ onUserTranscriptChunk, onModelTranscriptChunk, onTurnComplete });
  callbacksRef.current = { onUserTranscriptChunk, onModelTranscriptChunk, onTurnComplete };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    setIsLive(false);
    setIsConnecting(false);
    setTranscript('');
  }, []);

  const processAudio = async (audioBlob: Blob) => {
    setIsConnecting(true);
    setTranscript('Transcribing...');
    try {
      // 1. STT
      const { text, confidence, fallbackMessage } = await transcribeAudio(audioBlob);
      if (!text) {
        setTranscript(fallbackMessage || 'Could not hear you well.');
        setIsConnecting(false);
        setIsLive(false);
        return;
      }

      callbacksRef.current.onUserTranscriptChunk?.(text);
      setTranscript(text);

      // 2. LLM
      setTranscript('Thinking...');
      const responseText = await generateTextFromTranscript(text, {
        systemPrompt: systemInstruction,
        modelPriority: 'auto'
      });

      callbacksRef.current.onModelTranscriptChunk?.(responseText);

      // 3. TTS
      setTranscript('Speaking...');
      const audioUrl = await generateTTSAudio(responseText, {
        voice_id: selectedVoice === 'Puck' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM' // Simplistic mapping, add real IDs as needed
      });

      const audio = new Audio(audioUrl);
      audioPlaybackRef.current = audio;
      
      audio.onended = () => {
        setIsConnecting(false);
        setIsLive(false);
        setTranscript('');
        callbacksRef.current.onTurnComplete?.();
      };
      
      await audio.play();

    } catch (e: any) {
      console.error('Voice processing pipeline error:', e);
      setTranscript('Error: ' + e.message);
      setIsConnecting(false);
      setIsLive(false);
    }
  };

  const startLive = useCallback(async (initialHistory?: any[]) => {
    try {
      setIsLive(true);
      setTranscript('Recording...');
      audioChunksRef.current = [];
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
      };
      
      mediaRecorderRef.current.start();
    } catch (error) {
      console.error("Failed to start recording:", error);
      stopAudio();
    }
  }, [systemInstruction, stopAudio, selectedVoice]);

  return {
    isLive,
    isConnecting,
    transcript,
    startLive,
    // Provide a way to manually trigger stop and process
    stopAudio: () => {
       if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop(); // will trigger processAudio
       } else {
          stopAudio();
       }
    }
  };
}
