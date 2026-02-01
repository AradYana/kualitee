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
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Processing</h2>
            <p className="text-sm text-white/70">Evaluating your data</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-md mx-auto text-center">
          {/* Status Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          {/* Message */}
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            {message}{dots}
          </h3>
          
          {/* Progress bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full rounded-full transition-all duration-100 bg-gradient-to-r from-purple-600 to-indigo-600"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Progress</span>
            <span className="font-semibold text-purple-600">{progress}%</span>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Please wait while we process your data. This may take a few moments depending on the size of your dataset.
          </p>
        </div>
      </div>
    </div>
  );
}
