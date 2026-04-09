import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trash2, Github, Bot, Settings, ChevronDown, ChevronUp, BookOpen, MessageSquare, LogOut, Plus, Mic, MicOff, Loader2 } from 'lucide-react';
import { ThinkingLevel } from "@google/genai";
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MemorySettings } from './MemorySettings';
import { Message, Chat, UserProfile } from '@/src/types';
import { streamChat } from '@/src/lib/gemini';
import { cn } from '@/src/lib/utils';
import { SYSTEM_PROMPTS, PromptId } from '@/src/constants/prompts';
import { auth, db, logOut } from '@/src/lib/firebase';
import { useLiveAudio } from '@/src/hooks/useLiveAudio';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';

const SLIDER_POINTS = [
  { id: 1, model: 'gemini-3.1-pro-preview', thinking: ThinkingLevel.HIGH, label: 'Deep Reasoning', speed: 'Slowest' },
  { id: 2, model: 'gemini-3-flash-preview', thinking: ThinkingLevel.HIGH, label: 'High Reasoning', speed: 'Very Slow' },
  { id: 3, model: 'gemini-3-flash-preview', thinking: ThinkingLevel.HIGH, label: 'Balanced', speed: 'Slow' },
  { id: 4, model: 'gemini-3-flash-preview', thinking: ThinkingLevel.LOW, label: 'Fast Reasoning', speed: 'Medium' },
  { id: 5, model: 'gemini-3-flash-preview', thinking: ThinkingLevel.LOW, label: 'Minimal Reasoning', speed: 'Fast' },
  { id: 6, model: 'gemini-3.1-flash-lite-preview', thinking: ThinkingLevel.LOW, label: 'Lite Balanced', speed: 'Very Fast' },
  { id: 7, model: 'gemini-3.1-flash-lite-preview', thinking: ThinkingLevel.LOW, label: 'Minimal Latency', speed: 'Fastest' },
];

