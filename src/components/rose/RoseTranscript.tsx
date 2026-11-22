import { useEffect, useRef } from 'react';
import type { TranscriptMessage } from '../../types/rose.ts';

interface RoseTranscriptProps {
  messages: TranscriptMessage[];
  companyName: string;
  onQuickPrompt: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  'How is production doing today?',
  'Are there any unresolved incidents I should know about?',
  'Check inventory levels near reorder threshold.',
  'Give me the latest shift handover briefing.',
];

export function RoseTranscript({
  messages,
  companyName,
  onQuickPrompt,
}: RoseTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col justify-between h-full py-2">
        <div className="space-y-2">
          <p className="text-sm text-slate-300 leading-relaxed">
            Connected to <span className="text-white font-medium">{companyName}</span>. Speak
            naturally or type a question to begin.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            ROSE remembers context across your active session—you can ask follow-up questions like
            “Which line is behind?” or “Compare that to yesterday.”
          </p>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-slate-400">Suggested conversations</p>
          <div className="space-y-1.5">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onQuickPrompt(prompt)}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-[#0D1426] hover:bg-[#131C33] border border-slate-800/90 text-sm text-slate-200 transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pr-1" data-testid="rose-transcript-list">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        return (
          <article key={msg.id} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                className={
                  isUser
                    ? 'font-medium text-rose-300'
                    : isSystem
                      ? 'font-medium text-amber-300'
                      : 'font-medium text-cyan-300'
                }
              >
                {isUser ? 'You' : isSystem ? 'System' : 'ROSE'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{formatTime(msg.timestamp)}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{msg.source}</span>
            </div>

            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap ${
                isUser
                  ? 'text-slate-100'
                  : isSystem
                    ? 'text-amber-200/90'
                    : 'text-slate-200'
              }`}
            >
              {msg.text}
              {msg.isPartial && <span className="text-cyan-400 ml-1">▍</span>}
            </p>

            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="pt-1 space-y-1 border-t border-slate-800/70">
                {msg.toolCalls.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center gap-2 text-[11px] font-mono text-slate-400"
                  >
                    <span
                      className={
                        tool.status === 'ok'
                          ? 'text-cyan-400'
                          : tool.status === 'denied'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }
                    >
                      {tool.toolName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{tool.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
