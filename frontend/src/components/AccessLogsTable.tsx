import { useMemo, useState } from 'react';
import { History, Lock, LockOpen, RefreshCw } from 'lucide-react';
import { LockAction, LockLogEntry } from '../types/lock';

interface AccessLogsTableProps {
  logs: LockLogEntry[];
  timezone: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

type ActionFilter = 'all' | LockAction;

export function AccessLogsTable({
  logs,
  timezone,
  isRefreshing,
  onRefresh,
}: AccessLogsTableProps) {
  const [filter, setFilter] = useState<ActionFilter>('all');

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((entry) => entry.action === filter);
  }, [logs, filter]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-sky-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Histórico de Acessos</h3>
            <p className="text-xs text-slate-400">
              Registros exibidos no fuso horário <span className="font-mono">{timezone}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'unlock', label: 'Destrancamentos' },
                { id: 'lock', label: 'Trancamentos' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  filter === tab.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          Nenhum evento encontrado para o filtro selecionado.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4 font-medium">Ação</th>
                <th className="pb-3 pr-4 font-medium">Método</th>
                <th className="pb-3 pr-4 font-medium">Origem / Usuário</th>
                <th className="pb-3 pr-4 font-medium">Detalhes</th>
                <th className="pb-3 text-right font-medium">Data e Hora ({timezone})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredLogs.map((entry) => {
                const isLock = entry.action === 'lock';
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 pr-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          isLock
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {isLock ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                        {isLock ? 'Trancada' : 'Destrancada'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 whitespace-nowrap font-medium text-slate-200">
                      {entry.methodLabel}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-300">{entry.actor}</td>
                    <td className="py-3.5 pr-4 text-xs text-slate-400">
                      {entry.details || '—'}
                    </td>
                    <td className="py-3.5 text-right font-mono text-xs text-slate-300 whitespace-nowrap">
                      {entry.localTime}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
