import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Sparkles, Trash2, Github, Bot, Settings, ChevronDown, ChevronUp, BookOpen, MessageSquare, LogOut, Plus, Loader2, Cpu, Palette, Volume2, VolumeX } from 'lucide-react';
import { ThinkingLevel } from "@google/genai";
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MemorySettings } from './MemorySettings';
import { Message, Chat, UserProfile } from '@/src/types';
import { streamChat, generateImage } from '@/src/lib/gemini';
import { cn } from '@/src/lib/utils';
import { SoftRevealController } from '@/src/lib/reveal';
import { SYSTEM_PROMPTS, PromptId } from '@/src/constants/prompts';
import { LEARNING_FACILITATOR_REVIEWER } from '@/src/constants/reviewers';
import { getElevenLabsAudio } from '@/src/lib/elevenlabs';
import { auth, db, logOut } from '@/src/lib/firebase';
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

const AVAILABLE_THEMES = ['indigo', 'rose', 'emerald', 'amber', 'sky'];

export const ChatInterface: React.FC<{ initialPromptId?: PromptId }> = ({ initialPromptId }) => {
  const user = auth.currentUser;
  const shouldReduceMotion = useReducedMotion();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<PromptId>(initialPromptId || 'facilitator');
  const [sliderValue, setSliderValue] = useState(2); // Default to Balanced
  const [useGrounding, setUseGrounding] = useState(true);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'mode' | 'memory'>('mode');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [selectedTheme, setSelectedTheme] = useState('indigo');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoReadResponses, setAutoReadResponses] = useState(true);
  const [ttsVoiceName, setTtsVoiceName] = useState('21m00Tcm4TlvDq8ikWAM'); // Default to Rachel if Cloud
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsPitch, setTtsPitch] = useState(1);
  const [sttMode, setSttMode] = useState<'browser' | 'server'>('server');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const speak = async (text: string) => {
    if (!autoReadResponses) return;
    stopSpeaking();
    
    // Clean up markdown before speaking
    const cleanText = text.replace(/[*_#`~>]/g, '');
    
    if (sttMode === 'server') {
      const elevenKey = process.env.ELEVENLABS_API_KEY || import.meta.env.VITE_ELEVENLABS_API_KEY;
      if (elevenKey) {
        const audioUrl = await getElevenLabsAudio(cleanText, ttsVoiceName || '21m00Tcm4TlvDq8ikWAM', elevenKey);
        if (audioUrl) {
          if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
          } else {
            audioRef.current.src = audioUrl;
          }
          audioRef.current.play().catch(e => console.error("Audio playback error:", e));
        }
        return;
      }
      // If no key, fall back to browser native
      console.warn("No ElevenLabs API Key found. Falling back to browser TTS.");
    }
    
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (sttMode === 'browser' && ttsVoiceName) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === ttsVoiceName) || voices.find(v => v.default);
      if (voice) {
        utterance.voice = voice;
      }
    }
    
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const revealControllerRef = useRef<SoftRevealController | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);

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
      if (activeChat.selectedPromptId) setSelectedPromptId(activeChat.selectedPromptId as PromptId);
      if (activeChat.useGrounding !== undefined) setUseGrounding(activeChat.useGrounding);
      if (activeChat.selectedModel) {
        const isValid = AVAILABLE_MODELS.some(m => m.id === activeChat.selectedModel);
        setSelectedModel(isValid ? activeChat.selectedModel : 'gemini-3-flash-preview');
      }
      if (activeChat.selectedTheme) setSelectedTheme(activeChat.selectedTheme);
      if (activeChat.voiceEnabled !== undefined) setVoiceEnabled(activeChat.voiceEnabled);
      if (activeChat.autoReadResponses !== undefined) setAutoReadResponses(activeChat.autoReadResponses);
      if (activeChat.ttsVoiceName) setTtsVoiceName(activeChat.ttsVoiceName);
      if (activeChat.ttsRate !== undefined) setTtsRate(activeChat.ttsRate);
      if (activeChat.ttsPitch !== undefined) setTtsPitch(activeChat.ttsPitch);
      if (activeChat.sttMode) setSttMode(activeChat.sttMode);
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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Priority: sub-menus first
        if (isModelMenuOpen) {
          setIsModelMenuOpen(false);
          modelTriggerRef.current?.focus();
        } else if (isThemeMenuOpen) {
          setIsThemeMenuOpen(false);
          themeTriggerRef.current?.focus();
        } else if (isSystemPromptOpen) {
          setIsSystemPromptOpen(false);
          settingsTriggerRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isModelMenuOpen, isThemeMenuOpen, isSystemPromptOpen]);

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
      selectedTheme,
      voiceEnabled,
      autoReadResponses,
      ttsVoiceName,
      ttsRate,
      ttsPitch,
      sttMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const docRef = await addDoc(collection(db, 'chats'), chatData);
    setActiveChatId(docRef.id);
    return docRef.id;
  };

  const handleSend = async (content: string, imageUrl?: string) => {
    if (!user) return;
    stopSpeaking();

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
        speak(revisedContent);
      } else {
        // PHASE 2: REVIEWING (Agentic Step)
        console.log(`Starting Phase 2: Reviewing with thinking ${agent2Thinking}...`);
        setStreamingMessage(prev => prev ? { ...prev, phase: 'reviewing' } : null);
        
        // Provide text-only history context to the reviewer so it knows the current stage/step
        const historyContext = history.map(h => {
          const textParts = h.parts.map(p => 'text' in p ? p.text : '[image]').join(' ');
          return `${h.role === 'user' ? 'Learner' : 'Facilitator'}: ${textParts}`;
        }).join('\n');

        let reviewPrompt = `${LEARNING_FACILITATOR_REVIEWER}

<conversation_history_context>
${historyContext}
</conversation_history_context>

<learning_facilitator_system_prompt>
${fullSystemInstruction}
</learning_facilitator_system_prompt>

<draft_response_to_review>
${draftContent}
</draft_response_to_review>`;
        
        let reviewerInstruction = "You are a senior pedagogical supervisor. Validate the draft against the system prompt and conversation history provided. Output ONLY the final, checked, learner-facing response and nothing else.";

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
        
        // Try tag-based extraction first
        const tagRegex = /<image_prompt>([\s\S]*?)<\/image_prompt>/i;
        const tagMatch = tagRegex.exec(finalContent);
        if (tagMatch) {
          extractedImagePrompt = tagMatch[1].trim();
          finalContent = finalContent.replace(tagMatch[0], '').trim();
        } else {
          // Fallback to legacy phrases
          const quoteRegex = /Use this image-generation prompt exactly:\s*\"([\s\S]*?)\"/i;
          const match = quoteRegex.exec(finalContent);
          if (match) {
            extractedImagePrompt = match[1].trim();
            finalContent = finalContent.replace(match[0], '').trim();
          } else {
            const fallbackRegex = /Use this image-generation prompt exactly:\s*([\s\S]*?)(\n\s*Then|\n\s*$|$)/i;
            const fb = fallbackRegex.exec(finalContent);
            if (fb) {
              extractedImagePrompt = fb[1].trim();
              finalContent = finalContent.replace(fb[0], '').trim();
            }
          }
        }

        revisedContent = finalContent;
        
        // Update reviewThoughts with the scorecard/assessment
        setStreamingMessage(prev => prev ? { 
          ...prev, 
          reviewThoughts: (prev.reviewThoughts ? prev.reviewThoughts + '\n\n' : '') + scorecard 
        } : null);
        
        // Start speaking immediately before waiting for the reveal or image generation
        speak(revisedContent);
        
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

  const deleteChat = async (chatIdToDelete: string) => {
    if (!user) return;
    try {
      const msgs = await getDocs(collection(db, 'chats', chatIdToDelete, 'messages'));
      for (const d of msgs.docs) {
        await deleteDoc(d.ref);
      }
      await deleteDoc(doc(db, 'chats', chatIdToDelete));
      if (activeChatId === chatIdToDelete) {
        setActiveChatId(null);
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  const handleMenuTriggerKeyDown = (e: React.KeyboardEvent, isOpen: boolean, setIsOpen: (v: boolean) => void) => {
    if (e.key === 'ArrowDown' || (e.key === ' ' && !isOpen) || (e.key === 'Enter' && !isOpen)) {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(0);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent, itemsLength: number, onSelect: (index: number) => void, setIsOpen: (v: boolean) => void) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % itemsLength);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + itemsLength) % itemsLength);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0) {
        onSelect(focusedIndex);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSettingsTab('memory');
      setTimeout(() => document.getElementById('tab-memory')?.focus(), 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSettingsTab('mode');
      setTimeout(() => document.getElementById('tab-ai')?.focus(), 0);
    }
  };

  useEffect(() => {
    if (!isModelMenuOpen && !isThemeMenuOpen) {
      setFocusedIndex(-1);
    }
  }, [isModelMenuOpen, isThemeMenuOpen]);

  return (
    <div className={cn("flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden", `theme-${selectedTheme}`)}>
      {/* Sidebar */}
      <aside aria-label="Chat history" className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <button 
            onClick={() => setActiveChatId(null)}
            className="flex w-full items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 focus-ring"
          >
            <Plus size={18} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={cn(
                "group flex items-center justify-between w-full text-left rounded-lg text-sm transition-all focus-ring",
                activeChatId === chat.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <button
                onClick={() => setActiveChatId(chat.id)}
                className="flex-1 truncate text-left px-3 py-2"
              >
                {chat.title}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                className={cn(
                  "opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 transition-all",
                  activeChatId === chat.id ? "opacity-100 text-indigo-400 hover:text-red-600" : ""
                )}
                title="Delete chat"
                aria-label="Delete chat"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <img src={user?.photoURL || ''} className="h-8 w-8 rounded-full border border-slate-200" alt={user?.displayName ? `Profile photo of ${user.displayName}` : "User profile photo"} />
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={logOut}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-all focus-ring"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header aria-label="Chat header" className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Sparkles size={18} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Refleksyon Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newVal = !autoReadResponses;
                setAutoReadResponses(newVal);
                if (newVal) stopSpeaking();
                if (activeChatId) {
                  updateDoc(doc(db, 'chats', activeChatId), { autoReadResponses: newVal });
                }
              }}
              className={cn(
                "flex h-9 px-3 items-center gap-2 rounded-lg text-sm font-medium transition-colors focus-ring",
                autoReadResponses ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              )}
              title={autoReadResponses ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
              aria-label={autoReadResponses ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
              aria-pressed={autoReadResponses}
            >
              {autoReadResponses ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span className="hidden sm:inline">{autoReadResponses ? 'Voice On' : 'Voice Off'}</span>
            </button>
            <button 
              ref={settingsTriggerRef}
              onClick={() => setIsSystemPromptOpen(!isSystemPromptOpen)}
              className={cn(
                "flex h-9 px-3 items-center gap-2 rounded-lg text-sm font-medium transition-colors focus-ring",
                isSystemPromptOpen 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
              title="System Settings"
              aria-label={isSystemPromptOpen ? "Close settings" : "Open settings"}
              aria-pressed={isSystemPromptOpen}
            >
              <Settings size={18} />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button 
              onClick={() => activeChatId && deleteChat(activeChatId)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors focus-ring"
              title="Delete chat"
              aria-label="Delete current chat"
              disabled={!activeChatId}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {/* System Prompt Switcher */}
        <AnimatePresence>
          {isSystemPromptOpen && (
            <motion.div
              initial={{ height: shouldReduceMotion ? 'auto' : 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: shouldReduceMotion ? 'auto' : 0, opacity: 0 }}
              className="overflow-hidden border-b border-slate-200 bg-slate-50 shrink-0"
              role="region"
              aria-label="Settings panel"
            >
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="mx-auto max-w-3xl p-4 space-y-6">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit" role="tablist">
                  <button
                    id="tab-ai"
                    role="tab"
                    aria-selected={settingsTab === 'mode'}
                    aria-controls="panel-ai"
                    onClick={() => setSettingsTab('mode')}
                    onKeyDown={handleTabKeyDown}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all focus-ring",
                      settingsTab === 'mode' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    AI Settings
                  </button>
                  <button
                    id="tab-memory"
                    role="tab"
                    aria-selected={settingsTab === 'memory'}
                    aria-controls="panel-memory"
                    onClick={() => setSettingsTab('memory')}
                    onKeyDown={handleTabKeyDown}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all focus-ring",
                      settingsTab === 'memory' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    User Memory
                  </button>
                </div>

                {settingsTab === 'mode' ? (
                  <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai" className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-slate-700">Learning Pathway</h3>
                      </div>
                      <select
                        value={selectedPromptId}
                        onChange={(e) => {
                          const newPromptId = e.target.value as PromptId;
                          setSelectedPromptId(newPromptId);
                          if (activeChatId) {
                            updateDoc(doc(db, 'chats', activeChatId), { selectedPromptId: newPromptId });
                          }
                        }}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium focus-ring"
                      >
                        {Object.values(SYSTEM_PROMPTS).map(prompt => (
                          <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <Bot size={16} className="text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-700">Language Model</h3>
                        </div>
                        <div className="relative">
                          <button
                            ref={modelTriggerRef}
                            id="model-trigger"
                            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                            onKeyDown={(e) => handleMenuTriggerKeyDown(e, isModelMenuOpen, setIsModelMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium focus-ring"
                            aria-haspopup="listbox"
                            aria-expanded={isModelMenuOpen}
                            aria-controls="model-list"
                            aria-activedescendant={focusedIndex >= 0 && isModelMenuOpen ? `model-option-${focusedIndex}` : undefined}
                            aria-label={isModelMenuOpen ? "Close model menu" : "Open model menu"}
                          >
                            {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
                            <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isModelMenuOpen && "rotate-180")} />
                          </button>
                          
                          <AnimatePresence>
                            {isModelMenuOpen && (
                              <motion.div
                                id="model-list"
                                role="listbox"
                                aria-labelledby="model-trigger"
                                onKeyDown={(e) => handleMenuKeyDown(e, AVAILABLE_MODELS.length, (idx) => {
                                  const model = AVAILABLE_MODELS[idx];
                                  setSelectedModel(model.id);
                                  setIsModelMenuOpen(false);
                                  if (activeChatId) {
                                    updateDoc(doc(db, 'chats', activeChatId), { selectedModel: model.id });
                                  }
                                }, setIsModelMenuOpen)}
                                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -5 }}
                                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 focus:outline-none"
                              >
                                {AVAILABLE_MODELS.map((model, idx) => (
                                  <button
                                    key={model.id}
                                    id={`model-option-${idx}`}
                                    role="option"
                                    aria-selected={selectedModel === model.id}
                                    onClick={() => {
                                      setSelectedModel(model.id);
                                      setIsModelMenuOpen(false);
                                      if (activeChatId) {
                                        updateDoc(doc(db, 'chats', activeChatId), { selectedModel: model.id });
                                      }
                                    }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors focus-ring",
                                      selectedModel === model.id ? "bg-indigo-50/50 text-indigo-700 font-semibold" : "text-slate-700",
                                      focusedIndex === idx && "bg-slate-100"
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
                          <Palette size={16} className="text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-700">App Color</h3>
                        </div>
                        <div className="relative">
                          <button
                            ref={themeTriggerRef}
                            id="theme-trigger"
                            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                            onKeyDown={(e) => handleMenuTriggerKeyDown(e, isThemeMenuOpen, setIsThemeMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium capitalize focus-ring"
                            aria-haspopup="listbox"
                            aria-expanded={isThemeMenuOpen}
                            aria-controls="theme-list"
                            aria-activedescendant={focusedIndex >= 0 && isThemeMenuOpen ? `theme-option-${focusedIndex}` : undefined}
                            aria-label={isThemeMenuOpen ? "Close color menu" : "Open color menu"}
                          >
                            {selectedTheme}
                            <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isThemeMenuOpen && "rotate-180")} />
                          </button>
                          
                          <AnimatePresence>
                            {isThemeMenuOpen && (
                              <motion.div
                                id="theme-list"
                                role="listbox"
                                aria-labelledby="theme-trigger"
                                onKeyDown={(e) => handleMenuKeyDown(e, AVAILABLE_THEMES.length, (idx) => {
                                  const themeName = AVAILABLE_THEMES[idx];
                                  setSelectedTheme(themeName);
                                  setIsThemeMenuOpen(false);
                                  if (activeChatId) {
                                    updateDoc(doc(db, 'chats', activeChatId), { selectedTheme: themeName });
                                  }
                                }, setIsThemeMenuOpen)}
                                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -5 }}
                                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 focus:outline-none"
                              >
                                {AVAILABLE_THEMES.map((themeName, idx) => (
                                  <button
                                    key={themeName}
                                    id={`theme-option-${idx}`}
                                    role="option"
                                    aria-selected={selectedTheme === themeName}
                                    onClick={() => {
                                      setSelectedTheme(themeName);
                                      setIsThemeMenuOpen(false);
                                      if (activeChatId) {
                                        updateDoc(doc(db, 'chats', activeChatId), { selectedTheme: themeName });
                                      }
                                    }}
                                    className={cn(
                                      "w-full flex items-center px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors capitalize focus-ring",
                                      selectedTheme === themeName ? "bg-indigo-50/50 text-indigo-700 font-semibold" : "text-slate-700",
                                      focusedIndex === idx && "bg-slate-100"
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
                        <label htmlFor="grounding-toggle" className="text-sm font-semibold text-slate-700 cursor-pointer">Search Grounding</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                            {useGrounding ? 'Enabled' : 'Disabled'}
                          </span>
                          <input 
                            id="grounding-toggle"
                            type="checkbox" 
                            checked={useGrounding}
                            onChange={(e) => {
                              setUseGrounding(e.target.checked);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { useGrounding: e.target.checked });
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer focus-ring"
                          />
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Cpu size={16} className="text-indigo-600" />
                            <label htmlFor="thinking-slider" className="text-sm font-semibold text-indigo-900 cursor-pointer">Thinking Effort</label>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-100 px-2 py-0.5 rounded">
                            {SLIDER_POINTS.find(p => p.id === sliderValue)?.label}
                          </span>
                        </div>
                        
                        <div className="px-2">
                          <input
                            id="thinking-slider"
                            type="range"
                            min="1"
                            max="3"
                            step="1"
                            value={sliderValue}
                            aria-valuemin={1}
                            aria-valuemax={3}
                            aria-valuenow={sliderValue}
                            aria-valuetext={SLIDER_POINTS.find(p => p.id === sliderValue)?.label}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setSliderValue(val);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { sliderValue: val });
                              }
                            }}
                            className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus-ring"
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

                      <div className="pt-4 border-t border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 size={16} className="text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-700">Voice Settings</h3>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <label htmlFor="stt-mode" className="text-sm font-semibold text-slate-700">Speech Engine</label>
                          <select
                            id="stt-mode"
                            value={sttMode}
                            onChange={(e) => {
                              const val = e.target.value as 'browser' | 'server';
                              setSttMode(val);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { sttMode: val });
                              }
                            }}
                            className="text-sm bg-slate-50 border border-slate-300 rounded-md px-2 py-1 focus-ring"
                          >
                            <option value="browser">Browser Native</option>
                            <option value="server">Cloud AI (ElevenLabs)</option>
                          </select>
                        </div>
                        
                        {sttMode === 'server' && (
                          <div className="flex items-center justify-between">
                            <label htmlFor="elevenlabs-voice" className="text-sm font-semibold text-slate-700">ElevenLabs Voice</label>
                            <select
                              id="elevenlabs-voice"
                              value={ttsVoiceName}
                              onChange={(e) => {
                                setTtsVoiceName(e.target.value);
                                if (activeChatId) {
                                  updateDoc(doc(db, 'chats', activeChatId), { ttsVoiceName: e.target.value });
                                }
                              }}
                              className="text-sm bg-slate-50 border border-slate-300 rounded-md px-2 py-1 focus-ring"
                            >
                              <option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>
                              <option value="29vD33N1CtxCmqQRPOHJ">Drew</option>
                              <option value="2EiwWnXFnvU5JabPnv8n">Clyde</option>
                              <option value="zrHiDhphv9ZnVXBqCLjz">Mimi</option>
                              <option value="EXAVITQu4vr4xnSDxMaL">Bella</option>
                              <option value="cjVigY5qzO86Huf0OWal">Eric</option>
                              <option value="pNInz6obpgDQGcFmaJgB">Adam</option>
                            </select>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <label htmlFor="tts-rate" className="text-sm font-semibold text-slate-700">Speech Rate</label>
                          <input
                            id="tts-rate"
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={ttsRate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setTtsRate(val);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { ttsRate: val });
                              }
                            }}
                            className="w-24 h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus-ring"
                          />
                          <span className="text-xs text-slate-500 w-8">{ttsRate}x</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <label htmlFor="tts-pitch" className="text-sm font-semibold text-slate-700">Speech Pitch</label>
                          <input
                            id="tts-pitch"
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={ttsPitch}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setTtsPitch(val);
                              if (activeChatId) {
                                updateDoc(doc(db, 'chats', activeChatId), { ttsPitch: val });
                              }
                            }}
                            className="w-24 h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus-ring"
                          />
                          <span className="text-xs text-slate-500 w-8">{ttsPitch}x</span>
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
                  </div>
                ) : (
                  <div id="panel-memory" role="tabpanel" aria-labelledby="tab-memory">
                    <MemorySettings />
                  </div>
                )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <main id="main-content" aria-label="Main chat area" className="flex-1 overflow-y-auto relative" tabIndex={-1}>
          <div className="mx-auto max-w-3xl w-full py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <motion.div
                  initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
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
                      className="text-left p-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all focus-ring"
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

                {streamingMessage && (
                  <>
                    <div className="sr-only" aria-live="polite" aria-atomic="true">
                      {streamingMessage.phase === 'drafting' && "Refleksyon is drafting..."}
                      {streamingMessage.phase === 'reviewing' && "Refleksyon is refining..."}
                      {streamingMessage.phase === 'finalizing' && "Response finalizing..."}
                    </div>
                    <ChatMessage 
                      key="streaming-model"
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
                    />
                  </>
                )}

                {isLoading && !streamingMessage && (
                  <div className="flex gap-4 p-4 md:p-6 bg-slate-50/50" aria-live="polite">
                    <span className="sr-only">Refleksyon is thinking...</span>
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
        <footer aria-label="Message input area" className="border-t border-slate-200 bg-white p-4">
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
