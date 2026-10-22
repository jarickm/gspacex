import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-xl animate-in slide-in-from-bottom-2">
      <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
      <span>Offline Mode — Cached Google Workspace data is being used.</span>
    </div>
  );
};
