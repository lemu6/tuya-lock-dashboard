import { config, formatTimezoneDate, resolveBatteryStatus } from '../config';
import {
  AccessMethod,
  ILockService,
  LockAction,
  LockCommandResult,
  LockLogEntry,
  LockStatus,
} from '../types/lock';

const METHOD_LABELS: Record<AccessMethod, string> = {
  remote_dashboard: 'Dashboard Web',
  remote_app: 'App Tuya Smart',
  fingerprint: 'Biometria',
  pin_code: 'Senha PIN',
  rfid_card: 'Cartão RFID',
  mechanical_key: 'Chave Mecânica',
  auto_lock: 'Travamento Automático',
};

export class MockLockService implements ILockService {
  public readonly mode = 'mock' as const;

  private isLocked = true;
  private batteryPercent = 87;
  private signalStrength = -54;
  private lastUpdated = new Date();
  private logs: LockLogEntry[] = [];

  constructor() {
    this.seedInitialLogs();
  }

  private seedInitialLogs(): void {
    const now = Date.now();
    const initialEvents: Array<{
      minutesAgo: number;
      action: LockAction;
      method: AccessMethod;
      actor: string;
      details?: string;
    }> = [
      {
        minutesAgo: 12,
        action: 'lock',
        method: 'auto_lock',
        actor: 'Sistema da Fechadura',
        details: 'Travamento automático após fechamento da porta',
      },
      {
        minutesAgo: 14,
        action: 'unlock',
        method: 'fingerprint',
        actor: 'Prof. Carlos Mendes',
        details: 'Digital cadastrada #02',
      },
      {
        minutesAgo: 95,
        action: 'lock',
        method: 'remote_app',
        actor: 'Coordenação Lab',
        details: 'Comando via aplicativo móvel',
      },
      {
        minutesAgo: 128,
        action: 'unlock',
        method: 'pin_code',
        actor: 'Equipe Pesquisa A',
        details: 'PIN temporário do laboratório',
      },
      {
        minutesAgo: 260,
        action: 'lock',
        method: 'auto_lock',
        actor: 'Sistema da Fechadura',
        details: 'Travamento automático após 15s',
      },
      {
        minutesAgo: 263,
        action: 'unlock',
        method: 'rfid_card',
        actor: 'Bolsista Ana Silva',
        details: 'Tag RFID #104',
      },
    ];

    this.logs = initialEvents.map((event, index) => {
      const date = new Date(now - event.minutesAgo * 60_000);
      return {
        id: `mock-log-${index + 1}`,
        timestamp: date.toISOString(),
        localTime: formatTimezoneDate(date),
        action: event.action,
        method: event.method,
        methodLabel: METHOD_LABELS[event.method],
        actor: event.actor,
        success: true,
        details: event.details,
      };
    });
  }

  private buildStatus(): LockStatus {
    const now = new Date();
    return {
      deviceId: config.tuya.deviceId,
      mac: config.tuya.deviceMac,
      deviceName: 'Fechadura Inteligente Lab UFPI',
      projectName: config.tuya.projectName,
      projectCode: config.tuya.projectCode,
      online: true,
      isLocked: this.isLocked,
      batteryPercent: this.batteryPercent,
      batteryStatus: resolveBatteryStatus(this.batteryPercent),
      signalStrength: this.signalStrength,
      timezone: config.timezone,
      localTime: formatTimezoneDate(now),
      lastUpdated: formatTimezoneDate(this.lastUpdated),
      source: 'mock',
      networkRange: config.tuya.networkRange,
    };
  }

  async getStatus(): Promise<LockStatus> {
    return this.buildStatus();
  }

  async getLogs(limit = 20): Promise<LockLogEntry[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.logs.slice(0, safeLimit);
  }

  private executeAction(action: LockAction, actor = 'Operador Dashboard'): LockCommandResult {
    const now = new Date();
    const targetLocked = action === 'lock';
    const alreadyInState = this.isLocked === targetLocked;

    this.isLocked = targetLocked;
    this.lastUpdated = now;

    if (!alreadyInState && this.batteryPercent > 10) {
      // Simula consumo mínimo de bateria em operação mecânica
      this.batteryPercent = Math.max(10, this.batteryPercent - (action === 'unlock' ? 1 : 0));
    }

    const logEntry: LockLogEntry = {
      id: `mock-log-${Date.now()}`,
      timestamp: now.toISOString(),
      localTime: formatTimezoneDate(now),
      action,
      method: 'remote_dashboard',
      methodLabel: METHOD_LABELS.remote_dashboard,
      actor,
      success: true,
      details: alreadyInState
        ? `Fechadura já estava ${targetLocked ? 'trancada' : 'destrancada'} (estado confirmado)`
        : `Comando remoto executado em modo Mock`,
    };

    this.logs.unshift(logEntry);

    return {
      success: true,
      action,
      message: targetLocked
        ? 'Fechadura trancada com sucesso (Mock).'
        : 'Fechadura destrancada com sucesso (Mock).',
      status: this.buildStatus(),
      logEntry,
    };
  }

  async unlock(actor?: string): Promise<LockCommandResult> {
    return this.executeAction('unlock', actor);
  }

  async lock(actor?: string): Promise<LockCommandResult> {
    return this.executeAction('lock', actor);
  }
}