export const ChatInterface: React.FC<{ initialPromptId?: PromptId }> = ({ initialPromptId }) => {
  const user = auth.currentUser;
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<PromptId>(initialPromptId || 'scaffold');
  const [sliderValue, setSliderValue] = useState(3); // Default to Balanced
  const [useGrounding, setUseGrounding] = useState(true);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'mode' | 'memory'>('mode');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live audio draft states
  const [liveUserText, setLiveUserText] = useState('');
  const [liveModelText, setLiveModelText] = useState('');

  // Streaming state for text chat
  const [streamingMessage, setStreamingMessage] = useState<{
    content: string;
    draftContent: string;
    draftThoughts: string;
    reviewThoughts: string;
    phase: 'drafting' | 'reviewing' | 'finalizing';
    model?: string;
  } | null>(null);

  const systemPrompt = SYSTEM_PROMPTS[selectedPromptId].content;
  
  const fullSystemInstruction = userProfile ? `
    ${systemPrompt}
    
    USER MEMORY (Reference this information about the user):
    - Name: ${userProfile.name}
    - Age: ${userProfile.age}
    - Gender: ${userProfile.gender}
    - Unique Learning Needs: ${userProfile.uniqueLearningNeeds}
    - Qualifications: ${userProfile.qualifications}
    - Kolb Learning Style: ${userProfile.kolbLearningStyle}
    
    Always tailor your pedagogical approach, tone, and examples to match the user's profile and learning style.
  ` : systemPrompt;
  
  const handleUserTranscript = (text: string) => {
    setLiveUserText(prev => prev + text);
  };

  const handleModelTranscript = (text: string) => {
    setLiveModelText(prev => prev + text);
  };

  const handleTurnComplete = async () => {
    if (!user) return;
    
    let chatId = activeChatId;
    const titleText = liveUserText.trim() || liveModelText.trim();
    if (!chatId && titleText) {
      chatId = await createNewChat(titleText.slice(0, 30) + (titleText.length > 30 ? '...' : ''));
    }
    
    if (!chatId) return;
    
    // Save user message if exists
    if (liveUserText.trim()) {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId: chatId,
        role: 'user',
        content: liveUserText.trim(),
        status: 'finalized',
        timestamp: Date.now() - 1000, // slightly before model
      });
    }
    
    // Save model message if exists
    if (liveModelText.trim()) {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId: chatId,
        role: 'assistant',
        content: liveModelText.trim(),
        status: 'finalized',
        timestamp: Date.now(),
      });
    }
    
    setLiveUserText('');
    setLiveModelText('');
  };

  const { isLive, isConnecting, transcript, startLive, stopAudio } = useLiveAudio(
    fullSystemInstruction,
    handleUserTranscript,
    handleModelTranscript,
    handleTurnComplete
  );

  // Fetch user profile
  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'profiles', user.uid);
    return onSnapshot(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      }
    });
  }, [user]);

  // Fetch user's chats
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatList);
    });
  }, [user]);

  // Fetch messages for active chat
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat) {
      if (activeChat.selectedPromptId) setSelectedPromptId(activeChat.selectedPromptId as PromptId);
      if (activeChat.sliderValue) setSliderValue(activeChat.sliderValue);
      if (activeChat.useGrounding !== undefined) setUseGrounding(activeChat.useGrounding);
    }
    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgList);
    });
  }, [activeChatId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewChat = async (title: string) => {
    if (!user) return null;
    const chatData = {
      userId: user.uid,
      title,
      selectedPromptId,
      sliderValue,
      useGrounding,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const docRef = await addDoc(collection(db, 'chats'), chatData);
    setActiveChatId(docRef.id);
    return docRef.id;
  };

  const handleSend = async (content: string, imageUrl?: string) => {
    if (!user) return;

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createNewChat(content.slice(0, 30) + (content.length > 30 ? '...' : ''));
    }

    if (!chatId) return;

    // Add user message as finalized immediately
    const userMsgData: any = {
      chatId,
      role: 'user',
      content,
      status: 'finalized',
      timestamp: Date.now(),
    };
    if (imageUrl) {
      userMsgData.imageUrl = imageUrl;
    }
    await addDoc(collection(db, 'chats', chatId, 'messages'), userMsgData);
    
    // Update chat timestamp
    await updateDoc(doc(db, 'chats', chatId), { updatedAt: Date.now() });

    // Trigger AI response in background
    const finalizedMessages = messages.filter(m => m.status === 'finalized');
    const history = [
      ...finalizedMessages.map(msg => {
        const parts: any[] = [{ text: msg.content }];
        // Note: We don't re-fetch historical images for context here to save bandwidth,
        // but we could if needed. For now, just text context for history.
        return {
          role: msg.role === 'user' ? 'user' as const : 'model' as const,
          parts
        };
      })
    ];

    const currentParts: any[] = [{ text: content || "Here is an image." }];
    
    if (imageUrl) {
      try {
        // Fetch image via proxy to avoid CORS and get base64
        const response = await fetch(`/api/pexels/proxy?url=${encodeURIComponent(imageUrl)}`);
        if (response.ok) {
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = (reader.result as string).split(',')[1];
              resolve(base64data);
            };
            reader.readAsDataURL(blob);
          });
          currentParts.push({
            inlineData: {
              data: base64,
              mimeType: blob.type || 'image/jpeg'
            }
          });
        }
      } catch (err) {
        console.error("Failed to process image for Gemini:", err);
      }
    }

    history.push({ role: 'user' as const, parts: currentParts });
    
    generateAIResponse(chatId, history);
  };

  const handleUpdateMessage = async (msgId: string, content: string, status: 'draft' | 'finalized') => {
    if (!activeChatId) return;
    const msgRef = doc(db, 'chats', activeChatId, 'messages', msgId);
    await updateDoc(msgRef, { content, status });
  };

    const generateAIResponse = async (chatId: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
    setIsLoading(true);
    const currentPoint = SLIDER_POINTS.find(p => p.id === sliderValue) || SLIDER_POINTS[2];
    
    // Initialize streaming message with empty content for the final area
    setStreamingMessage({ 
      content: '', 
      draftContent: '', 
      draftThoughts: '', 
      reviewThoughts: '', 
      phase: 'drafting',
      model: currentPoint.model
    });
    
    try {
      // PHASE 1: DRAFTING
      let draftContent = '';
      let draftThoughts = '';
      const draftStream = streamChat(history, fullSystemInstruction, currentPoint.model, currentPoint.thinking, useGrounding);
      for await (const chunk of draftStream) {
        if (typeof chunk === 'string') {
          draftContent += chunk;
        } else if (chunk.type === 'thought') {
          draftThoughts += chunk.content;
        } else if (chunk.type === 'text') {
          draftContent += chunk.content;
        }
        // Update draftContent but keep main content empty during this phase
        setStreamingMessage(prev => prev ? { ...prev, draftContent, draftThoughts } : null);
      }

      // PHASE 2: REVIEWING (Agentic Step)
      setStreamingMessage(prev => prev ? { ...prev, phase: 'reviewing' } : null);
      
      const reviewPrompt = `
        You are a pedagogical supervisor. Review the following draft response from an AI assistant to a teacher.
        The assistant is supposed to follow this system instruction:
        
        <system_instruction>
        ${fullSystemInstruction}
        </system_instruction>
        
        Draft Response:
        "${draftContent}"
        
        Your task:
        1. Check if the response strictly follows the pedagogical rules (Kolb's cycle, reflective practice, etc.).
        2. If it's good, return it as is.
        3. If it can be improved (e.g., more encouraging, better scaffolding, clearer questions), revise it.
        4. Return ONLY the final revised text. Do not include any meta-commentary.
      `;

      let revisedContent = '';
      let revisedThoughts = '';
      
      const reviewStream = streamChat(
        [{ role: 'user', parts: [{ text: reviewPrompt }] }], 
        "You are a strict pedagogical reviewer. Return only the revised text.", 
        currentPoint.model, 
        currentPoint.thinking, 
        false 
      );

      for await (const chunk of reviewStream) {
        if (typeof chunk === 'string') {
          revisedContent += chunk;
        } else if (chunk.type === 'thought') {
          revisedThoughts += chunk.content;
        } else if (chunk.type === 'text') {
          revisedContent += chunk.content;
        }
        
        // Now we populate the main content area with the revised text
        setStreamingMessage(prev => prev ? { 
          ...prev, 
          content: revisedContent,
          reviewThoughts: revisedThoughts 
        } : null);
      }

      // PHASE 3: SAVE FINALIZED RESPONSE
      setStreamingMessage(prev => prev ? { ...prev, phase: 'finalizing', content: revisedContent || draftContent } : null);
      
      const modelMsgData: any = {
        chatId,
        role: 'assistant',
        content: revisedContent || draftContent,
        draftContent: draftContent, // Save the draft for history/debugging
        model: currentPoint.model,
        status: 'finalized',
        timestamp: Date.now(),
      };
      
      if (draftThoughts) modelMsgData.draftThoughts = draftThoughts;
      if (revisedThoughts) modelMsgData.reviewThoughts = revisedThoughts;

      await addDoc(collection(db, 'chats', chatId, 'messages'), modelMsgData);

    } catch (error) {
      console.error("Agentic workflow failed:", error);
    } finally {
      setIsLoading(false);
      setStreamingMessage(null);
    }
  };

  const clearChat = async () => {
    if (!activeChatId) return;
    const msgs = await getDocs(collection(db, 'chats', activeChatId, 'messages'));
    for (const d of msgs.docs) {
      await deleteDoc(d.ref);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <button 
            onClick={() => setActiveChatId(null)}
            className="flex w-full items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Plus size={18} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-all truncate",
                activeChatId === chat.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {chat.title}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <img src={user?.photoURL || ''} className="h-8 w-8 rounded-full border border-slate-200" alt="" />
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={logOut}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Sparkles size={18} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Aura Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={isLive ? stopAudio : startLive}
              disabled={isConnecting}
              className={cn(
                "flex h-9 px-3 items-center gap-2 rounded-lg text-sm font-medium transition-all shadow-sm",
                isLive 
                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700",
                isConnecting && "opacity-70 cursor-not-allowed"
              )}
              title="Live Audio"
            >
              {isConnecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isLive ? (
                <MicOff size={16} />
              ) : (
                <Mic size={16} />
              )}
              <span className="hidden sm:inline">
                {isConnecting ? "Connecting..." : isLive ? "Stop Live" : "Live Audio"}
              </span>
              {isLive && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>
            <button 
              onClick={() => setIsSystemPromptOpen(!isSystemPromptOpen)}
              className={cn(
                "flex h-9 px-3 items-center gap-2 rounded-lg text-sm font-medium transition-colors",
                isSystemPromptOpen 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
              title="System Settings"
            >
              <Settings size={18} />
              <span className="hidden sm:inline">Switch Mode</span>
            </button>
            <button 
              onClick={clearChat}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Clear chat"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {/* System Prompt Switcher */}
        <AnimatePresence>
          {isSystemPromptOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-slate-200 bg-slate-50 shrink-0"
            >
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="mx-auto max-w-3xl p-4 space-y-6">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                  <button
                    onClick={() => setSettingsTab('mode')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      settingsTab === 'mode' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    AI Settings
                  </button>
                  <button
                    onClick={() => setSettingsTab('memory')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      settingsTab === 'memory' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    User Memory
                  </button>
                </div>

                {settingsTab === 'mode' ? (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Mode</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(Object.keys(SYSTEM_PROMPTS) as PromptId[]).map((id) => {
                          const prompt = SYSTEM_PROMPTS[id];
                          const isSelected = selectedPromptId === id;
                          return (
                            <button
                              key={id}
                              onClick={() => {
                                setSelectedPromptId(id);
                                if (activeChatId) {
                                  updateDoc(doc(db, 'chats', activeChatId), { selectedPromptId: id });
                                }
                              }}
                              className={cn(
                                "flex flex-col text-left p-4 rounded-xl border transition-all",
                                isSelected 
                                  ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300" 
                                  : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg",
                                  isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                  {id === 'scaffold' ? <MessageSquare size={16} /> : <BookOpen size={16} />}
                                </div>
                                <span className={cn(
                                  "font-semibold text-sm",
                                  isSelected ? "text-indigo-900" : "text-slate-700"
                                )}>
                                  {prompt.name}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                {prompt.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Model Performance</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                            Grounding Enabled
                          </span>
                          <input 
                            type="checkbox" 
                            checked={useGrounding}
                            onChange={(e) => {
                              setUseGrounding(e.target.checked);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { useGrounding: e.target.checked });
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      
                      <div className="px-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                          <span>Slow / Deep</span>
                          <span>Fast / Lite</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="7"
                          step="1"
                          value={sliderValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setSliderValue(val);
                            if (activeChatId) {
                              updateDoc(doc(db, 'chats', activeChatId), { sliderValue: val });
                            }
                          }}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between mt-6">
                          {SLIDER_POINTS.map((point) => (
                            <div 
                              key={point.id}
                              className={cn(
                                "flex flex-col items-center gap-1 transition-all",
                                sliderValue === point.id ? "opacity-100 scale-110" : "opacity-30 scale-90"
                              )}
                            >
                              <div className={cn(
                                "h-2 w-2 rounded-full",
                                sliderValue === point.id ? "bg-indigo-600 ring-4 ring-indigo-100" : "bg-slate-400"
                              )} />
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">
                              {SLIDER_POINTS.find(p => p.id === sliderValue)?.label}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {SLIDER_POINTS.find(p => p.id === sliderValue)?.speed}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Model: {SLIDER_POINTS.find(p => p.id === sliderValue)?.model}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Current System Prompt</h3>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                          {fullSystemInstruction}
                        </pre>
                      </div>
                    </div>
                  </>
                ) : (
                  <MemorySettings />
                )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <main className="flex-1 overflow-y-auto relative">
          {isLive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm border border-indigo-100 shadow-lg rounded-2xl p-4 max-w-md w-[90%] text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Mic size={20} className="animate-pulse" />
                </div>
                <h3 className="font-bold text-indigo-900">Aura Live</h3>
              </div>
              <p className="text-sm text-slate-600 italic line-clamp-3">
                {transcript || "Listening..."}
              </p>
            </div>
          )}
          <div className="mx-auto max-w-3xl w-full py-4">
            {messages.length === 0 && !liveUserText && !liveModelText ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 rounded-2xl bg-white p-6 shadow-xl border border-slate-100"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mx-auto mb-4">
                    {selectedPromptId === 'scaffold' ? <MessageSquare size={32} /> : <BookOpen size={32} />}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{SYSTEM_PROMPTS[selectedPromptId].name}</h2>
                  <p className="text-slate-500 max-w-sm">
                    {selectedPromptId === 'scaffold' 
                      ? "I'm here to help you reflect on your teaching experiences using Kolb's cycle." 
                      : "I'll guide you through a professional development module on reflective practice."}
                  </p>
                </motion.div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md">
                  {(selectedPromptId === 'scaffold' ? [
                    "I had a difficult class today...",
                    "A student was very disengaged...",
                    "I tried a new activity that failed...",
                    "Reflect on a successful lesson"
                  ] : [
                    "I'm ready to start the lesson",
                    "What is Kolb's cycle?",
                    "How does reflection help my teaching?",
                    "Explain the learning styles"
                  ]).map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(suggestion)}
                      className="text-left p-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {messages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={message} 
                    onUpdate={(content, status) => handleUpdateMessage(message.id, content, status)}
                    onRegenerate={() => {
                      const finalizedMessages = messages.filter(m => m.status === 'finalized');
                      const history = finalizedMessages.map(msg => ({
                        role: msg.role === 'user' ? 'user' as const : 'model' as const,
                        parts: [{ text: msg.content }]
                      }));
                      generateAIResponse(activeChatId!, history);
                    }}
                  />
                ))}
                
                {/* Live Audio Draft Messages */}
                {liveUserText && (
                  <ChatMessage 
                    message={{
                      id: 'live-user',
                      role: 'user',
                      content: liveUserText,
                      status: 'finalized',
                      timestamp: Date.now()
                    }}
                  />
                )}
                {liveModelText && (
                  <ChatMessage 
                    message={{
                      id: 'live-model',
                      role: 'assistant',
                      content: liveModelText,
                      status: 'finalized',
                      timestamp: Date.now()
                    }}
                  />
                )}

                {streamingMessage && (
                  <ChatMessage 
                    message={{
                      id: 'streaming-model',
                      role: 'assistant',
                      content: streamingMessage.content,
                      draftContent: streamingMessage.draftContent,
                      draftThoughts: streamingMessage.draftThoughts,
                      reviewThoughts: streamingMessage.reviewThoughts,
                      phase: streamingMessage.phase,
                      model: streamingMessage.model,
                      status: 'draft',
                      timestamp: Date.now()
                    }}
                  />
                )}

                {isLoading && !streamingMessage && (
                  <div className="flex gap-4 p-4 md:p-6 bg-slate-50/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-indigo-600 text-white border-indigo-500">
                      <Bot size={16} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={scrollRef} className="h-4" />
              </div>
            )}
          </div>
        </main>

        {/* Input Area */}
        <footer className="border-t border-slate-200 bg-white p-4">
          <div className="mx-auto max-w-3xl">
            <ChatInput onSend={handleSend} disabled={isLoading} />
            <p className="mt-2 text-center text-[10px] text-slate-400 uppercase tracking-widest">
              {streamingMessage?.phase === 'drafting' 
                ? "Aura is drafting a response..." 
                : streamingMessage?.phase === 'reviewing'
                ? "Aura is reviewing and refining the response..."
                : streamingMessage?.phase === 'finalizing'
                ? "Aura is finalizing the response..."
                : "Aura may provide inaccurate information. Check important info."}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
