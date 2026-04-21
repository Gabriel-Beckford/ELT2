/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './lib/firebase';
import { ChatInterface } from './components/ChatInterface';
import { AuthScreen } from './components/AuthScreen';
import { ZenPond } from './components/ZenPond';
import { LearningJourney } from './components/LearningJourney';
import { PromptId } from './constants/prompts';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [hasCompletedIntro, setHasCompletedIntro] = useState(false);
  const [hasSeenJourney, setHasSeenJourney] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<PromptId | null>(null);

  const navigateToIntro = () => {
    setHasCompletedIntro(false);
    setHasSeenJourney(false);
  };

  const navigateToJourney = () => {
    setHasSeenJourney(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Authentication Error</h1>
        <p className="mt-2 text-slate-600">{error.message}</p>
      </div>
    );
  }

  if (user) {
    if (!hasCompletedIntro) {
      return (
        <>
          <a 
            href="#main-content" 
            className="sr-only focus:not-sr-only fixed top-4 left-4 z-[999] bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg"
          >
            Skip to main content
          </a>
          <ZenPond 
            onComplete={(pathway) => {
              setSelectedPathway(pathway);
              setHasCompletedIntro(true);
            }} 
          />
        </>
      );
    }

    if (!hasSeenJourney) {
      return (
        <>
          <a 
            href="#main-content" 
            className="sr-only focus:not-sr-only fixed top-4 left-4 z-[999] bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg"
          >
            Skip to main content
          </a>
          <LearningJourney onComplete={() => setHasSeenJourney(true)} />
        </>
      );
    }
    return (
      <>
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only fixed top-4 left-4 z-[999] bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg"
        >
          Skip to main content
        </a>
        <ChatInterface 
          initialPromptId={selectedPathway || 'facilitator'} 
          onNavigateToIntro={navigateToIntro}
          onNavigateToJourney={navigateToJourney}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only fixed top-4 left-4 z-[999] bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg"
      >
        Skip to main content
      </a>
      <main id="main-content">
        <AuthScreen />
      </main>
    </div>
  );
}
