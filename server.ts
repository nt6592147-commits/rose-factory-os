import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type Content,
  type LiveServerMessage,
  type Part,
} from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createRateLimiter,
  issueSessionToken,
  requireAuth,
  verifySessionToken,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  computeFactoryOverviewSnapshot,
  computeProactiveInsights,
  FACTORY_USER_PROFILES,
  getUserProfileById,
} from './server/factoryMemoryLogic.ts';
import { buildRoseSystemInstruction } from './services/rose/roseContextService.ts';
import {
  appendConversationTurn,
  clearConversationMemory,
  extractTopicsFromToolCalls,
  getConversationBucket,
} from './services/rose/roseSessionService.ts';
import {
  dispatchFactoryToolCall,
  ROSE_TOOL_DECLARATIONS,
} from './services/rose/roseToolService.ts';
import type { RoseVoiceId, ToolExecutionRecord, UserProfile } from './src/types/rose.ts';
import { getVoicePreset } from './src/utils/roseAudioMath.ts';

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_VOICES = new Set<RoseVoiceId>(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError(
      'GEMINI_API_KEY is not configured in the server environment.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

function formatGeminiError(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof GeminiConfigError) {
    return { status: 503, code: 'GEMINI_KEY_MISSING', message: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|400|INVALID_ARGUMENT/i.test(msg)) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      message: 'Gemini API rejected the request or key. Check Settings > Secrets.',
    };
  }
  if (/PERMISSION_DENIED|403/i.test(msg)) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Gemini API permission denied. Check your key configuration in Settings > Secrets.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(msg)) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message: 'Gemini API rate limit reached. Please try again shortly.',
    };
  }
  return {
    status: 502,
    code: 'GEMINI_UPSTREAM_ERROR',
    message: msg || 'Failed to communicate with Gemini service.',
  };
}

