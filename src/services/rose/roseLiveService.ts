import type { ConversationMemoryState, RoseVoiceId } from '../../types/rose.ts';

export interface LiveConnectionOptions {
  token: string;
  voiceId: RoseVoiceId;
  voiceSpeed: number;
  proactiveNotifications: boolean;
  saveMemory: boolean;
}

export interface LiveServiceCallbacks {
  onStatusChange: (status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void;
  onAudioChunk: (base64Pcm24k: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onInputTranscript: (delta: string) => void;
  onOutputTranscript: (delta: string) => void;
  onToolCall: (record: {
    id: string;
    toolName: string;
    summary: string;
    status: 'ok' | 'denied' | 'error';
  }) => void;
  onMemoryUpdated: (memory: ConversationMemoryState) => void;
  onError: (code: string, message: string) => void;
}

export class RoseLiveService {
  private ws: WebSocket | null = null;
  private callbacks: LiveServiceCallbacks;
  private lastOptions: LiveConnectionOptions | null = null;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private isConnecting = false;

  constructor(callbacks: LiveServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(options: LiveConnectionOptions): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    this.intentionalClose = false;
    this.lastOptions = options;
    this.openSocket(options, false);
  }

  private openSocket(options: LiveConnectionOptions, isRetry: boolean): void {
    this.isConnecting = true;
    this.callbacks.onStatusChange(isRetry ? 'reconnecting' : 'connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      token: options.token,
      voice: options.voiceId,
      speed: String(options.voiceSpeed),
      proactive: String(options.proactiveNotifications),
      memory: String(options.saveMemory),
    });
    const url = `${proto}//${window.location.host}/ws/rose-live?${params.toString()}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        switch (msg.type) {
          case 'ready':
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.callbacks.onStatusChange('connected');
            break;
          case 'audio':
            if (typeof msg.data === 'string') {
              this.callbacks.onAudioChunk(msg.data);
            }
            break;
          case 'interrupted':
            this.callbacks.onInterrupted();
            break;
          case 'turn_complete':
            this.callbacks.onTurnComplete();
            break;
          case 'input_transcript':
            if (typeof msg.text === 'string') {
              this.callbacks.onInputTranscript(msg.text);
            }
            break;
          case 'output_transcript':
            if (typeof msg.text === 'string') {
              this.callbacks.onOutputTranscript(msg.text);
            }
            break;
          case 'tool_call':
            this.callbacks.onToolCall({
              id: String(msg.id ?? Date.now()),
              toolName: String(msg.toolName ?? 'getFactoryOverview'),
              summary: String(msg.summary ?? ''),
              status: (msg.status as 'ok' | 'denied' | 'error') ?? 'ok',
            });
            break;
          case 'memory_updated':
            if (msg.memory) {
              this.callbacks.onMemoryUpdated(msg.memory as ConversationMemoryState);
            }
            break;
          case 'session_timeout':
            this.intentionalClose = true;
            this.callbacks.onError('SESSION_TIMEOUT', String(msg.message ?? 'Session timed out.'));
            break;
          case 'error':
            this.callbacks.onError(
              String(msg.code ?? 'LIVE_ERROR'),
              String(msg.message ?? 'Live connection error.')
            );
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed message
      }
    };

    ws.onerror = () => {
      this.isConnecting = false;
    };

    ws.onclose = (event) => {
      this.isConnecting = false;
      this.stopHeartbeat();
      this.ws = null;

      if (this.intentionalClose) {
        this.callbacks.onStatusChange('disconnected');
        return;
      }

      if (event.code === 1011 || this.reconnectAttempts >= 3) {
        this.callbacks.onStatusChange('disconnected');
        return;
      }

      this.reconnectAttempts += 1;
      const delayMs = 800 * Math.pow(2, this.reconnectAttempts - 1);
      this.callbacks.onStatusChange('reconnecting');
      this.reconnectTimer = window.setTimeout(() => {
        if (!this.intentionalClose && this.lastOptions) {
          this.openSocket(this.lastOptions, true);
        }
      }, delayMs);
    };
  }

  public sendAudioChunk(base64Pcm16k: string): void {
    if (!base64Pcm16k || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm16k }));
  }

  public sendTextTurn(text: string): boolean {
    if (!text.trim() || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type: 'text', text: text.trim() }));
    return true;
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.isConnecting = false;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnected');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.callbacks.onStatusChange('disconnected');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25_000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
