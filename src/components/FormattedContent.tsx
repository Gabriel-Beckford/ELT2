import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/src/lib/utils';

interface FormattedContentProps {
  content: string;
  className?: string;
}

export const FormattedContent: React.FC<FormattedContentProps> = ({ content, className }) => {
  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-indigo-900 tracking-tight mb-6 mt-2 flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4 mt-6 flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-3 mt-4 flex items-center gap-2">
              {children}
            </h3>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-widest">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 font-bold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-slate-100 px-4 py-3 text-slate-600">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-600 my-4">
              {children}
            </blockquote>
          ),
          // Custom tags handled via rehype-raw
          // @ts-ignore
          insightcard: ({ children }) => (
            <div className="bg-amber-50/50 border-l-4 border-amber-400 p-4 rounded-r-xl my-6 shadow-sm animate-in fade-in slide-in-from-left-2">
              <div className="text-sm text-amber-900 leading-relaxed">
                {children}
              </div>
            </div>
          ),
          // @ts-ignore
          reflectionbox: ({ children }) => (
            <div className="bg-teal-50/30 border border-teal-100 p-5 rounded-2xl italic my-6 shadow-sm animate-in fade-in zoom-in-95">
              <div className="text-sm text-teal-900 leading-relaxed flex items-start gap-3">
                <span className="text-teal-500 text-lg mt-0.5">❊</span>
                <div>{children}</div>
              </div>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
