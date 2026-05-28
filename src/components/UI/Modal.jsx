import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} bg-dark-800 border border-dark-600/50 rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600/50">
          <h2 className="text-lg font-semibold text-dark-50">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto custom-scroll flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
