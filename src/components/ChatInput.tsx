import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowUp, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PexelsMenu } from './PexelsMenu';

interface ChatInputProps {
  onSend: (message: string, imageUrl?: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPexelsOpen, setIsPexelsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((input.trim() || selectedImage) && !disabled) {
      onSend(input.trim(), selectedImage || undefined);
      setInput('');
      setSelectedImage(null);
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
          }} 
          onClose={() => setIsPexelsOpen(false)} 
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
            className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-slate-700 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all"
      >
        <button
          type="button"
          onClick={() => setIsPexelsOpen(!isPexelsOpen)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all shrink-0",
            isPexelsOpen ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          )}
          title="Add image from Pexels"
        >
          <ImageIcon size={18} />
        </button>
        
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Aura..."
          disabled={disabled}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none resize-none max-h-[200px] min-h-[40px]"
        />
        
        <button
          type="submit"
          disabled={(!input.trim() && !selectedImage) || disabled}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all shrink-0",
            (input.trim() || selectedImage) && !disabled 
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md" 
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
};
