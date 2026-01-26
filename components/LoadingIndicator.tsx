'use client';

import { useEffect, useState } from 'react';

interface LoadingIndicatorProps {
  message: string;
  showBar?: boolean;
}

export default function LoadingIndicator({ message, showBar = true }: LoadingIndicatorProps) {
  const [dots, setDots] = useState('');
  const [barProgress, setBarProgress] = useState(0);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    if (showBar) {
      const barInterval = setInterval(() => {
        setBarProgress((prev) => (prev >= 100 ? 0 : prev + 2));
      }, 100);

      return () => clearInterval(barInterval);
    }
  }, [showBar]);

  const barWidth = 40;
  const filledWidth = Math.floor((barProgress / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  return (
    <div className="text-center py-8">
      <div className="text-matrix-green animate-pulse text-lg mb-4">
        {message}{dots}
      </div>
      
      {showBar && (
        <div className="inline-block text-left font-mono">
          <div className="text-matrix-green/60 text-sm mb-1">
            PROGRESS: {barProgress}%
          </div>
          <div className="text-matrix-green">
            [{('█').repeat(filledWidth)}{('░').repeat(emptyWidth)}]
          </div>
        </div>
      )}

      <div className="mt-4 text-matrix-green/40 text-xs">
        <span className="animate-pulse">◄</span>
        {' PLEASE WAIT '}
        <span className="animate-pulse">►</span>
      </div>
    </div>
  );
}
