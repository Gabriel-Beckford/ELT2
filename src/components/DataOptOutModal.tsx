import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, ShieldAlert, Check } from 'lucide-react';

export const DataOptOutModal = ({ onComplete }: { onComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const choice = localStorage.getItem('dataOptOut');
    if (choice === null) {
      setIsOpen(true);
    } else {
      onComplete();
    }
  }, [onComplete]);

  const handleChoice = (optOut: boolean) => {
    localStorage.setItem('dataOptOut', optOut ? 'true' : 'false');
    setIsOpen(false);
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
      >
        <div className="p-6">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="text-indigo-600" size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Data Privacy Opt-Out</h2>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
            By default, your chat history and profile are securely saved to the cloud so you can access them from any device.
            <br/><br/>
            You can choose to <strong>opt out</strong>. If you do, your data will not be recorded and will be lost when you refresh or close the app.
          </p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => handleChoice(false)}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
            >
              <Check size={18} />
              Continue Saving Data
            </button>
            <button 
              onClick={() => handleChoice(true)}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
            >
              <ShieldAlert size={18} />
              Opt Out (Do Not Record Data)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
