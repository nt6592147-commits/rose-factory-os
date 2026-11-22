import {
  base64Int16ToFloat32,
  computeRmsLevel,
  float32ToInt16Base64,
  resampleFloat32,
} from '../../utils/roseAudioMath.ts';

export interface RoseAudioCallbacks {
  onMicAudioChunk: (base64Pcm16k: string, rms: number) => void;
  onOutputLevel: (rms: number) => void;
  onPlaybackActiveChange: (active: boolean) => void;
}

export class RoseAudioService {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputMuteGain: GainNode | null = null;

  private outputGain: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private levelRafId = 0;
  private analyserBuffer = new Float32Array(256);

  private isMuted = false;
  private volume = 0.9;
  private playbackRate = 1.0;
  private callbacks: RoseAudioCallbacks;

  constructor(callbacks: RoseAudioCallbacks) {
    this.callbacks = callbacks;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.outputGain && this.outputCtx) {
      this.outputGain.gain.setTargetAtTime(
        this.volume,
        this.outputCtx.currentTime,
        0.03
      );
    }
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.8, Math.min(1.25, rate));
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public async ensureOutputContext(): Promise<AudioContext> {
    if (!this.outputCtx || this.outputCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.outputCtx = new AudioCtx({ sampleRate: 24000 });
      this.outputGain = this.outputCtx.createGain();
      this.outputGain.gain.value = this.volume;
      this.outputAnalyser = this.outputCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputGain.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputCtx.destination);
      this.startOutputLevelLoop();
    }
    if (this.outputCtx.state === 'suspended') {
      await this.outputCtx.resume();
    }
    return this.outputCtx;
  }

  public async startMicrophone(): Promise<void> {
    if (this.mediaStream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.mediaStream = stream;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.inputCtx = new AudioCtx({ sampleRate: 16000 });
    if (this.inputCtx.state === 'suspended') {
      await this.inputCtx.resume();
    }

    this.inputSource = this.inputCtx.createMediaStreamSource(stream);
    this.processor = this.inputCtx.createScriptProcessor(2048, 1, 1);
    this.inputMuteGain = this.inputCtx.createGain();
    this.inputMuteGain.gain.value = 0;

    this.processor.onaudioprocess = (event) => {
      if (!this.inputCtx) return;
      const raw = event.inputBuffer.getChannelData(0);
      if (this.isMuted) {
        this.callbacks.onMicAudioChunk('', 0);
        return;
      }
      const resampled =
        this.inputCtx.sampleRate === 16000
          ? raw
          : resampleFloat32(raw, this.inputCtx.sampleRate, 16000);
      const rms = computeRmsLevel(resampled);
      const base64 = float32ToInt16Base64(resampled);
      this.callbacks.onMicAudioChunk(base64, rms);
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputMuteGain);
    this.inputMuteGain.connect(this.inputCtx.destination);
  }

  public stopMicrophone(): void {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor = null;
    }
    if (this.inputSource) {
      try {
        this.inputSource.disconnect();
      } catch {
        // ignore
      }
      this.inputSource = null;
    }
    if (this.inputMuteGain) {
      try {
        this.inputMuteGain.disconnect();
      } catch {
        // ignore
      }
      this.inputMuteGain = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.inputCtx) {
      this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
  }

  public async enqueuePcm24k(base64Pcm: string): Promise<void> {
    const ctx = await this.ensureOutputContext();
    if (!this.outputGain) return;

    const float32 = base64Int16ToFloat32(base64Pcm);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.outputGain);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, this.nextStartTime);
    const effectiveDuration = buffer.duration / this.playbackRate;
    this.nextStartTime = startAt + effectiveDuration;

    this.activeSources.add(source);
    if (this.activeSources.size === 1) {
      this.callbacks.onPlaybackActiveChange(true);
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.callbacks.onPlaybackActiveChange(false);
        this.callbacks.onOutputLevel(0);
      }
    };

    source.start(startAt);
  }

  public async playWavBase64(base64Wav: string): Promise<void> {
    this.stopPlayback();
    const ctx = await this.ensureOutputContext();
    if (!this.outputGain) return;

    const binary = atob(base64Wav);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.outputGain);

    this.activeSources.add(source);
    this.callbacks.onPlaybackActiveChange(true);

    return new Promise<void>((resolve) => {
      source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
          this.callbacks.onPlaybackActiveChange(false);
          this.callbacks.onOutputLevel(0);
        }
        resolve();
      };
      source.start(ctx.currentTime);
    });
  }

  public stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // ignore already-stopped sources
      }
    }
    this.activeSources.clear();
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    } else {
      this.nextStartTime = 0;
    }
    this.callbacks.onPlaybackActiveChange(false);
    this.callbacks.onOutputLevel(0);
  }

  public isPlaying(): boolean {
    return this.activeSources.size > 0;
  }

  private startOutputLevelLoop(): void {
    if (this.levelRafId) {
      cancelAnimationFrame(this.levelRafId);
    }
    const sample = () => {
      if (!this.outputCtx || this.outputCtx.state === 'closed') return;
      if (this.outputAnalyser && this.activeSources.size > 0) {
        this.outputAnalyser.getFloatTimeDomainData(this.analyserBuffer);
        const rms = computeRmsLevel(this.analyserBuffer);
        this.callbacks.onOutputLevel(rms);
      }
      this.levelRafId = requestAnimationFrame(sample);
    };
    this.levelRafId = requestAnimationFrame(sample);
  }

  public dispose(): void {
    if (this.levelRafId) {
      cancelAnimationFrame(this.levelRafId);
      this.levelRafId = 0;
    }
    this.stopPlayback();
    this.stopMicrophone();
    if (this.outputCtx) {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
    this.outputGain = null;
    this.outputAnalyser = null;
  }
}
