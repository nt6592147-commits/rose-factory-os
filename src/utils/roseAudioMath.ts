import type { OrbState, RoseVoiceId } from '../types/rose.ts';

export interface VoicePreset {
  id: RoseVoiceId;
  label: string;
  character: string;
  recommended: boolean;
  stylePrompt: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'Kore',
    label: 'Kore — Deep & Warm (ROSE Signature)',
    character: 'Mature, deep feminine, smooth, calm, subtly sultry & confident',
    recommended: true,
    stylePrompt:
      'Speak in a mature, deep feminine voice that is warm, smooth, calm, confident, and subtly sultry with natural conversational pauses and clear articulation.',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr — Smooth & Airy',
    character: 'Soft, articulate, slightly breathy feminine poise',
    recommended: false,
    stylePrompt:
      'Speak in a soft, refined, slightly breathy feminine voice that is articulate, relaxed, and naturally intelligent.',
  },
  {
    id: 'Puck',
    label: 'Puck — Crisp & Direct',
    character: 'Clear, attentive, slightly brighter cadence',
    recommended: false,
    stylePrompt: 'Speak clearly and attentively in a natural, conversational tone.',
  },
  {
    id: 'Charon',
    label: 'Charon — Measured & Grounded',
    character: 'Low, steady, analytical tone',
    recommended: false,
    stylePrompt: 'Speak steadily in a measured, grounded operational tone.',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir — Executive Brief',
    character: 'Firm, decisive, structured delivery',
    recommended: false,
    stylePrompt: 'Speak decisively and clearly.',
  },
];

export function getVoicePreset(voiceId: RoseVoiceId): VoicePreset {
  return VOICE_PRESETS.find((preset) => preset.id === voiceId) ?? VOICE_PRESETS[0];
}

/**
 * Converts a Float32Array [-1, 1] microphone buffer to base64-encoded
 * little-endian 16-bit signed PCM (audio/pcm;rate=16000).
 */
export function float32ToInt16Base64(float32: Float32Array): string {
  const bytes = new Uint8Array(float32.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    view.setInt16(i * 2, int16, true);
  }
  return uint8ToBase64(bytes);
}

/**
 * Decodes base64-encoded little-endian 16-bit PCM (24kHz Gemini Live output)
 * into a normalized Float32Array [-1, 1] for Web Audio playback.
 */
export function base64Int16ToFloat32(base64: string): Float32Array {
  const bytes = base64ToUint8(base64);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
  }
  return float32;
}

/**
 * Resamples mono Float32 PCM audio to a target sample rate using linear interpolation.
 */
export function resampleFloat32(
  input: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Float32Array {
  if (fromSampleRate === toSampleRate || input.length === 0) {
    return input;
  }
  const ratio = fromSampleRate / toSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(input.length - 1, low + 1);
    const frac = srcIndex - low;
    output[i] = input[low] * (1 - frac) + input[high] * frac;
  }
  return output;
}

/**
 * Computes normalized Root-Mean-Square energy [0, 1] for audio reactivity.
 */
export function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / samples.length);
  return Math.min(1, rms * 3.2);
}

/**
 * Determines whether incoming user speech energy should interrupt ROSE's active playback
 * (requires sustained frames above threshold so transient clicks don't interrupt).
 */
export function shouldTriggerBargeIn(params: {
  isRoseSpeaking: boolean;
  isMicMuted: boolean;
  inputRms: number;
  consecutiveLoudFrames: number;
  threshold?: number;
  requiredFrames?: number;
}): { interrupt: boolean; nextLoudFrames: number } {
  const threshold = params.threshold ?? 0.085;
  const requiredFrames = params.requiredFrames ?? 4;
  if (!params.isRoseSpeaking || params.isMicMuted) {
    return { interrupt: false, nextLoudFrames: 0 };
  }
  if (params.inputRms >= threshold) {
    const nextLoudFrames = params.consecutiveLoudFrames + 1;
    return {
      interrupt: nextLoudFrames >= requiredFrames,
      nextLoudFrames,
    };
  }
  return { interrupt: false, nextLoudFrames: 0 };
}

/**
 * Resolves the authoritative OrbState from session & audio signals.
 */
export function resolveOrbState(params: {
  hasError: boolean;
  isConnected: boolean;
  isVoiceActive: boolean;
  isMuted: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
}): OrbState {
  if (params.hasError) return 'ERROR';
  if (!params.isConnected && params.isVoiceActive) return 'DISCONNECTED';
  if (params.isSpeaking) return 'SPEAKING';
  if (params.isThinking) return 'THINKING';
  if (params.isVoiceActive && !params.isMuted) return 'LISTENING';
  return 'IDLE';
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
