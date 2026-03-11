import { Minus, Square, Copy, X } from 'lucide-react';
import {
  Quit,
  WindowMinimise,
  WindowToggleMaximise,
  WindowIsMaximised,
  Environment,
} from '../../wailsjs/runtime/runtime';
import { useEffect, useState } from 'react';

export default function WindowChrome() {
  const [isMaximised, setIsMaximised] = useState(false);
  const [isMac, setIsMac] = useState(false);

  async function syncWindowState() {
    try {
      setIsMaximised(await WindowIsMaximised());
    } catch {
      setIsMaximised(false);
    }
  }

  function toggleMaximise() {
    WindowToggleMaximise();
    window.setTimeout(() => void syncWindowState(), 120);
  }

  useEffect(() => {
    void syncWindowState();
    Environment().then((env) => setIsMac(env.platform === 'darwin')).catch(() => {});
    const handleResize = () => void syncWindowState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMac) {
    return null;
  }

  // Windows / Linux: custom frameless buttons on the right
  return (
    <header className="flex items-center justify-between select-none no-drag drag-zone px-4 py-2.5 bg-white/60 backdrop-blur-md border-b border-slate-200/50 z-50 shrink-0">
      <div
        className="flex items-center gap-2 flex-1 drag-zone h-full min-w-0"
        onDoubleClick={toggleMaximise}
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
          🦞
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold text-slate-800 truncate tracking-wide">
            大龙虾
          </span>
          <span className="text-[10px] text-slate-500 truncate -mt-[1px]">
            ClawPro
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 no-drag ml-2">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 transition-colors"
          onClick={() => WindowMinimise()}
          title="最小化"
        >
          <Minus size={15} />
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 transition-colors"
          onClick={toggleMaximise}
          title={isMaximised ? '还原' : '最大化'}
        >
          {isMaximised ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-rose-500 hover:text-white transition-colors"
          onClick={() => Quit()}
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
