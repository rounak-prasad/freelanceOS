import React from 'react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useData();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
          error: <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />,
          info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
        };
        const bgColors = {
          success: 'border-green-500/20 bg-green-500/5',
          error: 'border-red-500/20 bg-red-500/5',
          info: 'border-blue-500/20 bg-blue-500/5',
        };
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl animate-slide-in-right ${bgColors[toast.type] || bgColors.success}`}
          >
            {icons[toast.type] || icons.success}
            <p className="text-sm text-dark-50 flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-dark-300 hover:text-dark-50 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
