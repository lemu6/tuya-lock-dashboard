export type LockAction = 'lock' | 'unlock';

export type AccessMethod =
  | 'remote_dashboard'
  | 'remote_app'
  | 'fingerprint'
  | 'pin_code'
  | 'rfid_card'
  | 'mechanical_key'
  | 'auto_lock';

export type DataSourceMode = 'mock' | 'tuya';

export interface LockStatus {
  deviceId: string;
  mac: string;
  deviceName: string;
  projectName: string;
  projectCode: string;
  online: boolean;
  isLocked: boolean;
  batteryPercent: number;
  batteryStatus: 'high' | 'medium' | 'low';
  signalStrength: number;
  timezone: string;
  localTime: string;
  lastUpdated: string;
  source: DataSourceMode;
  networkRange: string;
}

export interface LockLogEntry {
  id: string;
  timestamp: string;
  localTime: string;
  action: LockAction;
  method: AccessMethod;
  methodLabel: string;
  actor: string;
  success: boolean;
  details?: string;
}

export interface LockLogsResponse {
  mode: DataSourceMode;
  timezone: string;
  count: number;
  logs: LockLogEntry[];
}

export interface LockCommandResult {
  success: boolean;
  action: LockAction;
  message: string;
  status: LockStatus;
  logEntry: LockLogEntry;
}
