import type {
  ConversationMemoryState,
  TranscriptMessage,
} from '../../src/types/rose.ts';

interface StoredMemoryBucket {
  memory: ConversationMemoryState;
  turns: Array<{ role: 'user' | 'model'; text: string }>;
}

// Scoped strictly by `${companyId}::${userId}` so personal conversation memory
// is completely isolated from company operational records and other users.
const memoryStore = new Map<string, StoredMemoryBucket>();

function bucketKey(companyId: string, userId: string): string {
  return `${companyId}::${userId}`;
}

export function getConversationBucket(
  companyId: string,
  userId: string
): StoredMemoryBucket {
  const key = bucketKey(companyId, userId);
  const existing = memoryStore.get(key);
  if (existing) return existing;

  const fresh: StoredMemoryBucket = {
    memory: {
      summary: '',
      topicsDiscussed: [],
      lastUpdated: new Date().toISOString(),
      turnCount: 0,
    },
    turns: [],
  };
  memoryStore.set(key, fresh);
  return fresh;
}

export function appendConversationTurn(params: {
  companyId: string;
  userId: string;
  userText: string;
  roseText: string;
  persistMemory: boolean;
  topics?: string[];
}): ConversationMemoryState {
  const bucket = getConversationBucket(params.companyId, params.userId);
  if (!params.persistMemory) {
    return bucket.memory;
  }

  if (params.userText.trim()) {
    bucket.turns.push({ role: 'user', text: params.userText.trim() });
  }
  if (params.roseText.trim()) {
    bucket.turns.push({ role: 'model', text: params.roseText.trim() });
  }

  // Keep bounded sliding window of recent turns
  if (bucket.turns.length > 24) {
    bucket.turns = bucket.turns.slice(-24);
  }

  const nextTopics = new Set(bucket.memory.topicsDiscussed);
  for (const topic of params.topics ?? []) {
    if (topic) nextTopics.add(topic);
  }

  const recentSnippet = bucket.turns
    .slice(-4)
    .map((t) => `${t.role === 'user' ? 'User' : 'ROSE'}: ${t.text.slice(0, 140)}`)
    .join(' | ');

  bucket.memory = {
    summary: recentSnippet,
    topicsDiscussed: Array.from(nextTopics).slice(-8),
    lastUpdated: new Date().toISOString(),
    turnCount: bucket.memory.turnCount + 1,
  };

  return bucket.memory;
}

export function clearConversationMemory(companyId: string, userId: string): ConversationMemoryState {
  const key = bucketKey(companyId, userId);
  const empty: StoredMemoryBucket = {
    memory: {
      summary: '',
      topicsDiscussed: [],
      lastUpdated: new Date().toISOString(),
      turnCount: 0,
    },
    turns: [],
  };
  memoryStore.set(key, empty);
  return empty.memory;
}

export function extractTopicsFromToolCalls(toolNames: string[]): string[] {
  const map: Record<string, string> = {
    getProductionSummary: 'Production',
    getProductionComparison: 'Production Comparison',
    getInventoryStatus: 'Inventory',
    getMaterialConsumption: 'Materials',
    getMachineStatus: 'Machines',
    getMachineDowntime: 'Downtime',
    getMaintenanceSchedule: 'Maintenance',
    getIncidentSummary: 'Incidents',
    getQualitySummary: 'Quality',
    getShiftHandover: 'Shift Handover',
    getFactoryOverview: 'Factory Overview',
  };
  return toolNames.map((n) => map[n]).filter(Boolean);
}

export type { TranscriptMessage };
