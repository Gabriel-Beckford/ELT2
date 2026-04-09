import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/src/types';
import { db, auth } from '@/src/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Loader2, Brain } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const KOLB_STYLES = [
  'Accommodating (Feel and Do)',
  'Converging (Think and Do)',
  'Diverging (Feel and Watch)',
  'Assimilating (Think and Watch)',
  'Unknown / Not Set'
];

export const MemorySettings: React.FC = () => {
  const user = auth.currentUser;
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: '',
    gender: '',
    uniqueLearningNeeds: '',
    qualifications: '',
    kolbLearningStyle: 'Unknown / Not Set'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'profiles', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Initialize with user display name if available
          setProfile(prev => ({ ...prev, name: user.displayName || '' }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'profiles', user.uid), profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <Brain size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">User Memory</h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Information Aura will remember about you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={e => setProfile({ ...profile, name: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            placeholder="Your name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Age</label>
            <input
              type="text"
              value={profile.age}
              onChange={e => setProfile({ ...profile, age: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. 35"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label>
            <input
              type="text"
              value={profile.gender}
              onChange={e => setProfile({ ...profile, gender: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. Female"
            />
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kolb Learning Style</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {KOLB_STYLES.map(style => (
              <button
                key={style}
                onClick={() => setProfile({ ...profile, kolbLearningStyle: style })}
                className={cn(
                  "px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left",
                  profile.kolbLearningStyle === style
                    ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-slate-50"
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Qualifications</label>
          <textarea
            value={profile.qualifications}
            onChange={e => setProfile({ ...profile, qualifications: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all min-h-[60px]"
            placeholder="Your teaching qualifications, degrees, etc."
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Unique Learning Needs</label>
          <textarea
            value={profile.uniqueLearningNeeds}
            onChange={e => setProfile({ ...profile, uniqueLearningNeeds: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all min-h-[60px]"
            placeholder="Any specific needs or preferences for your own learning"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 items-center gap-4">
        {saveSuccess && (
          <span className="text-sm font-medium text-green-600 animate-in fade-in slide-in-from-right-4">
            Memory saved successfully!
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Save Memory
        </button>
      </div>
    </div>
  );
};
