import React, { useEffect, useRef, useState } from 'react';
import { retroAudio } from '../audio/retroAudio';
import { VirtualButtonName } from '../engine/inputManager';

interface MobileControlsProps {
  mode: 'match' | 'penalty';
  players?: 1 | 2;
  onStickChange: (dx: number, dy: number, playerNum?: 1 | 2) => void;
  onButtonChange: (btn: VirtualButtonName, pressed: boolean, playerNum?: 1 | 2) => void;
}

interface ArcadeStickProps {
  playerNum: 1 | 2;
  compact: boolean;
  onChange: (dx: number, dy: number, playerNum: 1 | 2) => void;
}

const ArcadeStick: React.FC<ArcadeStickProps> = ({ playerNum, compact, onChange }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const radius = compact ? 24 : 34;

  // Garante liberação limpa do manche se o componente desmontar durante toque ativo
  useEffect(() => {
    return () => {
      activePointerId.current = null;
      onChangeRef.current(0, 0, playerNum);
    };
  }, [playerNum]);

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }

    setKnob({ x: dx, y: dy });
    const normX = Math.abs(dx / radius) < 0.12 ? 0 : dx / radius;
    const normY = Math.abs(dy / radius) < 0.12 ? 0 : dy / radius;
    onChangeRef.current(normX, normY, playerNum);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onChangeRef.current(0, 0, playerNum);
  };

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    retroAudio.unlock();
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Alguns navegadores mobile já capturam implicitamente
    }
    updateFromClient(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateFromClient(e.clientX, e.clientY);
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    resetStick();
  };

  const handleLostCapture = () => {
    if (activePointerId.current !== null) {
      resetStick();
    }
  };

  const isP1 = playerNum === 1;
  const ballGradient = isP1
    ? 'from-red-400 via-red-600 to-rose-900 border-amber-200/90'
    : 'from-sky-300 via-blue-600 to-indigo-950 border-cyan-100/90';
  const rimColor = isP1 ? 'border-yellow-400/80' : 'border-sky-400/80';

  return (
    <div
      ref={baseRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleLostCapture}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto relative rounded-full bg-gradient-to-b from-[#111b33]/85 to-[#050a16]/90 border-2 ${rimColor} shadow-[inset_0_0_16px_rgba(0,0,0,0.85),0_4px_10px_rgba(0,0,0,0.55)] flex items-center justify-center cursor-pointer backdrop-blur-[1px] ${
        compact ? 'w-[76px] h-[76px] sm:w-[86px] sm:h-[86px]' : 'w-[98px] h-[98px] sm:w-[110px] sm:h-[110px]'
      }`}
      style={{ touchAction: 'none' }}
      aria-label={`Manche Fliperama P${playerNum}`}
    >
      {/* Arruela / Gate octogonal de gabinete arcade */}
      <div
        className={`pointer-events-none rounded-full bg-[#090e1c]/90 border border-slate-600/60 shadow-inner ${
          compact ? 'w-10 h-10' : 'w-12 h-12'
        }`}
      />
      <span className="pointer-events-none absolute top-1 text-[7px] font-bold text-slate-400/75">▲</span>
      <span className="pointer-events-none absolute bottom-1 text-[7px] font-bold text-slate-400/75">▼</span>
      <span className="pointer-events-none absolute left-1.5 text-[7px] font-bold text-slate-400/75">◀</span>
      <span className="pointer-events-none absolute right-1.5 text-[7px] font-bold text-slate-400/75">▶</span>

      {/* Haste metálica do manche */}
      <div
        className="pointer-events-none absolute w-2 h-2 rounded-full bg-slate-300/70"
        style={{ transform: `translate(${knob.x * 0.45}px, ${knob.y * 0.45}px)` }}
      />

      {/* Bola brilhante de Fliperama (Ball-Top) */}
      <div
        className={`pointer-events-none absolute rounded-full bg-gradient-to-br ${ballGradient} border-2 shadow-[0_5px_12px_rgba(0,0,0,0.75)] flex items-center justify-center ${
          compact ? 'w-8 h-8' : 'w-11 h-11'
        }`}
        style={{
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      >
        {/* Reflexo especular acrílico da bola */}
        <div
          className={`rounded-full bg-white/55 -translate-x-1 -translate-y-1 ${
            compact ? 'w-2 h-1.5' : 'w-3 h-2'
          }`}
        />
      </div>
    </div>
  );
};

interface ArcadeButtonProps {
  label: string;
  pressed: boolean;
  compact: boolean;
  variant: 'red' | 'green' | 'blue' | 'teal' | 'amber';
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onLostPointerCapture: () => void;
    onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  };
}

const VARIANT_STYLES: Record<
  ArcadeButtonProps['variant'],
  { idle: string; active: string; inner: string }
> = {
  red: {
    idle: 'bg-gradient-to-b from-red-500 to-red-700 border-red-200/90 text-white shadow-[0_4px_0_#450a0a,0_5px_10px_rgba(0,0,0,0.6)]',
    active: 'bg-red-400 border-white text-slate-950 translate-y-[2px] shadow-[0_1px_0_#450a0a]',
    inner: 'border-red-300/50',
  },
  green: {
    idle: 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-200/90 text-white shadow-[0_4px_0_#064e3b,0_5px_10px_rgba(0,0,0,0.6)]',
    active: 'bg-emerald-300 border-white text-slate-950 translate-y-[2px] shadow-[0_1px_0_#064e3b]',
    inner: 'border-emerald-200/50',
  },
  blue: {
    idle: 'bg-gradient-to-b from-sky-500 to-blue-700 border-sky-200/90 text-white shadow-[0_4px_0_#1e3a8a,0_5px_10px_rgba(0,0,0,0.6)]',
    active: 'bg-sky-300 border-white text-slate-950 translate-y-[2px] shadow-[0_1px_0_#1e3a8a]',
    inner: 'border-sky-200/50',
  },
  teal: {
    idle: 'bg-gradient-to-b from-teal-500 to-teal-700 border-teal-200/90 text-white shadow-[0_4px_0_#134e4a,0_5px_10px_rgba(0,0,0,0.6)]',
    active: 'bg-teal-300 border-white text-slate-950 translate-y-[2px] shadow-[0_1px_0_#134e4a]',
    inner: 'border-teal-200/50',
  },
  amber: {
    idle: 'bg-gradient-to-b from-amber-400 to-amber-600 border-yellow-100/90 text-slate-950 shadow-[0_4px_0_#78350f,0_5px_10px_rgba(0,0,0,0.6)]',
    active: 'bg-yellow-200 border-white text-slate-950 translate-y-[2px] shadow-[0_1px_0_#78350f]',
    inner: 'border-yellow-100/60',
  },
};

const ArcadeButton: React.FC<ArcadeButtonProps> = ({
  label,
  pressed,
  compact,
  variant,
  handlers,
}) => {
  const style = VARIANT_STYLES[variant];
  return (
    <button
      type="button"
      tabIndex={-1}
      {...handlers}
      style={{ touchAction: 'none' }}
      className={`relative rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer select-none ${
        compact ? 'w-[42px] h-[42px] sm:w-[46px] sm:h-[46px]' : 'w-[52px] h-[52px] sm:w-[58px] sm:h-[58px]'
      } ${pressed ? style.active : style.idle}`}
    >
      {/* Centro côncavo clássico de botão de fliperama */}
      <span
        className={`pointer-events-none absolute inset-[4px] rounded-full border ${style.inner} shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)]`}
      />
      <span
        className={`relative font-pixel leading-none tracking-tighter ${
          compact ? 'text-[6px] sm:text-[6.5px]' : 'text-[7px] sm:text-[7.5px]'
        }`}
      >
        {label}
      </span>
    </button>
  );
};

interface PlayerButtonDeckProps {
  playerNum: 1 | 2;
  mode: 'match' | 'penalty';
  compact: boolean;
  onButtonChange: (btn: VirtualButtonName, pressed: boolean, playerNum: 1 | 2) => void;
}

const ALL_VIRTUAL_BTNS: VirtualButtonName[] = ['pass', 'shoot', 'lob', 'sprint', 'steal'];

const PlayerButtonDeck: React.FC<PlayerButtonDeckProps> = ({
  playerNum,
  mode,
  compact,
  onButtonChange,
}) => {
  const onButtonChangeRef = useRef(onButtonChange);
  onButtonChangeRef.current = onButtonChange;
  // Rastreia pointerId individual por botão para multi-touch sem travamentos
  const activePointersRef = useRef<Partial<Record<VirtualButtonName, number>>>({});

  const [pressedBtns, setPressedBtns] = useState<Record<VirtualButtonName, boolean>>({
    pass: false,
    shoot: false,
    lob: false,
    sprint: false,
    steal: false,
  });

  // Solta todos os botões virtualmente se o deck desmontar (ex: pausa ou fim de partida)
  useEffect(() => {
    return () => {
      activePointersRef.current = {};
      for (const btn of ALL_VIRTUAL_BTNS) {
        onButtonChangeRef.current(btn, false, playerNum);
      }
    };
  }, [playerNum]);

  const releaseBtn = (btn: VirtualButtonName, pointerId?: number) => {
    const activeId = activePointersRef.current[btn];
    if (pointerId !== undefined && activeId !== undefined && activeId !== pointerId) {
      return;
    }
    delete activePointersRef.current[btn];
    setPressedBtns((prev) => (prev[btn] ? { ...prev, [btn]: false } : prev));
    onButtonChangeRef.current(btn, false, playerNum);
  };

  const bindBtn = (btn: VirtualButtonName) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      retroAudio.unlock();
      activePointersRef.current[btn] = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignora caso pointer já esteja capturado
      }
      setPressedBtns((prev) => ({ ...prev, [btn]: true }));
      onButtonChangeRef.current(btn, true, playerNum);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      releaseBtn(btn, e.pointerId);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      releaseBtn(btn, e.pointerId);
    },
    onLostPointerCapture: () => {
      if (activePointersRef.current[btn] !== undefined) {
        releaseBtn(btn);
      }
    },
    onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
    },
  });

  if (mode === 'penalty') {
    return (
      <div className="pointer-events-auto flex items-center gap-2">
        <ArcadeButton
          label="DEF"
          variant="blue"
          compact={compact}
          pressed={pressedBtns.pass}
          handlers={bindBtn('pass')}
        />
        <ArcadeButton
          label="CHUTE"
          variant="red"
          compact={compact}
          pressed={pressedBtns.shoot}
          handlers={bindBtn('shoot')}
        />
      </div>
    );
  }

  return (
    <div className={`pointer-events-auto flex flex-col ${compact ? 'gap-1' : 'gap-1.5'} items-center`}>
      {/* Fileira Superior Arcade: CORRER, TOMAR, LANÇAR */}
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
        <ArcadeButton
          label="CORR"
          variant="amber"
          compact={compact}
          pressed={pressedBtns.sprint}
          handlers={bindBtn('sprint')}
        />
        <ArcadeButton
          label="TOM/DRB"
          variant="teal"
          compact={compact}
          pressed={pressedBtns.steal}
          handlers={bindBtn('steal')}
        />
        <ArcadeButton
          label="LANÇ"
          variant="blue"
          compact={compact}
          pressed={pressedBtns.lob}
          handlers={bindBtn('lob')}
        />
      </div>

      {/* Fileira Inferior Arcade: PASSE e CHUTE */}
      <div className={`flex items-center ${compact ? 'gap-1.5 -mt-0.5' : 'gap-2.5'}`}>
        <ArcadeButton
          label="PASSE"
          variant="green"
          compact={compact}
          pressed={pressedBtns.pass}
          handlers={bindBtn('pass')}
        />
        <ArcadeButton
          label="CHUTE"
          variant="red"
          compact={compact}
          pressed={pressedBtns.shoot}
          handlers={bindBtn('shoot')}
        />
      </div>
    </div>
  );
};

export const MobileControls: React.FC<MobileControlsProps> = ({
  mode,
  players = 1,
  onStickChange,
  onButtonChange,
}) => {
  // MODO 2P FLIPERAMA: Dois painéis arcade independentes (P1 à esquerda, P2 à direita)
  if (players === 2) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-1.5 sm:bottom-2.5 z-20 px-1.5 sm:px-3 flex items-end justify-between gap-2 select-none"
        style={{ touchAction: 'none' }}
      >
        {/* PAINEL FLIPERAMA P1 (ESQUERDA) */}
        <div className="pointer-events-auto bg-[#081226]/78 border-2 border-yellow-400/75 px-2 py-1.5 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.65)] backdrop-blur-[2px] flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <span className="font-pixel text-[7px] text-yellow-300 tracking-wider">P1 ARCADE</span>
            <ArcadeStick playerNum={1} compact={true} onChange={onStickChange} />
          </div>
          <PlayerButtonDeck
            playerNum={1}
            mode={mode}
            compact={true}
            onButtonChange={onButtonChange}
          />
        </div>

        {/* PAINEL FLIPERAMA P2 (DIREITA) */}
        <div className="pointer-events-auto bg-[#081226]/78 border-2 border-sky-400/75 px-2 py-1.5 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.65)] backdrop-blur-[2px] flex items-center gap-2">
          <PlayerButtonDeck
            playerNum={2}
            mode={mode}
            compact={true}
            onButtonChange={onButtonChange}
          />
          <div className="flex flex-col items-center gap-1">
            <span className="font-pixel text-[7px] text-sky-300 tracking-wider">P2 ARCADE</span>
            <ArcadeStick playerNum={2} compact={true} onChange={onStickChange} />
          </div>
        </div>
      </div>
    );
  }

  // MODO 1P FLIPERAMA: Manche clássico à esquerda + 5 botões côncavos à direita
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 sm:bottom-3 z-20 px-2.5 sm:px-5 flex items-end justify-between select-none"
      style={{ touchAction: 'none' }}
    >
      <ArcadeStick playerNum={1} compact={false} onChange={onStickChange} />
      <PlayerButtonDeck
        playerNum={1}
        mode={mode}
        compact={false}
        onButtonChange={onButtonChange}
      />
    </div>
  );
};