function sanitizeVoiceId(raw: unknown): RoseVoiceId {
  if (typeof raw === 'string' && ALLOWED_VOICES.has(raw as RoseVoiceId)) {
    return raw as RoseVoiceId;
  }
  return 'Kore';
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  const apiRateLimit = createRateLimiter(60, 60_000);

  // Health & Gemini availability check (never exposes key value)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      liveModel: 'gemini-3.8-live',
      chatModel: 'gemini-4-hydrogen',
      ttsModel: 'gemini-3.8-flash-tts',
      timestamp: new Date().toISOString(),
    });
  });

  // List available Factory Memory OS operator profiles for authenticated workspace switching
  app.get('/api/auth/profiles', (_req: Request, res: Response) => {
    res.json({ profiles: FACTORY_USER_PROFILES });
  });

  // Issue signed Bearer token for selected profile
  app.post('/api/auth/session', apiRateLimit, (req: Request, res: Response) => {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : 'usr_elena_aether';
    const profile = getUserProfileById(userId);
    if (!profile) {
      res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'User profile not found.' });
      return;
    }
    const token = issueSessionToken(profile);
    res.json({ token, user: profile });
  });

  // Company-isolated factory overview & proactive insights
  app.get('/api/rose/overview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const snapshot = computeFactoryOverviewSnapshot(user.companyId);
    const insights = computeProactiveInsights(user.companyId);
    const bucket = getConversationBucket(user.companyId, user.userId);
    res.json({
      user,
      overview: snapshot,
      insights,
      memory: bucket.memory,
    });
  });

  // Memory management endpoints
  app.get('/api/rose/memory', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const bucket = getConversationBucket(user.companyId, user.userId);
    res.json({ memory: bucket.memory });
  });

  app.post('/api/rose/memory/clear', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const memory = clearConversationMemory(user.companyId, user.userId);
    res.json({ memory });
  });

  // Text conversational intelligence endpoint (uses exact same Factory Memory OS tools & persona)
  app.post(
    '/api/rose/chat',
    requireAuth,
    apiRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message || message.length > 4000) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'Please provide a message between 1 and 4000 characters.',
        });
        return;
      }

      const saveMemory = req.body?.saveMemory !== false;
      const proactiveNotifications = req.body?.proactiveNotifications !== false;
      const voiceSpeed =
        typeof req.body?.voiceSpeed === 'number'
          ? Math.max(0.75, Math.min(1.3, req.body.voiceSpeed))
          : 1.0;

      const clientHistory = Array.isArray(req.body?.history)
        ? (req.body.history as Array<{ role?: string; text?: string }>)
            .filter(
              (m) =>
                (m.role === 'user' || m.role === 'rose') &&
                typeof m.text === 'string' &&
                m.text.trim().length > 0
            )
            .slice(-16)
        : [];

      try {
        const ai = getAiClient();
        const bucket = getConversationBucket(user.companyId, user.userId);
        const systemInstruction = buildRoseSystemInstruction({
          user,
          memory: saveMemory ? bucket.memory : null,
          voiceSpeed,
          proactiveNotifications,
        });

        const contents: Content[] = [
          ...clientHistory.map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('model' as const),
            parts: [{ text: m.text!.trim() }],
          })),
          { role: 'user', parts: [{ text: message }] },
        ];

        const executedTools: ToolExecutionRecord[] = [];
        let finalReply = '';

        for (let step = 0; step < 5; step++) {
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              tools: [{ functionDeclarations: ROSE_TOOL_DECLARATIONS }],
            },
          });

          const modelContent = response.candidates?.[0]?.content;
          const calls = response.functionCalls;

          if (calls && calls.length > 0 && modelContent) {
            contents.push(modelContent);
            const responseParts: Part[] = [];
            for (const call of calls) {
              const outcome = dispatchFactoryToolCall(
                user,
                call.name,
                call.args as Record<string, unknown> | undefined
              );
              executedTools.push({
                id: call.id ?? `${call.name}-${Date.now()}`,
                toolName: outcome.toolName,
                summary: outcome.summary,
                timestamp: new Date().toISOString(),
                status: outcome.ok
                  ? 'ok'
                  : outcome.data.error === 'FORBIDDEN_BY_ROLE'
                    ? 'denied'
                    : 'error',
              });
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: call.name ?? outcome.toolName,
                  response: outcome as unknown as Record<string, unknown>,
                },
              });
            }
            contents.push({ role: 'user', parts: responseParts });
            continue;
          }

          finalReply = (response.text ?? '').trim();
          break;
        }

        const updatedMemory = appendConversationTurn({
          companyId: user.companyId,
          userId: user.userId,
          userText: message,
          roseText: finalReply,
          persistMemory: saveMemory,
          topics: extractTopicsFromToolCalls(executedTools.map((t) => t.toolName)),
        });

        res.json({
          reply: finalReply || 'I checked the records, though I did not receive a complete summary.',
          toolCalls: executedTools,
          memory: updatedMemory,
        });
      } catch (err) {
        const formatted = formatGeminiError(err);
        res.status(formatted.status).json({
          error: formatted.code,
          message: formatted.message,
        });
      }
    }
  );

  // Gemini TTS endpoint for "Test Voice" and optional spoken text replies
  app.post(
    '/api/rose/tts',
    requireAuth,
    apiRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (!text || text.length > 1500) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'TTS text must be between 1 and 1500 characters.',
        });
        return;
      }
      const voiceId = sanitizeVoiceId(req.body?.voiceId);
      const preset = getVoicePreset(voiceId);

      try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: {
                    style: preset.stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceId },
              },
            },
          },
        });

        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
          res.status(502).json({
            error: 'TTS_EMPTY_RESPONSE',
            message: 'Speech synthesis returned no audio payload.',
          });
          return;
        }

        res.json({
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          voiceId,
        });
      } catch (err) {
        const formatted = formatGeminiError(err);
        res.status(formatted.status).json({
          error: formatted.code,
          message: formatted.message,
        });
      }
    }
  );

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (reqUrl.pathname !== '/ws/rose-live') {
      return;
    }

    const token = reqUrl.searchParams.get('token');
    const user = verifySessionToken(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, user);
    });
  });

  wss.on(
    'connection',
    async (clientWs: WebSocket, request: http.IncomingMessage, user: UserProfile) => {
    const reqUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const voiceId = sanitizeVoiceId(reqUrl.searchParams.get('voice'));
    const voiceSpeed = Number(reqUrl.searchParams.get('speed') ?? '1.0') || 1.0;
    const proactive = reqUrl.searchParams.get('proactive') !== 'false';
    const saveMemory = reqUrl.searchParams.get('memory') !== 'false';

    let closed = false;
    let setupReady = false;
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let pendingUserTranscript = '';
    let pendingRoseTranscript = '';
    const recentToolNames: string[] = [];
    const pendingClientMessages: Array<{ type?: string; data?: string; text?: string }> = [];

    const sendJson = (payload: Record<string, unknown>) => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const markReady = () => {
      if (setupReady || closed) return;
      setupReady = true;
      sendJson({
        type: 'ready',
        voiceId,
        companyId: user.companyId,
        companyName: user.companyName,
      });
      while (pendingClientMessages.length > 0 && liveSession) {
        const queued = pendingClientMessages.shift()!;
        forwardClientMessage(queued);
      }
    };

    const forwardClientMessage = (msg: { type?: string; data?: string; text?: string }) => {
      if (!liveSession || closed) return;
      if (msg.type === 'audio' && typeof msg.data === 'string' && msg.data.length > 0) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim()) {
        liveSession.sendRealtimeInput({
          text: msg.text.trim(),
        });
      } else if (msg.type === 'ping') {
        sendJson({ type: 'pong' });
      }
    };

    // 12-minute session timeout protection
    const sessionTimeout = setTimeout(() => {
      sendJson({
        type: 'session_timeout',
        message: 'Live voice session reached its 12-minute window. Reconnect anytime.',
      });
      clientWs.close(1000, 'Session timeout');
    }, 12 * 60 * 1000);

    let readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const ai = getAiClient();
      const bucket = getConversationBucket(user.companyId, user.userId);
      const systemInstruction = buildRoseSystemInstruction({
        user,
        memory: saveMemory ? bucket.memory : null,
        voiceSpeed,
        proactiveNotifications: proactive,
      });

      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: ROSE_TOOL_DECLARATIONS }],
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            readyFallbackTimer = setTimeout(markReady, 450);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.setupComplete) {
              if (readyFallbackTimer) {
                clearTimeout(readyFallbackTimer);
                readyFallbackTimer = null;
              }
              markReady();
            }

            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              pendingUserTranscript += content.inputTranscription.text;
              sendJson({
                type: 'input_transcript',
                text: content.inputTranscription.text,
              });
            }

            if (content?.outputTranscription?.text) {
              pendingRoseTranscript += content.outputTranscription.text;
              sendJson({
                type: 'output_transcript',
                text: content.outputTranscription.text,
              });
            }

            if (content?.interrupted) {
              pendingRoseTranscript = '';
              sendJson({ type: 'interrupted' });
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendJson({
                  type: 'audio',
                  data: part.inlineData.data,
                });
              }
            }

            if (message.toolCall?.functionCalls?.length) {
              const responses = message.toolCall.functionCalls.map((call) => {
                const outcome = dispatchFactoryToolCall(
                  user,
                  call.name,
                  call.args as Record<string, unknown> | undefined
                );
                recentToolNames.push(outcome.toolName);
                sendJson({
                  type: 'tool_call',
                  id: call.id ?? `${outcome.toolName}-${Date.now()}`,
                  toolName: outcome.toolName,
                  summary: outcome.summary,
                  status: outcome.ok
                    ? 'ok'
                    : outcome.data.error === 'FORBIDDEN_BY_ROLE'
                      ? 'denied'
                      : 'error',
                });
                return {
                  id: call.id,
                  name: call.name ?? outcome.toolName,
                  response: outcome as unknown as Record<string, unknown>,
                };
              });

              liveSession?.sendToolResponse({
                functionResponses: responses,
              });
            }

            if (content?.turnComplete) {
              if (pendingUserTranscript.trim() || pendingRoseTranscript.trim()) {
                const updatedMemory = appendConversationTurn({
                  companyId: user.companyId,
                  userId: user.userId,
                  userText: pendingUserTranscript,
                  roseText: pendingRoseTranscript,
                  persistMemory: saveMemory,
                  topics: extractTopicsFromToolCalls(recentToolNames),
                });
                sendJson({ type: 'memory_updated', memory: updatedMemory });
                pendingUserTranscript = '';
                pendingRoseTranscript = '';
                recentToolNames.length = 0;
              }
              sendJson({ type: 'turn_complete' });
            }
          },
          onerror: (errEvent) => {
            sendJson({
              type: 'error',
              code: 'GEMINI_LIVE_ERROR',
              message: errEvent?.message || 'Live voice session encountered a connection error.',
            });
          },
          onclose: (closeEvent) => {
            if (!closed) {
              if (closeEvent?.code && closeEvent.code !== 1000) {
                sendJson({
                  type: 'error',
                  code: `LIVE_CLOSED_${closeEvent.code}`,
                  message: closeEvent.reason || 'Live voice session closed unexpectedly.',
                });
              } else {
                sendJson({
                  type: 'live_closed',
                  reason: closeEvent?.reason || 'Live session closed.',
                });
              }
            }
          },
        },
      });
    } catch (err) {
      if (readyFallbackTimer) clearTimeout(readyFallbackTimer);
      const formatted = formatGeminiError(err);
      sendJson({
        type: 'error',
        code: formatted.code,
        message: formatted.message,
      });
      clientWs.close(1011, formatted.code);
      clearTimeout(sessionTimeout);
      return;
    }

    clientWs.on('message', (raw) => {
      if (closed || !liveSession) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          data?: string;
          text?: string;
        };
        if (!setupReady && msg.type !== 'ping') {
          if (pendingClientMessages.length < 32) {
            pendingClientMessages.push(msg);
          }
          return;
        }
        forwardClientMessage(msg);
      } catch {
        sendJson({
          type: 'error',
          code: 'INVALID_WS_FRAME',
          message: 'Malformed WebSocket message payload.',
        });
      }
    });

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(sessionTimeout);
      if (readyFallbackTimer) clearTimeout(readyFallbackTimer);
      try {
        liveSession?.close();
      } catch {
        // Ignore close errors during teardown
      }
      liveSession = null;
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ROSE Factory Memory OS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ROSE server:', err);
  process.exit(1);
});
