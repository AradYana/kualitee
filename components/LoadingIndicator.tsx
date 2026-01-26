'use client';

import { useEffect, useState } from 'react';

interface LoadingIndicatorProps {
  message: string;
}

export default function LoadingIndicator({ message }: LoadingIndicatorProps) {
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 2));
    }, 100);

    return () => clearInterval(progressInterval);
  }, []);

  return (
    <div className="terminal-window overflow-hidden">
      <div className="title-bar">
        <span>⏳ Processing</span>
        <div className="title-bar-controls">
          <button className="title-bar-btn">─</button>
          <button className="title-bar-btn">□</button>
          <button className="title-bar-btn">×</button>
        </div>
      </div>

      <div className="p-8 text-center" style={{ backgroundColor: '#e6e0d4' }}>
        <div className="text-lg text-text-primary mb-4">
          {message}{dots}
        </div>
        
        {/* Progress bar */}
        <div className="w-full max-w-md mx-auto h-6 border-2 border-border-gray rounded-input overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <div 
            className="h-full transition-all duration-100"
            style={{ 
              width: `${progress}%`,
              backgroundColor: '#084999'
            }}
          />
        </div>

        <div className="mt-4 text-sm text-text-secondary">
          Progress: {progress}%
        </div>

        <div className="mt-6 text-xs text-text-secondary">
          Please wait while we process your data...
        </div>
      </div>
    </div>
  );
}
