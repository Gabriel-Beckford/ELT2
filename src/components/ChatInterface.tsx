import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trash2, Github, Bot, Settings, ChevronDown, ChevronUp, BookOpen, MessageSquare, LogOut, Plus, Mic, MicOff, Loader2, Cpu, Volume2, Palette } from 'lucide-react';
import { ThinkingLevel } from "@google/genai";
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MemorySettings } from './MemorySettings';
import { Message, Chat, UserProfile } from '@/src/types';
import { streamChat, generateImage } from '@/src/lib/gemini';
import { cn } from '@/src/lib/utils';
import { appendChunk } from '@/src/lib/transcriptUtils';
import { SoftRevealController } from '@/src/lib/reveal';
import { SYSTEM_PROMPTS, PromptId } from '@/src/constants/prompts';
import { LEARNING_FACILITATOR_REVIEWER } from '@/src/constants/reviewers';
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
  { id: 1, level: ThinkingLevel.LOW, label: 'Minimal Effort', speed: 'Fastest' },
  { id: 2, level: ThinkingLevel.MEDIUM, label: 'Balanced Effort', speed: 'Balanced' },
  { id: 3, level: ThinkingLevel.HIGH, label: 'Deep Effort', speed: 'Slowest' },
];

const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', isPreview: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', isPreview: true },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', isPreview: true },
  { id: 'gemini-flash-latest', name: 'Gemini Flash', isPreview: false },
];

const AVAILABLE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];
const AVAILABLE_THEMES = ['indigo', 'rose', 'emerald', 'amber', 'sky'];

