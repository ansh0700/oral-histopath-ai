import React, { useState, useEffect } from 'react';
import { FileText, Download, X, History, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface ResearchLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResearchLogViewer: React.FC<ResearchLogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed fetching research logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const exportAllLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oral_histopath_research_logs_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2 text-medical-400">
            <History className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-100">
              Reproducible Research & Experiment Audit Logs
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportAllLogs}
              disabled={logs.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-medical-600 hover:bg-medical-500 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No experiment records logged yet.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.experiment_id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-bold text-medical-400">{log.action}</span>
                    <span className="text-[11px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                    <div>Image: {log.image_id}</div>
                    {log.model && <div>Model: {log.model}</div>}
                    {log.inference_time_ms && <div>Latency: {log.inference_time_ms} ms</div>}
                    {log.feature && <div>Feature: {log.feature}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
