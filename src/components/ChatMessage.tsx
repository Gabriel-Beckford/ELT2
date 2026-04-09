import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { User, Bot, Volume2, Loader2, Edit2, Check, X, RotateCcw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Message } from '@/src/types';
import { generateSpeech } from '@/src/lib/gemini';
import { playAudioFromBase64 } from '@/src/lib/audio';

interface ChatMessageProps {
  message: Message;
  onUpdate?: (content: string, status: 'draft' | 'finalized') => void;
  onRegenerate?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onUpdate, onRegenerate }) => {
  const isUser = message.role === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const base64Audio = await generateSpeech(message.content);
      if (base64Audio) {
        await playAudioFromBase64(base64Audio);
      }
    } catch (error) {
      console.error("Failed to play audio:", error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleSave = () => {
    onUpdate?.(editContent, 'finalized');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full gap-4 p-4 md:p-6 group relative",
        isUser ? "bg-transparent" : "bg-slate-50/50"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border shadow-sm",
        isUser ? "bg-white border-slate-200" : "bg-indigo-600 border-indigo-500 text-white"
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {isUser ? 'You' : 'Aura'}
              {message.phase && (
                <span className="ml-2 text-[10px] font-bold text-indigo-400 lowercase tracking-normal bg-indigo-50 px-1.5 py-0.5 rounded animate-pulse">
                  {message.phase === 'drafting' ? 'drafting...' : message.phase === 'reviewing' ? 'refining...' : 'finalizing...'}
                  {message.model && <span className="ml-1 opacity-60">({message.model})</span>}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            {!isEditing && (
              <>
                {!isUser && message.content && (
                  <button
                    onClick={handleSpeak}
                    disabled={isSpeaking}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                      isSpeaking ? "bg-indigo-100 text-indigo-600 opacity-100" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    )}
                    title="Listen to message"
                  >
                    {isSpeaking ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  title="Edit message"
                >
                  <Edit2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[100px] rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Check size={14} /> Save
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none break-words text-slate-800 leading-relaxed">
            {message.imageUrl && (
              <div className="mb-4">
                <img 
                  src={message.imageUrl} 
                  alt="Attached image" 
                  className="max-w-sm w-full rounded-xl border border-slate-200 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            {(message.thoughts || message.draftThoughts || message.reviewThoughts) && (
              <div className="mb-4 rounded-lg bg-slate-100 p-4 text-sm text-slate-600 border border-slate-200">
                <div className="font-semibold mb-3 text-slate-700 flex items-center gap-2">
                  <Bot size={14} /> Aura's Thoughts
                </div>
                
                {message.draftThoughts && (
                  <div className="mb-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Thinking
                    </div>
                    <ReactMarkdown>{message.draftThoughts}</ReactMarkdown>
                  </div>
                )}

                {message.draftContent && (
                  <div className="mb-3 opacity-60 border-l-2 border-slate-200 pl-3 italic text-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 not-italic">Initial Draft</div>
                    <ReactMarkdown>{message.draftContent}</ReactMarkdown>
                  </div>
                )}
                
                {message.reviewThoughts && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Reflecting
                    </div>
                    <ReactMarkdown>{message.reviewThoughts}</ReactMarkdown>
                  </div>
                )}

                {message.thoughts && !message.draftThoughts && !message.reviewThoughts && (
                  <ReactMarkdown>{message.thoughts}</ReactMarkdown>
                )}
              </div>
            )}
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {!message.content && message.role === 'assistant' && (
              <div className="flex items-center gap-2 text-slate-400 italic text-sm animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span>{message.phase === 'drafting' ? 'Drafting response...' : 'Refining response...'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
