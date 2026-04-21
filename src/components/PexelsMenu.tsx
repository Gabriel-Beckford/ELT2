import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface PexelsImage {
  id: number;
  src: {
    medium: string;
    small: string;
    original: string;
  };
  alt: string;
}

interface PexelsMenuProps {
  onSelectImage: (imageUrl: string) => void;
  onClose: () => void;
}

export const PexelsMenu: React.FC<PexelsMenuProps & { triggerRef?: React.RefObject<HTMLButtonElement> }> = ({ onSelectImage, onClose, triggerRef }) => {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<PexelsImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef?.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, triggerRef]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchImages = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/pexels/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
      setImages(data.photos || []);
    } catch (err) {
      setError('Could not load images. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-[400px]">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2 text-slate-700">
          <ImageIcon size={16} />
          <span className="text-sm font-semibold">Pexels Images</span>
        </div>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-slate-600 transition-colors focus-ring"
          aria-label="Close image picker"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="p-3">
        <form onSubmit={searchImages} className="relative">
          <label htmlFor="pexels-search" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
            Search Images
          </label>
          <div className="relative">
            <input
              id="pexels-search"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search images to convey feelings..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all focus-ring"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pt-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-red-500">{error}</div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => onSelectImage(img.src.original)}
                className="relative aspect-square rounded-lg overflow-hidden group border border-slate-200 hover:border-indigo-500 transition-all focus-ring"
                aria-label={`Select image: ${img.alt}`}
              >
                <img
                  src={img.src.medium}
                  alt={img.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-8 text-sm text-slate-500">No images found.</div>
        ) : (
          <div className="text-center py-8 text-sm text-slate-500">Search to find images.</div>
        )}
      </div>
    </div>
  );
};
