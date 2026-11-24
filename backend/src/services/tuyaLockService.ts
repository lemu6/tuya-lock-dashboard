import crypto from 'crypto';
import { config, formatTimezoneDate, resolveBatteryStatus } from '../config';
import {
  AccessMethod,
  ILockService,
  LockAction,
  LockCommandResult,
  LockLogEntry,
  LockStatus,
} from '../types/lock';

interface TuyaApiResponse<T> {
  success: boolean;
  code?: number;
  msg?: string;
  t?: number;
  tid?: string;
  result: T;
}

interface TuyaTokenResult {
  access_token: string;
  expire_time: number;
  refresh_token: string;
  uid: string;
}

interface TuyaDeviceDetail {
  id: string;
  name: string;
  online: boolean;
  category?: string;
  status?: Array<{ code: string; value: unknown }>;
  update_time?: number;
}

interface TuyaDeviceStatusItem {
  code: string;
  value: unknown;
}

interface TuyaLogItem {
  event_id?: number;
  code?: string;
  value?: unknown;
  event_time?: number;
  status?: string;
}

interface TuyaOpenLogsResult {
  logs?: Array<{
    unlock_name?: string;
    nick_name?: string;
    unlock_time?: number;
    dp_code?: string;
    dp_value?: unknown;
    record_id?: string;
  }>;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

/**
 * Integração com a Tuya Cloud OpenAPI v2.0 utilizando assinatura HMAC-SHA256.
 * Requer vínculo prévio do dispositivo/app na conta do projeto Tuya Cloud.
 */
export class TuyaLockService implements ILockService {
  public readonly mode = 'tuya' as const;
  private cachedToken: CachedToken | null = null;

  private assertCredentials(): void {
    if (!config.tuya.accessId || !config.tuya.accessSecret) {
      throw new Error(
        'Credenciais Tuya ausentes. Configure TUYA_ACCESS_ID e TUYA_ACCESS_SECRET no arquivo .env.'
      );
    }
    if (!config.tuya.deviceId) {
      throw new Error('TUYA_DEVICE_ID não configurado no arquivo .env.');
    }
  }

  /**
   * Canonicaliza path + query string ordenada alfabeticamente conforme especificação Tuya OpenAPI.
   */
  private buildCanonicalUrl(pathWithQuery: string): string {
    const [pathname, rawQuery] = pathWithQuery.split('?');
    if (!rawQuery) {
      return pathname;
    }

    const params = new URLSearchParams(rawQuery);
    const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const canonicalQuery = sortedEntries
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname;
  }

  /**
   * Gera a assinatura HMAC-SHA256 requerida pelo header `sign` da Tuya Cloud API.
   *
   * stringToSign = HTTPMethod + "\n" + Content-SHA256 + "\n" + Headers + "\n" + Url
   * payload      = client_id + [access_token] + t + nonce + stringToSign
   * sign         = HMAC-SHA256(accessSecret, payload).toUpperCase()
   */
  public buildSignature(params: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    pathWithQuery: string;
    body?: string;
    timestamp: string;
    nonce?: string;
    accessToken?: string;
  }): { sign: string; canonicalUrl: string; contentHash: string } {
    const canonicalUrl = this.buildCanonicalUrl(params.pathWithQuery);
    const bodyString = params.body ?? '';
    const contentHash = crypto.createHash('sha256').update(bodyString, 'utf8').digest('hex');
    const signedHeaders = '';
    const nonce = params.nonce ?? '';

    const stringToSign = [
      params.method.toUpperCase(),
      contentHash,
      signedHeaders,
      canonicalUrl,
    ].join('\n');

    const signPayload = `${config.tuya.accessId}${params.accessToken ?? ''}${params.timestamp}${nonce}${stringToSign}`;
    const sign = crypto
      .createHmac('sha256', config.tuya.accessSecret)
      .update(signPayload, 'utf8')
      .digest('hex')
      .toUpperCase();

    return { sign, canonicalUrl, contentHash };
  }

