import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ArrowUp, Image as ImageIcon, X, Mic, MicOff, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PexelsMenu } from './PexelsMenu';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSend: (message: string, imageUrl?: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPexelsOpen, setIsPexelsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pexelsTriggerRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleSubmit = useCallback((e?: React.FormEvent, forceInput?: string) => {
    e?.preventDefault();
    const textToSend = forceInput ?? input.trim();
    if ((textToSend || selectedImage) && !disabled) {
      onSend(textToSend, selectedImage || undefined);
      setInput('');
      setSelectedImage(null);
    }
  }, [input, selectedImage, disabled, onSend]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setIsTranscribing(false);
        setTranscriptError(null);
      };

      recognition.onspeechend = () => {
        setIsListening(false);
        setIsTranscribing(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => {
          const newVal = prev ? prev + ' ' + transcript : transcript;
          return newVal;
        });
        setIsTranscribing(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setTranscriptError('Failed to transcribe audio.');
        }
        setIsListening(false);
        setIsTranscribing(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsTranscribing(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (disabled) return;
    
    if (!recognitionRef.current) {
      setTranscriptError("Speech recognition not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setTranscriptError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start recognition", err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="relative">
      {isPexelsOpen && (
        <PexelsMenu 
          onSelectImage={(url) => {
            setSelectedImage(url);
            setIsPexelsOpen(false);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }} 
          onClose={() => setIsPexelsOpen(false)} 
          triggerRef={pexelsTriggerRef}
        />
      )}
      
      {selectedImage && (
        <div className="mb-2 relative inline-block">
          <img 
            src={selectedImage} 
            alt="Selected attachment" 
            className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-sm"
            referrerPolicy="no-referrer"
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-slate-700 transition-colors focus-ring"
            aria-label="Remove selected image"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <label htmlFor="chat-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-2">
        Message
      </label>
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all"
      >
        <button
          ref={pexelsTriggerRef}
          type="button"
          onClick={() => setIsPexelsOpen(!isPexelsOpen)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all shrink-0 focus-ring",
            isPexelsOpen ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          )}
          title="Add image from Pexels"
          aria-label={isPexelsOpen ? "Close image picker" : "Open image picker"}
          aria-pressed={isPexelsOpen}
        >
          <ImageIcon size={18} />
        </button>
        
        <textarea
          id="chat-input"
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening..." : isTranscribing ? "Transcribing..." : "Message Refleksyon..."}
          disabled={disabled || isListening || isTranscribing}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none resize-none max-h-[200px] min-h-[40px] focus-ring"
        />
        
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled || isTranscribing}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all shrink-0 focus-ring",
            isListening 
              ? "bg-red-100 text-red-600 animate-pulse" 
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
            (disabled || isTranscribing) && "opacity-50 cursor-not-allowed"
          )}
          title={isListening ? "Stop listening" : "Start dictation"}
          aria-label={isListening ? "Stop listening" : "Start dictation"}
        >
          {isListening ? <MicOff size={18} /> : isTranscribing ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Mic size={18} />}
        </button>

        <button
          type="submit"
          disabled={(!input.trim() && !selectedImage) || disabled || isListening || isTranscribing}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all shrink-0 focus-ring",
            (input.trim() || selectedImage) && !disabled && !isListening && !isTranscribing
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md" 
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          <ArrowUp size={18} />
        </button>
      </form>
      
      {transcriptError && (
        <div className="absolute -bottom-6 left-2 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={12} />
          {transcriptError}
        </div>
      )}
    </div>
  );
};
