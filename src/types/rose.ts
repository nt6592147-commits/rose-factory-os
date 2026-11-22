export type OrbState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'DISCONNECTED'
  | 'ERROR';

export type RoseVoiceId = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export type OrbQuality = 'high' | 'balanced' | 'lightweight';

export type DefaultInputMode = 'voice' | 'text';

export type UserRole =
  | 'plant_director'
  | 'operations_manager'
  | 'shift_supervisor'
  | 'line_operator';

export interface UserProfile {
  userId: string;
  name: string;
  title: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  plantLocation: string;
  permissions: string[];
}

export interface RoseSettingsConfig {
  voiceId: RoseVoiceId;
  voiceSpeed: number;
  assistantVolume: number;
  orbQuality: OrbQuality;
  animationIntensity: number;
  proactiveNotifications: boolean;
  autoSpeakTextReplies: boolean;
  saveConversationMemory: boolean;
  defaultInputMode: DefaultInputMode;
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  summary: string;
  timestamp: string;
  status: 'ok' | 'denied' | 'error';
}

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'rose' | 'system';
  text: string;
  timestamp: string;
  source: 'voice' | 'text';
  toolCalls?: ToolExecutionRecord[];
  isPartial?: boolean;
}

export interface ProactiveInsight {
  id: string;
  category: 'production' | 'inventory' | 'incidents' | 'maintenance' | 'quality';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  suggestedPrompt: string;
  metricLabel: string;
}

export interface FactoryOverviewSnapshot {
  companyId: string;
  companyName: string;
  plantLocation: string;
  currentShift: string;
  productionAchievementPct: number;
  totalProducedToday: number;
  totalTargetToday: number;
  activeMachinesCount: number;
  totalMachinesCount: number;
  unresolvedIncidentsCount: number;
  lowStockMaterialsCount: number;
  qualityPassRatePct: number;
}

export interface ConversationMemoryState {
  summary: string;
  topicsDiscussed: string[];
  lastUpdated: string;
  turnCount: number;
}
