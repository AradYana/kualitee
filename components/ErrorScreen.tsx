'use client';

import { ValidationError } from '@/lib/types';

interface ErrorScreenProps {
  error: ValidationError;
  onDismiss: () => void;
}

export default function ErrorScreen({ error, onDismiss }: ErrorScreenProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">System Error</span>
          </div>
          <button 
            onClick={onDismiss}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          {/* Icon and Title */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">
              {error.type === 'MISSING_MSID_COLUMN' ? 'MSID NOT FOUND' : 'DATA INTEGRITY ERROR'}
            </h2>
            <p className="text-slate-600">{error.message}</p>
          </div>
          
          {/* Details */}
          {error.details && error.details.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-500 mb-2">Details:</p>
              <div className="space-y-1">
                {error.details.map((detail, index) => (
                  <div key={index} className="text-sm text-slate-600 font-mono flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action */}
          <button onClick={onDismiss} className="btn-primary w-full">
            Dismiss & Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
