'use client';

import { ValidationError } from '@/lib/types';

interface ErrorScreenProps {
  error: ValidationError;
  onDismiss: () => void;
}

export default function ErrorScreen({ error, onDismiss }: ErrorScreenProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="terminal-window max-w-lg w-full mx-4 overflow-hidden">
        <div className="title-bar" style={{ backgroundColor: '#CC0000' }}>
          <span>⚠️ System Error</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn" onClick={onDismiss}>×</button>
          </div>
        </div>
        
        <div className="p-6" style={{ backgroundColor: '#e6e0d4' }}>
          <div className="text-center mb-4">
            <span className="text-6xl">⚠️</span>
          </div>
          
          <h2 className="text-xl font-bold text-center mb-4" style={{ color: '#CC0000' }}>
            {error.type === 'MISSING_MSID_COLUMN' ? 'MSID NOT FOUND' : 'DATA INTEGRITY ERROR'}
          </h2>
          
          <div className="terminal-output p-4 mb-4">
            <p className="text-sm text-text-primary mb-2">
              {error.message}
            </p>
            
            {error.details && error.details.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                <p className="text-xs text-text-secondary mb-2">Details:</p>
                {error.details.map((detail, index) => (
                  <div key={index} className="text-xs text-text-secondary font-mono">
                    • {detail}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-center">
            <button onClick={onDismiss} className="send-btn">
              Dismiss & Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
