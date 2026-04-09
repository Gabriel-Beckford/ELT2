import { useState, useRef, useCallback } from 'react';
import { LiveServerMessage, Modality } from '@google/genai';
import { ai } from '../lib/gemini';

// Inline AudioWorklet for capturing 16kHz PCM audio
const captureWorkletCode = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      // Convert Float32 to Int16
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function useLiveAudio(
  systemInstruction: string,
  onUserTranscriptChunk?: (text: string) => void,
  onModelTranscriptChunk?: (text: string) => void,
  onTurnComplete?: () => void
) {
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const callbacksRef = useRef({ onUserTranscriptChunk, onModelTranscriptChunk, onTurnComplete });
  callbacksRef.current = { onUserTranscriptChunk, onModelTranscriptChunk, onTurnComplete };

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  
  // Playback queue
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const stopAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    if (sessionRef.current) {
      // Close session
      // Note: The SDK might not have a direct close method exposed synchronously, 
      // but we can try to close the underlying connection if possible, or just let it drop.
      try {
        // We will just null it out, the server will close when stream stops
      } catch (e) {}
      sessionRef.current = null;
    }
    setIsLive(false);
    setIsConnecting(false);
    setTranscript('');
  }, []);

  const playAudioChunk = useCallback((base64Data: string) => {
    if (!playbackContextRef.current) return;
    
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 24kHz 16-bit PCM
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }
    
    const audioBuffer = playbackContextRef.current.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);
    
    const source = playbackContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContextRef.current.destination);
    
    const currentTime = playbackContextRef.current.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
    
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  }, []);

  const startLive = useCallback(async () => {
    try {
      setIsConnecting(true);
      setTranscript('');

      // 1. Setup Audio Contexts
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;

      // 2. Load AudioWorklet
      const blob = new Blob([captureWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(workletUrl);

      // 3. Get Microphone
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      processorRef.current = new AudioWorkletNode(audioContextRef.current, 'capture-processor');
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // 4. Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: "gemini-3-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }] as any,
          includeServerSideToolInvocations: true,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        } as any,
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsLive(true);
            
            // Start sending audio
            if (processorRef.current) {
              processorRef.current.port.onmessage = (event) => {
                const base64Data = arrayBufferToBase64(event.data);
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({
                    audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };
            }
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              playAudioChunk(base64Audio);
            }
            
            // Handle interruption
            if (message.serverContent?.interrupted) {
              if (playbackContextRef.current) {
                nextPlayTimeRef.current = playbackContextRef.current.currentTime;
              }
            }

            // Handle transcription
            if (message.serverContent?.inputTranscription?.text) {
              const text = message.serverContent.inputTranscription.text;
              setTranscript(prev => prev + text);
              callbacksRef.current.onUserTranscriptChunk?.(text);
            }
            
            if (message.serverContent?.outputTranscription?.text) {
              const text = message.serverContent.outputTranscription.text;
              setTranscript(prev => prev + text);
              callbacksRef.current.onModelTranscriptChunk?.(text);
            }
            
            if (message.serverContent?.turnComplete) {
              callbacksRef.current.onTurnComplete?.();
              setTranscript(''); // Clear overlay transcript on turn complete
            }
          },
          onclose: () => {
            stopAudio();
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            stopAudio();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to start Live Audio:", error);
      stopAudio();
    }
  }, [systemInstruction, stopAudio, playAudioChunk]);

  return {
    isLive,
    isConnecting,
    transcript,
    startLive,
    stopAudio
  };
}
