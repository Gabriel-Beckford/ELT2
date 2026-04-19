import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/src/types';
import { db, auth } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Save, Loader2, Brain, Trash2, X, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (profile.name.length > 100) newErrors.name = 'Name must be under 100 characters';
    if (profile.age.length > 10) newErrors.age = 'Age must be under 10 characters';
    if (profile.gender.length > 50) newErrors.gender = 'Gender must be under 50 characters';
    if (profile.qualifications.length > 2000) newErrors.qualifications = 'Qualifications must be under 2000 characters';
    if (profile.uniqueLearningNeeds.length > 2000) newErrors.uniqueLearningNeeds = 'Needs must be under 2000 characters';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
    if (!validate()) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updatedProfile = {
        ...profile,
        lastUpdatedAt: Date.now()
      };
      await setDoc(doc(db, 'profiles', user.uid), updatedProfile);
      setProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'profiles', user.uid));
      setProfile({
        name: user.displayName || '',
        age: '',
        gender: '',
        uniqueLearningNeeds: '',
        qualifications: '',
        kolbLearningStyle: 'Unknown / Not Set'
      });
      setSaveSuccess(true);
      setShowDeleteConfirm(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error deleting profile:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearField = (field: keyof UserProfile) => {
    setProfile(prev => ({ ...prev, [field]: field === 'kolbLearningStyle' ? 'Unknown / Not Set' : '' }));
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
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Information Refleksyon will remember about you</p>
          {profile.lastUpdatedAt && (
            <p className="text-[10px] text-indigo-500 font-medium mt-0.5">
              Last updated {formatDistanceToNow(profile.lastUpdatedAt)} ago
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
            {profile.name && (
              <button onClick={() => clearField('name')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Clear</button>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              className={cn(
                "w-full rounded-xl border bg-white px-4 py-2 text-sm outline-none transition-all",
                errors.name ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              )}
              placeholder="Your name"
            />
            {errors.name && <AlertCircle size={14} className="absolute right-3 top-2.5 text-red-500" />}
          </div>
          {errors.name && <p className="text-[10px] text-red-500 ml-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Age</label>
              {profile.age && (
                <button onClick={() => clearField('age')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Clear</button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={profile.age}
                onChange={e => setProfile({ ...profile, age: e.target.value })}
                className={cn(
                  "w-full rounded-xl border bg-white px-4 py-2 text-sm outline-none transition-all",
                  errors.age ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                )}
                placeholder="e.g. 35"
              />
              {errors.age && <AlertCircle size={14} className="absolute right-3 top-2.5 text-red-500" />}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label>
              {profile.gender && (
                <button onClick={() => clearField('gender')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Clear</button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={profile.gender}
                onChange={e => setProfile({ ...profile, gender: e.target.value })}
                className={cn(
                  "w-full rounded-xl border bg-white px-4 py-2 text-sm outline-none transition-all",
                  errors.gender ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                )}
                placeholder="e.g. Female"
              />
              {errors.gender && <AlertCircle size={14} className="absolute right-3 top-2.5 text-red-500" />}
            </div>
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kolb Learning Style</label>
            {profile.kolbLearningStyle !== 'Unknown / Not Set' && (
              <button onClick={() => clearField('kolbLearningStyle')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Reset</button>
            )}
          </div>
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
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Qualifications</label>
            {profile.qualifications && (
              <button onClick={() => clearField('qualifications')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Clear</button>
            )}
          </div>
          <div className="relative">
            <textarea
              value={profile.qualifications}
              onChange={e => setProfile({ ...profile, qualifications: e.target.value })}
              className={cn(
                "w-full rounded-xl border bg-white px-4 py-2 text-sm outline-none transition-all min-h-[60px]",
                errors.qualifications ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              )}
              placeholder="Your teaching qualifications, degrees, etc."
            />
            {errors.qualifications && <AlertCircle size={14} className="absolute right-3 top-2.5 text-red-500" />}
          </div>
          {errors.qualifications && <p className="text-[10px] text-red-500 ml-1">{errors.qualifications}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Unique Learning Needs</label>
            {profile.uniqueLearningNeeds && (
              <button onClick={() => clearField('uniqueLearningNeeds')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Clear</button>
            )}
          </div>
          <div className="relative">
            <textarea
              value={profile.uniqueLearningNeeds}
              onChange={e => setProfile({ ...profile, uniqueLearningNeeds: e.target.value })}
              className={cn(
                "w-full rounded-xl border bg-white px-4 py-2 text-sm outline-none transition-all min-h-[60px]",
                errors.uniqueLearningNeeds ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              )}
              placeholder="Any specific needs or preferences for your own learning"
            />
            {errors.uniqueLearningNeeds && <AlertCircle size={14} className="absolute right-3 top-2.5 text-red-500" />}
          </div>
          {errors.uniqueLearningNeeds && <p className="text-[10px] text-red-500 ml-1">{errors.uniqueLearningNeeds}</p>}
        </div>
      </div>

      <div className="bg-slate-100/50 rounded-xl p-3 border border-slate-200 flex gap-3">
        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <span className="font-bold text-slate-600">Data Disclosure:</span> This information is stored in your private profile and is injected into the AI's system prompt at inference time to personalize your learning experience. It is not shared with other users.
        </p>
      </div>

      <div className="flex justify-between pt-4 items-center gap-4">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
            <span className="text-xs font-bold text-red-600 mr-2">Are you sure?</span>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Yes, Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeleteMemory}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <Trash2 size={14} />
            Delete All Memory
          </button>
        )}
        
        <div className="flex items-center gap-4">
          {saveSuccess && (
            <span className="text-sm font-medium text-green-600 animate-in fade-in slide-in-from-right-4">
              Memory saved!
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
    </div>
  );
};