  private async requestTuya<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    pathWithQuery: string,
    body?: Record<string, unknown>,
    requiresToken = true
  ): Promise<T> {
    this.assertCredentials();

    const accessToken = requiresToken ? await this.getAccessToken() : undefined;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const serializedBody = body ? JSON.stringify(body) : '';

    const { sign, canonicalUrl } = this.buildSignature({
      method,
      pathWithQuery,
      body: serializedBody,
      timestamp,
      nonce,
      accessToken,
    });

    const headers: Record<string, string> = {
      client_id: config.tuya.accessId,
      sign,
      t: timestamp,
      sign_method: 'HMAC-SHA256',
      nonce,
    };

    if (accessToken) {
      headers.access_token = accessToken;
    }
    if (serializedBody) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${config.tuya.endpoint}${canonicalUrl}`, {
      method,
      headers,
      body: serializedBody || undefined,
    });

    const data = (await response.json()) as TuyaApiResponse<T>;
    if (!response.ok || !data.success) {
      const codeInfo = data.code ? ` (código Tuya ${data.code})` : '';
      throw new Error(`Erro na Tuya Cloud API${codeInfo}: ${data.msg || response.statusText}`);
    }

    return data.result;
  }

  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Renova com 60s de margem antes da expiração
    if (this.cachedToken && this.cachedToken.expiresAtMs - 60_000 > now) {
      return this.cachedToken.accessToken;
    }

    const result = await this.requestTuya<TuyaTokenResult>(
      'GET',
      '/v1.0/token?grant_type=1',
      undefined,
      false
    );

    this.cachedToken = {
      accessToken: result.access_token,
      expiresAtMs: now + result.expire_time * 1000,
    };

    return this.cachedToken.accessToken;
  }

  private parseStatusDps(dps: TuyaDeviceStatusItem[]): {
    isLocked: boolean;
    batteryPercent: number;
    signalStrength: number;
  } {
    const dpMap = new Map<string, unknown>(dps.map((item) => [item.code, item.value]));

    // DPs comuns de fechaduras Tuya (Smart Lock)
    const lockMotorState = dpMap.get('lock_motor_state');
    const closedOpened = dpMap.get('closed_opened');
    const doorLockState = dpMap.get('door_lock_state');

    let isLocked = true;
    if (typeof lockMotorState === 'boolean') {
      isLocked = !lockMotorState; // Em diversos modelos Tuya true = motor aberto
    } else if (typeof closedOpened === 'string') {
      isLocked = closedOpened === 'closed';
    } else if (typeof doorLockState === 'boolean') {
      isLocked = doorLockState;
    }

    const rawBattery =
      dpMap.get('residual_electricity') ?? dpMap.get('battery_percentage') ?? dpMap.get('battery_state');

    let batteryPercent = 100;
    if (typeof rawBattery === 'number') {
      batteryPercent = Math.max(0, Math.min(100, rawBattery));
    } else if (rawBattery === 'high') {
      batteryPercent = 90;
    } else if (rawBattery === 'medium') {
      batteryPercent = 50;
    } else if (rawBattery === 'low') {
      batteryPercent = 15;
    }

    const rawRssi = dpMap.get('wifi_rssi');
    const signalStrength = typeof rawRssi === 'number' ? rawRssi : -60;

    return { isLocked, batteryPercent, signalStrength };
  }

  async getStatus(): Promise<LockStatus> {
    const deviceId = config.tuya.deviceId;
    const [detail, statusList] = await Promise.all([
      this.requestTuya<TuyaDeviceDetail>('GET', `/v1.0/iot-03/devices/${deviceId}`),
      this.requestTuya<TuyaDeviceStatusItem[]>('GET', `/v1.0/iot-03/devices/${deviceId}/status`),
    ]);

    const parsed = this.parseStatusDps(statusList ?? detail.status ?? []);
    const now = new Date();
    const updatedAt = detail.update_time ? new Date(detail.update_time * 1000) : now;

    return {
      deviceId: detail.id || deviceId,
      mac: config.tuya.deviceMac,
      deviceName: detail.name || 'Fechadura Inteligente Tuya',
      projectName: config.tuya.projectName,
      projectCode: config.tuya.projectCode,
      online: Boolean(detail.online),
      isLocked: parsed.isLocked,
      batteryPercent: parsed.batteryPercent,
      batteryStatus: resolveBatteryStatus(parsed.batteryPercent),
      signalStrength: parsed.signalStrength,
      timezone: config.timezone,
      localTime: formatTimezoneDate(now),
      lastUpdated: formatTimezoneDate(updatedAt),
      source: 'tuya',
      networkRange: config.tuya.networkRange,
    };
  }

  private mapTuyaDpToMethod(code?: string): { method: AccessMethod; label: string } {
    switch (code) {
      case 'unlock_fingerprint':
        return { method: 'fingerprint', label: 'Biometria' };
      case 'unlock_password':
      case 'unlock_temporary':
        return { method: 'pin_code', label: 'Senha PIN' };
      case 'unlock_card':
        return { method: 'rfid_card', label: 'Cartão RFID' };
      case 'unlock_app':
      case 'remote_no_dp_key':
        return { method: 'remote_app', label: 'App Tuya Smart' };
      case 'unlock_key':
        return { method: 'mechanical_key', label: 'Chave Mecânica' };
      default:
        return { method: 'remote_dashboard', label: code || 'Evento Tuya' };
    }
  }

  async getLogs(limit = 20): Promise<LockLogEntry[]> {
    const deviceId = config.tuya.deviceId;
    const safeLimit = Math.max(1, Math.min(limit, 100));

    // Tenta Smart Lock Open Service (/door-lock/open-logs) e faz fallback para /iot-03/devices/{id}/logs
    try {
      const openLogs = await this.requestTuya<TuyaOpenLogsResult>(
        'GET',
        `/v1.0/devices/${deviceId}/door-lock/open-logs?page_no=1&page_size=${safeLimit}`
      );

      if (Array.isArray(openLogs.logs)) {
        return openLogs.logs.map((item, idx) => {
          const eventMs = item.unlock_time ? item.unlock_time : Date.now();
          const date = new Date(eventMs);
          const mapped = this.mapTuyaDpToMethod(item.dp_code);
          return {
            id: item.record_id || `tuya-open-log-${eventMs}-${idx}`,
            timestamp: date.toISOString(),
            localTime: formatTimezoneDate(date),
            action: 'unlock',
            method: mapped.method,
            methodLabel: mapped.label,
            actor: item.nick_name || item.unlock_name || 'Usuário Tuya',
            success: true,
            details: item.dp_code ? `DP: ${item.dp_code}` : undefined,
          };
        });
      }
    } catch {
      // Fallback para endpoint genérico de logs do IoT Core
    }

    const endTime = Date.now();
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000;
    const result = await this.requestTuya<{ logs?: TuyaLogItem[] }>(
      'GET',
      `/v1.0/iot-03/devices/${deviceId}/logs?end_time=${endTime}&size=${safeLimit}&start_time=${startTime}&type=7`
    );

    return (result.logs ?? []).map((item, idx) => {
      const eventMs = item.event_time || Date.now();
      const date = new Date(eventMs);
      const mapped = this.mapTuyaDpToMethod(item.code);
      const isLock = item.code?.includes('lock') && !item.code?.includes('unlock');
      return {
        id: `tuya-log-${item.event_id ?? idx}-${eventMs}`,
        timestamp: date.toISOString(),
        localTime: formatTimezoneDate(date),
        action: isLock ? 'lock' : 'unlock',
        method: mapped.method,
        methodLabel: mapped.label,
        actor: 'Dispositivo Tuya',
        success: true,
        details: item.code ? `DP ${item.code}: ${String(item.value ?? '')}` : undefined,
      };
    });
  }

  async unlock(actor = 'Operador Dashboard'): Promise<LockCommandResult> {
    const deviceId = config.tuya.deviceId;

    // Fluxo oficial Smart Lock Open Service: obtém ticket temporário e dispara abertura sem senha
    const ticket = await this.requestTuya<{ ticket_id: string }>(
      'POST',
      `/v1.0/devices/${deviceId}/door-lock/password-ticket`
    );

    await this.requestTuya<boolean>(
      'POST',
      `/v1.0/devices/${deviceId}/door-lock/password-free/open-door`,
      { ticket_id: ticket.ticket_id }
    );

    const status = await this.getStatus();
    const now = new Date();
    return {
      success: true,
      action: 'unlock',
      message: 'Comando de destrancamento enviado via Tuya Cloud.',
      status,
      logEntry: {
        id: `tuya-cmd-${Date.now()}`,
        timestamp: now.toISOString(),
        localTime: formatTimezoneDate(now),
        action: 'unlock',
        method: 'remote_dashboard',
        methodLabel: 'Dashboard Web',
        actor,
        success: true,
        details: `Ticket Tuya: ${ticket.ticket_id}`,
      },
    };
  }

  async lock(actor = 'Operador Dashboard'): Promise<LockCommandResult> {
    const deviceId = config.tuya.deviceId;

    // Envia comando IoT Core para travamento remoto (DP depende do modelo da fechadura)
    await this.requestTuya<boolean>(
      'POST',
      `/v1.0/iot-03/devices/${deviceId}/commands`,
      {
        commands: [{ code: 'lock_motor_state', value: false }],
      }
    );

    const status = await this.getStatus();
    const now = new Date();
    return {
      success: true,
      action: 'lock',
      message: 'Comando de trancamento enviado via Tuya Cloud.',
      status,
      logEntry: {
        id: `tuya-cmd-${Date.now()}`,
        timestamp: now.toISOString(),
        localTime: formatTimezoneDate(now),
        action: 'lock',
        method: 'remote_dashboard',
        methodLabel: 'Dashboard Web',
        actor,
        success: true,
        details: 'Comando DP lock_motor_state=false enviado via IoT Core',
      },
    };
  }
}
