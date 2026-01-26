'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

interface TerminalProps {
  onCommand: (command: string) => void;
}

export default function Terminal({ onCommand }: TerminalProps) {
  const [input, setInput] = useState('');
  const { terminalHistory, addTerminalEntry, systemLogs } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [terminalHistory, systemLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      addTerminalEntry(`C:\\USER\\KUALITEE> ${input}`);
      onCommand(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // Auto-complete suggestions
      const suggestions = [
        'help',
        'status',
        'drill down on failures',
        're-evaluate',
        're-configure',
        'clear',
        'export',
      ];
      const match = suggestions.find((s) =>
        s.toLowerCase().startsWith(input.toLowerCase())
      );
      if (match) {
        setInput(match);
      }
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'ERROR':
        return 'text-error-red';
      case 'WARNING':
        return 'text-warning-amber';
      case 'SUCCESS':
        return 'text-matrix-green';
      default:
        return 'text-matrix-green/70';
    }
  };

  return (
    <div className="border border-matrix-green bg-black/50">
      {/* Terminal Header */}
      <div className="border-b border-matrix-green px-3 py-1 flex justify-between items-center">
        <span className="text-matrix-green/60 text-sm">
          ┌─ KUALITEE TERMINAL v1.0 ─┐
        </span>
        <span className="text-matrix-green/40 text-xs">
          Type &quot;help&quot; for commands
        </span>
      </div>

      {/* Terminal Output */}
      <div
        ref={containerRef}
        className="h-48 overflow-y-auto p-3 font-mono text-sm"
      >
        {/* Boot message */}
        <div className="text-matrix-green/60 mb-2">
          KUALITEE COMMAND INTERFACE INITIALIZED
          <br />
          SESSION STARTED: {new Date().toISOString()}
          <br />
          ─────────────────────────────────────────
        </div>

        {/* System logs */}
        {systemLogs.map((log, index) => (
          <div key={`log-${index}`} className={`${getLogColor(log.type)} text-xs`}>
            [{log.timestamp.split('T')[1]?.slice(0, 8)}] [{log.type}] {log.message}
          </div>
        ))}

        {/* Terminal history */}
        {terminalHistory.map((entry, index) => (
          <div key={`history-${index}`} className="text-matrix-green">
            {entry}
          </div>
        ))}
      </div>

      {/* Terminal Input */}
      <form onSubmit={handleSubmit} className="border-t border-matrix-green p-2">
        <div className="flex items-center">
          <span className="text-matrix-green mr-2">C:\USER\KUALITEE&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-matrix-green cursor-blink"
            placeholder=""
            autoFocus
          />
        </div>
      </form>
    </div>
  );
}