export const ChatInterface: React.FC<{ initialPromptId?: PromptId }> = ({ initialPromptId }) => {
  const user = auth.currentUser;
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPromptId] = useState<PromptId>('facilitator');
  const [sliderValue, setSliderValue] = useState(3); // Default to Balanced
  const [useGrounding, setUseGrounding] = useState(true);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'mode' | 'memory'>('mode');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-pro-preview');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [selectedTheme, setSelectedTheme] = useState('indigo');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const revealControllerRef = useRef<SoftRevealController | null>(null);

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
    modelSettings?: { label: string; speed: string; thinking: string };
    sources?: { title: string; url: string }[];
  } | null>(null);

  const systemPrompt = SYSTEM_PROMPTS[selectedPromptId].content;
  
  let fullSystemInstruction = systemPrompt;
  if (userProfile) {
    const profileXml = `<user_profile>
    <name>${userProfile.name}</name>
    <age>${userProfile.age}</age>
    <gender>${userProfile.gender}</gender>
    <qualifications>${userProfile.qualifications}</qualifications>
    <klsi_style>${userProfile.kolbLearningStyle}</klsi_style>
    <learning_needs>${userProfile.uniqueLearningNeeds || 'none'}</learning_needs>
  </user_profile>`;
    
    fullSystemInstruction = systemPrompt.replace(
      /<user_profile>[\s\S]*?<\/user_profile>/,
      profileXml
    );
  }
  
  const handleUserTranscript = (text: string) => {
    setLiveUserText(prev => appendChunk(prev, text));
  };

  const handleModelTranscript = (text: string) => {
    setLiveModelText(prev => appendChunk(prev, text));
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
    handleTurnComplete,
    selectedVoice
  );

  const handleStopLive = async () => {
    // Check for non-empty pending live text
    if (liveUserText.trim() || liveModelText.trim()) {
      await handleTurnComplete(); // This writes missing turns and clears state
    }
    stopAudio();
  };

  const handleStartLive = () => {
    let initialHistory: any[] = [];
    if (activeChatId) {
      // Build a lightweight history payload from current messages (finalized user/assistant turns only)
      // Cap history size to the last 20 turns
      const finalizedMessages = messages.filter(m => m.status === 'finalized');
      const recentMessages = finalizedMessages.slice(-20);
      initialHistory = recentMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    }
    startLive(initialHistory);
  };

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
      if (activeChat.sliderValue) setSliderValue(activeChat.sliderValue);
      if (activeChat.useGrounding !== undefined) setUseGrounding(activeChat.useGrounding);
      if (activeChat.selectedModel) setSelectedModel(activeChat.selectedModel);
      if (activeChat.selectedVoice) setSelectedVoice(activeChat.selectedVoice);
      if (activeChat.selectedTheme) setSelectedTheme(activeChat.selectedTheme);
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

  // Cleanup reveal controller
  useEffect(() => {
    return () => {
      revealControllerRef.current?.destroy();
    };
  }, []);

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
      selectedModel,
      selectedVoice,
      selectedTheme,
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
    
    // Safety net: include any pending non-empty live text in history
    const historyParts: any[] = [];
    if (liveUserText.trim()) {
      historyParts.push({ role: 'user' as const, parts: [{ text: liveUserText.trim() }] });
    }
    if (liveModelText.trim()) {
      historyParts.push({ role: 'model' as const, parts: [{ text: liveModelText.trim() }] });
    }

    const history = [
      ...finalizedMessages.map(msg => {
        const parts: any[] = [{ text: msg.content }];
        // Note: We don't re-fetch historical images for context here to save bandwidth,
        // but we could if needed. For now, just text context for history.
        return {
          role: msg.role === 'user' ? 'user' as const : 'model' as const,
          parts
        };
      }),
      ...historyParts
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

  const parseReviewerOutput = (text: string) => {
    return { content: text.trim(), reviewThoughts: '' };
  };

    const generateAIResponse = async (chatId: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
    setIsLoading(true);
    
    // Staged Thinking Logic
    const getStagedThinking = (baseLevel: number, stage: number) => {
      const levels = [ThinkingLevel.LOW, ThinkingLevel.MEDIUM, ThinkingLevel.HIGH];
      const index = Math.max(0, baseLevel - 1 - (stage - 1));
      return levels[index];
    };

    const currentPoint = SLIDER_POINTS.find(p => p.id === sliderValue) || SLIDER_POINTS[1];
    const agent1Thinking = getStagedThinking(sliderValue, 1);
    const agent2Thinking = getStagedThinking(sliderValue, 2);

    // Cleanup previous controller if any
    revealControllerRef.current?.destroy();
    
    // Initialize streaming message with empty content for the final area
    setStreamingMessage({ 
      content: '', 
      draftContent: '', 
      draftThoughts: '', 
      reviewThoughts: '', 
      phase: 'drafting',
      model: selectedModel,
      modelSettings: {
        label: currentPoint.label,
        speed: currentPoint.speed,
        thinking: agent1Thinking
      }
    });
    
    try {
      // PHASE 1: DRAFTING
      console.log(`Starting Phase 1: Drafting with thinking ${agent1Thinking}...`);
      let draftContent = '';
      let draftThoughts = '';
      let draftSources: { title: string; url: string }[] = [];
      let generatedImageUrl: string | undefined = undefined;
      
      const draftStream = streamChat(history, fullSystemInstruction, selectedModel, agent1Thinking, useGrounding);
      for await (const chunk of draftStream) {
        if (chunk.type === 'thought') {
          draftThoughts += chunk.content as string;
        } else if (chunk.type === 'text') {
          draftContent += chunk.content as string;
        } else if (chunk.type === 'sources') {
          draftSources = [...draftSources, ...(chunk.content as any[])];
        }
        // Update draftContent but keep main content empty during this phase
        setStreamingMessage(prev => prev ? { ...prev, draftContent, draftThoughts, sources: draftSources } : null);
      }
      console.log("Phase 1 Complete. Draft length:", draftContent.length);

      let revisedContent = '';
      let revisedThoughts = '';

      if (!draftContent) {
        console.warn("Phase 1 returned no content. Skipping Phase 2.");
        revisedContent = "I'm sorry, I couldn't generate a draft. Please try again.";
      } else {
        // PHASE 2: REVIEWING (Agentic Step)
        console.log(`Starting Phase 2: Reviewing with thinking ${agent2Thinking}...`);
        setStreamingMessage(prev => prev ? { ...prev, phase: 'reviewing' } : null);
        
        let reviewPrompt = `${LEARNING_FACILITATOR_REVIEWER}

<learning_facilitator_system_prompt>
${fullSystemInstruction}
</learning_facilitator_system_prompt>

<draft_response_to_review>
${draftContent}
</draft_response_to_review>`;
        
        let reviewerInstruction = "You are a senior pedagogical supervisor. Validate the draft against the system prompt provided. Output ONLY the final, checked, learner-facing response and nothing else.";

        const reviewStream = streamChat(
          [{ role: 'user', parts: [{ text: reviewPrompt }] }], 
          reviewerInstruction, 
          selectedModel, 
          agent2Thinking, 
          false 
        );

        // Initialize reveal controller for the revised content
        const revealPromise = new Promise<void>((resolve) => {
          revealControllerRef.current = new SoftRevealController({
            onUpdate: (visible) => {
              setStreamingMessage(prev => prev ? { ...prev, content: visible } : null);
            },
            onComplete: () => resolve(),
            pacing: {
              wpm: 320,
              pauseMultipliers: {
                comma: 1.5,
                sentence: 3,
                paragraph: 6
              }
            }
          });
        });

        let fullReviewText = '';
        for await (const chunk of reviewStream) {
          if (chunk.type === 'thought') {
            revisedThoughts += chunk.content as string;
            setStreamingMessage(prev => prev ? { ...prev, reviewThoughts: revisedThoughts } : null);
          } else if (chunk.type === 'text') {
            fullReviewText += chunk.content as string;
          }
        }
        
        let { content: finalContent, reviewThoughts: scorecard } = parseReviewerOutput(fullReviewText);
        
        let extractedImagePrompt: string | undefined = undefined;
        const quoteRegex = /Use this image-generation prompt exactly:\s*\"([\s\S]*?)\"/i;
        const match = quoteRegex.exec(finalContent);
        if (match) {
          extractedImagePrompt = match[1].trim();
          finalContent = finalContent.replace(match[0], '').trim();
        } else {
          // Fallback if not perfectly enclosed in quotes
          const fallbackRegex = /Use this image-generation prompt exactly:\s*([\s\S]*?)(\n\s*Then|\n\s*$|$)/i;
          const fb = fallbackRegex.exec(finalContent);
          if (fb) {
            extractedImagePrompt = fb[1].trim();
            finalContent = finalContent.replace(fb[0], '').trim();
          }
        }

        revisedContent = finalContent;
        
        // Update reviewThoughts with the scorecard/assessment
        setStreamingMessage(prev => prev ? { 
          ...prev, 
          reviewThoughts: (prev.reviewThoughts ? prev.reviewThoughts + '\n\n' : '') + scorecard 
        } : null);
        
        // Start revealing the final content
        revealControllerRef.current?.append(finalContent);
        revealControllerRef.current?.finish();
        
        // Wait for the reveal to catch up
        await revealPromise;
        
        if (!revisedContent) {
          console.warn("Phase 2 returned empty content. Falling back to draft.");
        }
        console.log("Phase 2 Complete. Revised length:", revisedContent.length);

        // Generate image if a prompt was extracted
        if (extractedImagePrompt) {
          console.log("Generating image with prompt:", extractedImagePrompt);
          try {
            // Update UI to show image generation is happening
            setStreamingMessage(prev => prev ? { ...prev, phase: 'finalizing', content: revisedContent } : null);
            generatedImageUrl = await generateImage(extractedImagePrompt);
          } catch (e) {
            console.error('Failed to generate image', e);
          }
        }
      }

      // PHASE 3: SAVE FINALIZED RESPONSE
      console.log("Starting Phase 3: Finalizing...");
      setStreamingMessage(prev => prev ? { ...prev, phase: 'finalizing', content: revisedContent || draftContent, imageUrl: generatedImageUrl } : null);
      
      const modelMsgData: any = {
        chatId,
        role: 'assistant',
        content: revisedContent || draftContent,
        draftContent: draftContent,
        model: selectedModel,
        modelSettings: {
          label: currentPoint.label,
          speed: currentPoint.speed,
          thinking: agent1Thinking
        },
        sources: draftSources,
        status: 'finalized',
        timestamp: Date.now(),
      };
      
      if (generatedImageUrl) modelMsgData.imageUrl = generatedImageUrl;
      
      if (draftThoughts) modelMsgData.draftThoughts = draftThoughts;
      if (revisedThoughts) modelMsgData.reviewThoughts = revisedThoughts;

      await addDoc(collection(db, 'chats', chatId, 'messages'), modelMsgData);
    } catch (error) {
      const errMsg = `Error generating response: ${error instanceof Error ? error.message : String(error)}`;
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'assistant',
        content: errMsg,
        status: 'finalized',
        timestamp: Date.now(),
      });
      console.error("Agentic workflow failed:", error);
    } finally {
      setIsLoading(false);
      setStreamingMessage(null);
      revealControllerRef.current?.destroy();
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
    <div className={cn("flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden", `theme-${selectedTheme}`)}>
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
            <h1 className="text-lg font-semibold tracking-tight">Refleksyon Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={isLive ? handleStopLive : handleStartLive}
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
              <span className="hidden sm:inline">Settings</span>
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <Bot size={16} className="text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-700">Language Model</h3>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium"
                          >
                            {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
                            <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isModelMenuOpen && "rotate-180")} />
                          </button>
                          
                          <AnimatePresence>
                            {isModelMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20"
                              >
                                {AVAILABLE_MODELS.map(model => (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      setSelectedModel(model.id);
                                      setIsModelMenuOpen(false);
                                      if (activeChatId) {
                                        updateDoc(doc(db, 'chats', activeChatId), { selectedModel: model.id });
                                      }
                                    }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors",
                                      selectedModel === model.id ? "bg-indigo-50/50 text-indigo-700 font-semibold" : "text-slate-700"
                                    )}
                                  >
                                    <span>{model.name}</span>
                                    {model.isPreview && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Preview</span>
                                    )}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <Volume2 size={16} className="text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-700">Voice Selection</h3>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setIsVoiceMenuOpen(!isVoiceMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium"
                          >
                            {selectedVoice}
                            <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isVoiceMenuOpen && "rotate-180")} />
                          </button>
                          
                          <AnimatePresence>
                            {isVoiceMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20"
                              >
                                {AVAILABLE_VOICES.map(voice => (
                                  <button
                                    key={voice}
                                    onClick={() => {
                                      setSelectedVoice(voice);
                                      setIsVoiceMenuOpen(false);
                                      if (activeChatId) {
                                        updateDoc(doc(db, 'chats', activeChatId), { selectedVoice: voice });
                                      }
                                    }}
                                    className={cn(
                                      "w-full flex items-center px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors",
                                      selectedVoice === voice ? "bg-indigo-50/50 text-indigo-700 font-semibold" : "text-slate-700"
                                    )}
                                  >
                                    {voice}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <Palette size={16} className="text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-700">App Color</h3>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium capitalize"
                          >
                            {selectedTheme}
                            <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isThemeMenuOpen && "rotate-180")} />
                          </button>
                          
                          <AnimatePresence>
                            {isThemeMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20"
                              >
                                {AVAILABLE_THEMES.map(themeName => (
                                  <button
                                    key={themeName}
                                    onClick={() => {
                                      setSelectedTheme(themeName);
                                      setIsThemeMenuOpen(false);
                                      if (activeChatId) {
                                        updateDoc(doc(db, 'chats', activeChatId), { selectedTheme: themeName });
                                      }
                                    }}
                                    className={cn(
                                      "w-full flex items-center px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors capitalize",
                                      selectedTheme === themeName ? "bg-indigo-50/50 text-indigo-700 font-semibold" : "text-slate-700"
                                    )}
                                  >
                                    {themeName}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Search Grounding</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                            {useGrounding ? 'Enabled' : 'Disabled'}
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
                      
                      <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Cpu size={16} className="text-indigo-600" />
                            <span className="text-sm font-semibold text-indigo-900">Thinking Effort</span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-100 px-2 py-0.5 rounded">
                            {SLIDER_POINTS.find(p => p.id === sliderValue)?.label}
                          </span>
                        </div>
                        
                        <div className="px-2">
                          <input
                            type="range"
                            min="1"
                            max="3"
                            step="1"
                            value={sliderValue}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setSliderValue(val);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { sliderValue: val });
                              }
                            }}
                            className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <div className="flex justify-between mt-2">
                            <span className="text-[10px] text-indigo-400 font-medium">Minimal</span>
                            <span className="text-[10px] text-indigo-400 font-medium">Balanced</span>
                            <span className="text-[10px] text-indigo-400 font-medium">Deep</span>
                          </div>
                        </div>

                        <p className="mt-4 text-[10px] text-indigo-700/60 leading-relaxed italic">
                          Staged Thinking: Agent 1 (Drafting) uses full effort, while subsequent agents use progressively less to optimize speed.
                        </p>
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
                <h3 className="font-bold text-indigo-900">Refleksyon Live</h3>
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
                    <BookOpen size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{SYSTEM_PROMPTS[selectedPromptId].name}</h2>
                  <p className="text-slate-500 max-w-sm">
                    I'll guide you through a professional development module on reflective practice.
                  </p>
                </motion.div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md">
                  {[
                    "I'm ready to start the lesson",
                    "What is Kolb's cycle?",
                    "How does reflection help my teaching?",
                    "Explain the learning styles"
                  ].map((suggestion, i) => (
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
                    selectedVoice={selectedVoice}
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
                    selectedVoice={selectedVoice}
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
                    selectedVoice={selectedVoice}
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
                      modelSettings: streamingMessage.modelSettings,
                      sources: streamingMessage.sources,
                      status: 'draft',
                      timestamp: Date.now()
                    }}
                    selectedVoice={selectedVoice}
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
                ? "Refleksyon is drafting a response..." 
                : streamingMessage?.phase === 'reviewing'
                ? "Refleksyon is reviewing and refining the response..."
                : streamingMessage?.phase === 'finalizing'
                ? "Refleksyon is finalizing the response..."
                : "Refleksyon may provide inaccurate information. Check important info."}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
