'use client';

export default function ASCIIHeader() {
  return (
    <div className="text-center py-4 text-glow">
      <pre className="text-matrix-green text-xs sm:text-sm md:text-base inline-block text-left">
{`  _  ___   _   _   _      ___ _____ _____ _____ 
 | |/ / | | | /_\\ | |    |_ _|_   _| ____| ____|
 | ' /| | | |/ _ \\| |     | |  | | |  _| |  _|  
 | . \\| |_| / ___ \\ |___  | |  | | | |___| |___ 
 |_|\\_\\\\___/_/   \\_\\_____|___| |_| |_____|_____|`}
      </pre>
      <div className="text-warning-amber mt-2 animate-pulse">
        {`>> AUTOMATED LLM QA SYSTEM V1.0 <<`}
      </div>
      <div className="text-matrix-green/60 text-xs mt-1">
        ═══════════════════════════════════════════════════
      </div>
    </div>
  );
}
