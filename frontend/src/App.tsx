import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  CheckCircle2,
  Clock,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { lockApi } from './api/lockApi';
import { AccessLogsTable } from './components/AccessLogsTable';
import { StatusCard } from './components/StatusCard';
import { LockAction, LockLogEntry, LockStatus } from './types/lock';

const FORTALEZA_TIMEZONE = 'America/Fortaleza';

function formatFortalezaNow(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FORTALEZA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function App() {
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [logs, setLogs] = useState<LockLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAction, setPendingAction] = useState<LockAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fortalezaClock, setFortalezaClock] = useState(() => formatFortalezaNow(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFortalezaClock(formatFortalezaNow(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const [statusData, logsData] = await Promise.all([
        lockApi.getStatus(),
        lockApi.getLogs(25),
      ]);
      setStatus(statusData);
      setLogs(logsData.logs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar dados da fechadura.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const handleAction = async (action: LockAction) => {
    setPendingAction(action);
    setError(null);
    setFeedback(null);

    try {
      const result = action === 'unlock' ? await lockApi.unlock() : await lockApi.lock();
      setStatus(result.status);
      setLogs((prev) => [result.logEntry, ...prev.filter((item) => item.id !== result.logEntry.id)]);
      setFeedback(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar comando para fechadura.';
      setError(message);
    } finally {
      setPendingAction(null);
    }
  };

  const renderBatteryIcon = (percent: number) => {
    if (percent < 20) return <BatteryLow className="h-5 w-5 text-rose-400" />;
    if (percent < 50) return <BatteryMedium className="h-5 w-5 text-amber-400" />;
    return <BatteryCharging className="h-5 w-5 text-emerald-400" />;
  };

  const batteryBarColor = (percent: number) => {
    if (percent < 20) return 'bg-rose-500';
    if (percent < 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
              <ShieldCheck className="h-4 w-4" />
              UFPI · Controle de Acesso Inteligente
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              tuya-lock-dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Monitoramento e acionamento remoto da fechadura{' '}
              <span className="font-medium text-slate-200">{status?.projectName ?? 'Fechadura-lab'}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status && (
              <span
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ring-1 ${
                  status.source === 'mock'
                    ? 'bg-violet-500/10 text-violet-300 ring-violet-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    status.source === 'mock' ? 'bg-violet-400' : 'bg-emerald-400'
                  }`}
                />
                {status.source === 'mock'
                  ? 'Modo Mock Ativo (USE_MOCK=true)'
                  : 'Tuya Cloud Ativa (USE_MOCK=false)'}
              </span>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {feedback && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}

        {loading && !status ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-sm text-slate-400">
            Carregando telemetria da fechadura...
          </div>
        ) : status ? (
          <div className="space-y-6">
            <StatusCard
              status={status}
              pendingAction={pendingAction}
              onLock={() => void handleAction('lock')}
              onUnlock={() => void handleAction('unlock')}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Card de Bateria */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Nível de Bateria
                  </span>
                  {renderBatteryIcon(status.batteryPercent)}
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{status.batteryPercent}%</span>
                  <span className="text-xs text-slate-400">
                    {status.batteryStatus === 'high'
                      ? 'Carga saudável'
                      : status.batteryStatus === 'medium'
                      ? 'Carga moderada'
                      : 'Troca recomendada'}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${batteryBarColor(
                      status.batteryPercent
                    )}`}
                    style={{ width: `${status.batteryPercent}%` }}
                  />
                </div>
              </div>

              {/* Card de Horário America/Fortaleza */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Horário Local ({status.timezone})
                  </span>
                  <Clock className="h-5 w-5 text-sky-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-bold text-white">{fortalezaClock}</div>
                <p className="mt-2 text-xs text-slate-400">
                  Última atualização da fechadura:{' '}
                  <span className="font-mono text-slate-300">{status.lastUpdated}</span>
                </p>
              </div>

              {/* Card de Contexto Tuya Lab */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Projeto Tuya Cloud
                  </span>
                  <Cpu className="h-5 w-5 text-violet-400" />
                </div>
                <div className="mt-3 text-lg font-semibold text-white">{status.projectName}</div>
                <dl className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between gap-2">
                    <dt>Project Code:</dt>
                    <dd className="font-mono text-slate-300">{status.projectCode}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Rede Lab:</dt>
                    <dd className="font-mono text-slate-300">{status.networkRange}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <AccessLogsTable
              logs={logs}
              timezone={status.timezone}
              isRefreshing={refreshing}
              onRefresh={() => void loadDashboard(true)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
