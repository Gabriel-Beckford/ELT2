import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/src/lib/utils';

interface StructuredRendererProps {
  content: string;
  className?: string;
}

const Card: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="my-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
    {title && (
      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-600">
        {title}
      </h4>
    )}
    <div className="text-sm leading-relaxed text-slate-600">
      {children}
    </div>
  </div>
);

const Reflection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="my-6 rounded-2xl border-l-4 border-amber-400 bg-amber-50/50 p-6">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-amber-600 text-lg">✽</span>
      <h4 className="text-xs font-bold uppercase tracking-widest text-amber-800">
        {title || 'Reflection'}
      </h4>
    </div>
    <div className="text-sm italic leading-relaxed text-amber-900/80">
      {children}
    </div>
  </div>
);

const Insight: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="my-6 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-indigo-600 text-lg">❈</span>
      <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-800">
        {title || 'Key Insight'}
      </h4>
    </div>
    <div className="text-sm leading-relaxed text-indigo-900/80">
      {children}
    </div>
  </div>
);

const Caution: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="my-6 rounded-2xl border border-rose-100 bg-rose-50/30 p-6">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-rose-600 text-lg">❉</span>
      <h4 className="text-xs font-bold uppercase tracking-widest text-rose-800">
        {title || 'Caution'}
      </h4>
    </div>
    <div className="text-sm leading-relaxed text-rose-900/80">
      {children}
    </div>
  </div>
);

const Action: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="my-6 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-6">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-emerald-600 text-lg">❋</span>
      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-800">
        {title || 'Next Steps'}
      </h4>
    </div>
    <div className="text-sm leading-relaxed text-emerald-900/80 font-medium">
      {children}
    </div>
  </div>
);

import rehypeRaw from 'rehype-raw';

export const StructuredRenderer: React.FC<StructuredRendererProps> = ({ content, className }) => {
  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom tags mapping
          card: ({ node, ...props }: any) => <Card title={props.title}>{props.children}</Card>,
          reflection: ({ node, ...props }: any) => <Reflection title={props.title}>{props.children}</Reflection>,
          insight: ({ node, ...props }: any) => <Insight title={props.title}>{props.children}</Insight>,
          caution: ({ node, ...props }: any) => <Caution title={props.title}>{props.children}</Caution>,
          action: ({ node, ...props }: any) => <Action title={props.title}>{props.children}</Action>,
        } as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
