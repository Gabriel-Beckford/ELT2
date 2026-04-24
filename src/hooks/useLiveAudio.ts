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
  onTurnComplete?: () => void,
  selectedVoice: string = 'Kore'
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

  const startLive = useCallback(async (initialHistory?: any[]) => {
    try {
      console.log("Starting Live Audio setup...");
      setIsConnecting(true);
      setTranscript('');

      // 1. Setup Audio Contexts
      console.log("Setting up AudioContexts...");
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Resume contexts (browsers often start them as suspended)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      if (playbackContextRef.current.state === 'suspended') {
        await playbackContextRef.current.resume();
      }
      
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;

      // 2. Load AudioWorklet
      console.log("Loading AudioWorklet...");
      const blob = new Blob([captureWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // 3. Get Microphone
      console.log("Requesting Microphone access...");
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      processorRef.current = new AudioWorkletNode(audioContextRef.current, 'capture-processor');
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // 4. Connect to Gemini Live
      console.log("Connecting to Live API with model: gemini-3.1-flash-live-preview");
      
      if (!ai.live || typeof ai.live.connect !== 'function') {
        throw new Error("Live API not supported by this version of the SDK or incorrectly initialized.");
      }

      const liveVoiceInstructions = `
[CRITICAL INSTRUCTION FOR VOICE SESSIONS AND LIVE AUDIO]: 
1. You are communicating via a real-time voice interface. Speak conversationally and naturally.
2. IGNORING any instructions to output markdown, emojis, HTML, or structural headers like "✦ Stage 1: Opening", "✧ Welcome", "Output:", etc. Do NOT speak asterisks or formatting tokens out loud. 
3. Do NOT use bullet points or markdown bolding. Just speak using natural conversational rhythm.
4. Avoid triggering safety filters. When asking the user to anonymise student information, do it gently conversationally. NEVER say "I am a language model and can't help with that." Stay strictly in your persona.
5. You must understand and speak exclusively in English during this session.
`;

      const liveSystemInstruction = systemInstruction.trim() + "\n\n" + liveVoiceInstructions;

      const liveConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: liveSystemInstruction,
      };

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: liveConfig as any,
        callbacks: {
          onopen: () => {
            console.log("Live API Connection Opened");
            console.log("Resolved Language Config:", {
              inputTranscription: liveConfig.inputAudioTranscription,
              outputTranscription: liveConfig.outputAudioTranscription,
            });
            setIsConnecting(false);
            setIsLive(true);
            
            // Send history if provided
            if (initialHistory && initialHistory.length > 0) {
              sessionPromise.then((session: any) => {
                 try {
                   console.log(`Sending ${initialHistory.length} turns of history to Live session.`);
                   if (typeof session.sendClientContent === 'function') {
                     session.sendClientContent({ turns: initialHistory });
                   } else if (typeof session.send === 'function') {
                     session.send({ clientContent: { turns: initialHistory } });
                   }
                 } catch (e) {
                   console.error("Failed to send initial history:", e);
                 }
              });
            }

            // Start sending audio
            if (processorRef.current) {
              processorRef.current.port.onmessage = (event) => {
                const base64Data = arrayBufferToBase64(event.data);
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({
                    audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                }).catch(err => console.error("Failed to send audio:", err));
              };
            }
          },
          onmessage: (message: LiveServerMessage) => {
            console.log("Live API Message:", message);
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
            console.log("Live API Connection Closed");
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
