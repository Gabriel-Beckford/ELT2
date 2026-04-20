import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, useReducedMotion } from 'motion/react';
import { User, Bot, Volume2, Loader2, Edit2, Check, X, RotateCcw, ChevronDown, ChevronRight, ExternalLink, Globe, Cpu, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Message } from '@/src/types';
import { generateSpeech } from '@/src/lib/gemini';
import { playAudioFromBase64 } from '@/src/lib/audio';

interface ChatMessageProps {
  message: Message;
  onUpdate?: (content: string, status: 'draft' | 'finalized') => void;
  onRegenerate?: () => void;
  selectedVoice?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onUpdate, onRegenerate, selectedVoice = 'Kore' }) => {
  const isUser = message.role === 'user';
  const shouldReduceMotion = useReducedMotion();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showThoughts, setShowThoughts] = useState(false);

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const base64Audio = await generateSpeech(message.content, selectedVoice);
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
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
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
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all">
            {!isEditing && (
              <>
                {!isUser && message.content && (
                  <button
                    onClick={handleSpeak}
                    disabled={isSpeaking}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md transition-all outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-200 focus:text-slate-600",
                      isSpeaking ? "bg-indigo-100 text-indigo-600 opacity-100" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    )}
                    title="Listen to message"
                    aria-label="Listen to message"
                  >
                    {isSpeaking ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-200 focus:text-slate-600"
                  title="Edit message"
                  aria-label="Edit message"
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
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Cancel edit"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                aria-label="Save message"
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
              <div className="mb-4 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                <button 
                  onClick={() => setShowThoughts(!showThoughts)}
                  className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-700 hover:bg-slate-200/50 transition-colors outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 focus:bg-slate-200/50"
                  aria-label={showThoughts ? "Hide thoughts" : "Show thoughts"}
                  aria-pressed={showThoughts}
                >
                  <div className="flex items-center gap-2">
                    <Bot size={14} /> 
                    <span>Aura's Thoughts</span>
                    {message.modelSettings && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-200/50 text-[10px] text-slate-500 font-medium">
                        <Cpu size={10} />
                        {message.modelSettings.label} • {message.model}
                      </span>
                    )}
                    {message.phase && message.phase !== 'finalizing' && (
                      <span className="flex items-center gap-1 text-indigo-500 animate-pulse">
                        <Loader2 size={10} className="animate-spin" />
                        {message.phase === 'drafting' ? 'Thinking...' : 'Refining...'}
                      </span>
                    )}
                  </div>
                  {showThoughts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                {showThoughts && (
                  <div className="p-4 pt-0 text-sm text-slate-600 border-t border-slate-200/50">
                    <div className="h-2" />
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

                    {message.modelSettings && (
                      <div className="mt-4 pt-3 border-t border-slate-200/50 grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Model</span>
                          <span className="text-[10px] text-slate-600 font-mono truncate">{message.model}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reasoning</span>
                          <span className="text-[10px] text-slate-600">{message.modelSettings.thinking}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Speed</span>
                          <span className="text-[10px] text-slate-600">{message.modelSettings.speed}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <ReactMarkdown>{message.content}</ReactMarkdown>
            
            {message.sources && message.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  <Globe size={10} /> Sources
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {message.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group/source"
                    >
                      <div className="flex-shrink-0 h-8 w-8 rounded bg-slate-50 flex items-center justify-center border border-slate-100 group-hover/source:bg-white">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`} 
                          alt="" 
                          aria-hidden="true"
                          className="h-4 w-4"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate group-hover/source:text-indigo-700">
                          {source.title}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {new URL(source.url).hostname}
                        </p>
                      </div>
                      <ExternalLink size={10} className="text-slate-300 group-hover/source:text-indigo-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {!message.content && message.role === 'assistant' && (
              <div className="flex flex-col gap-4 py-2">
                <div className="flex items-center gap-3 text-indigo-500 italic text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="font-medium tracking-tight">
                    {message.phase === 'drafting' ? 'Refleksyon is drafting a pedagogical response...' : 'Refining for reflective practice...'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-slate-100 rounded-full animate-pulse" />
                  <div className="h-2 w-3/4 bg-slate-100 rounded-full animate-pulse" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
