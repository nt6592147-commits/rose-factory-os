import type { OrbState } from '../../types/rose.ts';

interface RoseVisualizerProps {
  orbState: OrbState;
  inputLevel: number;
  outputLevel: number;
}

const BAR_COUNT = 28;

export function RoseVisualizer({
  orbState,
  inputLevel,
  outputLevel,
}: RoseVisualizerProps) {
  const activeEnergy =
    orbState === 'SPEAKING'
      ? Math.max(0.18, outputLevel)
      : orbState === 'LISTENING'
        ? Math.max(0.12, inputLevel)
        : orbState === 'THINKING'
          ? 0.28
          : 0.04;

  const barColor =
    orbState === 'ERROR'
      ? 'bg-amber-400'
      : orbState === 'DISCONNECTED'
        ? 'bg-slate-600'
        : orbState === 'SPEAKING'
          ? 'bg-cyan-300'
          : orbState === 'LISTENING'
            ? 'bg-rose-300'
            : orbState === 'THINKING'
              ? 'bg-violet-400'
              : 'bg-cyan-500/40';

  return (
    <div
      className="flex items-center justify-center gap-[3px] h-7 px-3"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const distFromCenter = Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
        const envelope = 1 - distFromCenter * 0.72;
        const harmonic = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.85 + activeEnergy * 8));
        const heightPct = Math.round(
          Math.max(14, Math.min(100, 14 + activeEnergy * envelope * harmonic * 86))
        );
        return (
          <span
            key={i}
            className={`w-[2.5px] rounded-full transition-transform duration-100 ${barColor}`}
            style={{
              height: '24px',
              transform: `scaleY(${heightPct / 100})`,
              opacity: orbState === 'DISCONNECTED' ? 0.35 : 0.85,
            }}
          />
        );
      })}
    </div>
  );
}
