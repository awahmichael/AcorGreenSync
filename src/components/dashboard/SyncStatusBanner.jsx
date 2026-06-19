import { WifiOff, RefreshCw, X } from 'lucide-react';

export default function SyncStatusBanner({ queueCount, isOnline, syncing, onClear, onRetry }) {
  if (isOnline && queueCount === 0 && !syncing) return null;

  if (!isOnline) {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0 sync-pulse" />
        <div className="text-sm flex-1">
          <span className="font-semibold text-amber-800">Offline Mode</span>
          <span className="text-amber-700 ml-2">— Transactions saved locally, will sync when reconnected.</span>
        </div>
        {queueCount > 0 && (
          <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            {queueCount} queued
          </span>
        )}
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
        <div className="text-sm flex-1">
          <span className="font-semibold text-blue-800">Syncing...</span>
          <span className="text-blue-700 ml-2">Uploading {queueCount} offline transaction{queueCount !== 1 ? 's' : ''} to the server.</span>
        </div>
      </div>
    );
  }

  // Online but queue not empty and not syncing — stuck state
  if (isOnline && queueCount > 0) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div className="text-sm flex-1">
          <span className="font-semibold text-blue-800">{queueCount} transaction{queueCount !== 1 ? 's' : ''} pending sync.</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-blue-700 underline whitespace-nowrap mr-2"
          >
            Retry
          </button>
        )}
        {onClear && (
          <button
            onClick={onClear}
            title="Clear queue (transactions already saved online)"
            className="text-blue-400 hover:text-blue-700 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return null;
}