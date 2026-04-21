import React from 'react';
import { LogIn, Sparkles } from 'lucide-react';
import { signIn } from '@/src/lib/firebase';

export const AuthScreen: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-10 shadow-xl border border-slate-100 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <Sparkles size={40} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Refleksyon Chat</h1>
          <p className="text-slate-500">Your intelligent reflective practice companion.</p>
        </div>
        <button
          onClick={signIn}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] focus-ring"
        >
          <LogIn size={20} />
          Sign in with Google
        </button>
        <p className="text-xs text-slate-400">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
};
