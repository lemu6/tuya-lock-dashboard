import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface AppConfig {
  port: number;
  useMock: boolean;
  timezone: string;
  tuya: {
    projectName: string;
    projectCode: string;
    endpoint: string;
    accessId: string;
    accessSecret: string;
    deviceId: string;
    deviceMac: string;
    networkRange: string;
  };
}

export const config: AppConfig = {
  port: parsePort(process.env.PORT, 3001),
  useMock: parseBoolean(process.env.USE_MOCK, true),
  timezone: process.env.APP_TIMEZONE || 'America/Fortaleza',
  tuya: {
    projectName: process.env.TUYA_PROJECT_NAME || 'Fechadura-lab',
    projectCode: process.env.TUYA_PROJECT_CODE || 'p1795538342884cfemuy',
    endpoint: (process.env.TUYA_ENDPOINT || 'https://openapi.tuyaus.com').replace(/\/+$/, ''),
    accessId: process.env.TUYA_ACCESS_ID || '',
    accessSecret: process.env.TUYA_ACCESS_SECRET || '',
    deviceId: process.env.TUYA_DEVICE_ID || 'eb1024d8e9fbf9d540tpty',
    deviceMac: process.env.TUYA_DEVICE_MAC || '4c:a9:19:70:3c:d2',
    networkRange: process.env.TUYA_NETWORK_RANGE || '200.137.163.*',
  },
};

export function formatTimezoneDate(date: Date | number | string, timeZone = config.timezone): string {
  const parsed = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function resolveBatteryStatus(percent: number): 'high' | 'medium' | 'low' {
  if (percent >= 50) return 'high';
  if (percent >= 20) return 'medium';
  return 'low';
}
