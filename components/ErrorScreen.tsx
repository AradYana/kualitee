'use client';

import { ValidationError } from '@/lib/types';

interface ErrorScreenProps {
  error: ValidationError;
  onDismiss: () => void;
}

export default function ErrorScreen({ error, onDismiss }: ErrorScreenProps) {
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="error-screen p-8 max-w-2xl w-full">
        <div className="text-center">
          <pre className="text-error-red text-xs sm:text-sm mb-4 glitch">
{`
 ███████╗██████╗ ██████╗  ██████╗ ██████╗ 
 ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
 █████╗  ██████╔╝██████╔╝██║   ██║██████╔╝
 ██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██╗
 ███████╗██║  ██║██║  ██║╚██████╔╝██║  ██║
 ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
`}
          </pre>
          
          <div className="text-error-red text-xl font-bold mb-4 glitch">
            ▓▓▓ SYSTEM ERROR ▓▓▓
          </div>
          
          <div className="border border-error-red p-4 mb-4">
            <div className="text-error-red font-bold mb-2">
              {error.type === 'MISSING_MSID_COLUMN' && '>> MSID NOT FOUND <<'}
              {error.type === 'MSID_PARITY_ERROR' && '>> MSID PARITY MISMATCH <<'}
              {error.type === 'DATA_MISMATCH' && '>> DATA INTEGRITY ERROR <<'}
            </div>
            <div className="text-error-red/80">
              {error.message}
            </div>
          </div>

          {error.details && error.details.length > 0 && (
            <div className="border border-error-red/50 p-4 mb-4 max-h-48 overflow-y-auto text-left">
              <div className="text-error-red/60 text-sm mb-2">
                AFFECTED RECORDS:
              </div>
              {error.details.map((detail, index) => (
                <div key={index} className="text-error-red/80 text-sm">
                  • {detail}
                </div>
              ))}
            </div>
          )}

          <div className="text-error-red/60 text-sm mb-6">
            FATAL: Process halted. Data integrity compromised.
          </div>

          <button
            onClick={onDismiss}
            className="bg-error-red/20 border border-error-red text-error-red px-6 py-2 hover:bg-error-red/30 transition-colors"
          >
            [ ACKNOWLEDGE ERROR ]
          </button>
        </div>
      </div>
    </div>
  );
}
