import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type {
  ConversationMemoryState,
  FactoryOverviewSnapshot,
  ProactiveInsight,
  TranscriptMessage,
  UserProfile,
} from '../../types/rose.ts';
import { RoseTranscript } from './RoseTranscript.tsx';

interface RoseConversationProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
  overview: FactoryOverviewSnapshot | null;
  insights: ProactiveInsight[];
  proactiveEnabled: boolean;
  messages: TranscriptMessage[];
  memory: ConversationMemoryState | null;
  saveMemoryEnabled: boolean;
  onQuickPrompt: (prompt: string) => void;
  onClearMemory: () => void;
}

type DrawerTab = 'transcript' | 'insights' | 'memory';

export function RoseConversation({
  open,
  onClose,
  user,
  overview,
  insights,
  proactiveEnabled,
  messages,
  memory,
  saveMemoryEnabled,
  onQuickPrompt,
  onClearMemory,
}: RoseConversationProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('transcript');

  if (!open) return null;

  return (
    <aside
      aria-label="Conversation and Factory Memory OS panel"
      className="fixed top-[57px] bottom-0 right-0 z-25 w-full sm:w-[410px] bg-[#070B16]/96 border-l border-slate-800/90 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-sm font-semibold text-white">Factory Memory & Context</h2>
          <p className="text-xs text-slate-400 truncate max-w-[270px]">
            {user ? `${user.companyName} · ${user.title}` : 'Workspace'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close context panel"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Tab Controls */}
      <div className="px-5 pt-3 pb-2">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0D1426] border border-slate-800/80">
          {(
            [
              { id: 'transcript', label: 'Transcript' },
              { id: 'insights', label: 'Insights' },
              { id: 'memory', label: 'Memory' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.id === 'insights' && proactiveEnabled && insights.length > 0
                ? ` (${insights.length})`
                : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-5 py-3 rose-scroll">
        {activeTab === 'transcript' && (
          <RoseTranscript
            messages={messages}
            companyName={user?.companyName ?? 'Factory Memory OS'}
            onQuickPrompt={(prompt) => {
              onQuickPrompt(prompt);
            }}
          />
        )}

        {activeTab === 'insights' && (
          <div className="space-y-5">
            {overview && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Live Operational Snapshot</span>
                  <span className="font-mono">{overview.currentShift}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <MetricTile
                    label="Production Target"
                    value={`${overview.productionAchievementPct}%`}
                    sub={`${overview.totalProducedToday} / ${overview.totalTargetToday} units`}
                  />
                  <MetricTile
                    label="Machines Online"
                    value={`${overview.activeMachinesCount} / ${overview.totalMachinesCount}`}
                    sub="Read-only telemetry"
                  />
                  <MetricTile
                    label="Open Incidents"
                    value={String(overview.unresolvedIncidentsCount)}
                    sub="Active floor items"
                  />
                  <MetricTile
                    label="Quality Pass"
                    value={`${overview.qualityPassRatePct}%`}
                    sub="Inspected batches"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-300">Proactive Observations</h3>
                <span className="text-[11px] text-slate-500">
                  {proactiveEnabled ? 'Active' : 'Muted in Settings'}
                </span>
              </div>

              {!proactiveEnabled ? (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Proactive notifications are currently disabled in Settings. Enable them anytime
                  to surface real-time production and stock alerts.
                </p>
              ) : insights.length === 0 ? (
                <p className="text-xs text-slate-400">
                  All lines and material thresholds are operating within nominal parameters.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className="p-3.5 rounded-xl bg-[#0D1426] border border-slate-800/90 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={
                            insight.severity === 'critical'
                              ? 'text-rose-300 font-medium'
                              : insight.severity === 'warning'
                                ? 'text-amber-300 font-medium'
                                : 'text-cyan-300 font-medium'
                          }
                        >
                          {insight.title}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {insight.metricLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{insight.message}</p>
                      <button
                        type="button"
                        onClick={() => onQuickPrompt(insight.suggestedPrompt)}
                        className="text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                      >
                        Ask ROSE about this →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#0D1426] border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Session Memory Status</span>
                <span className="font-mono text-cyan-300">
                  {saveMemoryEnabled ? 'Active' : 'Ephemeral'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Personal conversation memory is isolated per user and company ({user?.companyName})
                and kept separate from operational database records. Raw audio is never stored.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Context Summary</span>
                <span className="font-mono">{memory?.turnCount ?? 0} turns</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#050812] border border-slate-800/80 text-xs text-slate-300 leading-relaxed min-h-[84px]">
                {memory?.summary
                  ? memory.summary
                  : 'No persistent summary recorded yet for this session.'}
              </div>
            </div>

            {memory && memory.topicsDiscussed.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400">Topics referenced</span>
                <p className="text-xs text-slate-200 font-mono">
                  {memory.topicsDiscussed.join(' · ')}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onClearMemory}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-red-950/80 hover:text-red-200 border border-slate-700/80 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Conversation & Memory</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function MetricTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-[#0D1426] border border-slate-800/80 space-y-1">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-semibold font-mono text-white">{value}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
