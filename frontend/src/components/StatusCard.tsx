import { Lock, LockOpen, Wifi, WifiOff } from 'lucide-react';
import { LockAction, LockStatus } from '../types/lock';

interface StatusCardProps {
  status: LockStatus;
  pendingAction: LockAction | null;
  onLock: () => void;
  onUnlock: () => void;
}

export function StatusCard({ status, pendingAction, onLock, onUnlock }: StatusCardProps) {
  const isBusy = pendingAction !== null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${
              status.isLocked
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
          >
            {status.isLocked ? <Lock className="h-8 w-8" /> : <LockOpen className="h-8 w-8" />}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  status.isLocked
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    status.isLocked ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                {status.isLocked ? 'Fechadura Trancada' : 'Fechadura Destrancada'}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  status.online
                    ? 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25'
                    : 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/25'
                }`}
              >
                {status.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {status.online ? `Online (${status.signalStrength} dBm)` : 'Offline'}
              </span>
            </div>

            <h2 className="mt-2 text-2xl font-bold text-white">{status.deviceName}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Virtual ID: <span className="font-mono text-slate-300">{status.deviceId}</span> · MAC:{' '}
              <span className="font-mono text-slate-300">{status.mac}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={isBusy}
            onClick={onUnlock}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LockOpen className="h-4 w-4" />
            {pendingAction === 'unlock' ? 'Destrancando...' : 'Destrancar'}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={onLock}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            {pendingAction === 'lock' ? 'Trancando...' : 'Trancar'}
          </button>
        </div>
      </div>
    </section>
  );
}
