import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Gamepad2,
  LogOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { retroAudio } from '../audio/retroAudio';
import { getClubById } from '../data/clubs';
import { InputManager, VirtualButtonName } from '../engine/inputManager';
import { PenaltyEngine, PenaltyResult } from '../engine/penaltyEngine';
import { CANVAS_H, CANVAS_W, renderPenaltyFrame } from '../engine/pixelRenderer';
import {
  Difficulty,
  PenaltyAttemptResult,
  PenaltyHUDState,
  PlayerControlMode,
} from '../types/game';
import { MobileControls } from './MobileControls';
import { PixelCrest } from './PixelCrest';

interface PenaltyArenaProps {
  homeClubId: string;
  awayClubId: string;
  controlMode: PlayerControlMode;
  difficulty: Difficulty;
  titleLabel?: string;
  muted: boolean;
  onToggleMute: () => void;
  onComplete: (res: PenaltyResult) => void;
  onExit: () => void;
}

export const PenaltyArena: React.FC<PenaltyArenaProps> = ({
  homeClubId,
  awayClubId,
  controlMode,
  difficulty,
  titleLabel = 'DISPUTA DE PÊNALTIS',
  muted,
  onToggleMute,
  onComplete,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [finalResult, setFinalResult] = useState<PenaltyResult | null>(null);
  const [hud, setHud] = useState<PenaltyHUDState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const [showTouchPad, setShowTouchPad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024;
  });

  const homeClub = getClubById(homeClubId);
  const awayClub = getClubById(awayClubId);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!showTouchPad || finalResult) {
      inputRef.current?.resetVirtualInputs();
    }
  }, [showTouchPad, finalResult]);

  useEffect(() => {
    retroAudio.stopMenuMusic();
    retroAudio.unlock();
    retroAudio.startStadiumAtmosphere();
    setFinalResult(null);

    const engine = new PenaltyEngine(
      homeClubId,
      awayClubId,
      controlMode,
      difficulty,
      (res) => setFinalResult(res)
    );
    const input = new InputManager();
    input.attach();
    inputRef.current = input;

    let rafId = 0;
    let lastTime = performance.now();
    let acc = 0;
    const FIXED_DT = 1 / 60;
    let tick = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      acc += dt;

      const isSinglePlayer = controlMode === '1P_CPU';
      while (acc >= FIXED_DT) {
        const p1 = input.pollPlayer(1, isSinglePlayer);
        const p2 = input.pollPlayer(2, false);
        engine.step(FIXED_DT, p1, p2);
        acc -= FIXED_DT;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) renderPenaltyFrame(ctx, engine);
      }

      tick++;
      if (tick % 3 === 0) {
        setHud(engine.getHUDState());
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      retroAudio.stopStadiumAtmosphere();
      retroAudio.stopNarration();
      input.detach();
    };
  }, [homeClubId, awayClubId, controlMode, difficulty, restartKey]);

  const handleToggleFullscreen = async () => {
    retroAudio.playCursor();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback silencioso caso o iframe restrinja API nativa
    }
  };

  const renderPips = (history: PenaltyAttemptResult[]) => {
    const total = Math.max(5, history.length);
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: total }, (_, idx) => {
          const item = history[idx];
          const bg =
            item === 'GOAL'
              ? 'bg-emerald-400 border-emerald-200'
              : item === 'SAVE' || item === 'MISS'
                ? 'bg-red-500 border-red-200'
                : 'bg-[#09152e] border-slate-500';
          return <span key={idx} className={`w-2.5 h-2.5 border inline-block ${bg}`} />;
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#040914] overflow-hidden select-none flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-full object-contain block pixelated"
      />

      {/* Placar de Pênaltis Compacto no Topo */}
      <div className="fixed top-1.5 inset-x-2 sm:inset-x-3 flex items-start justify-between gap-2 z-10">
        <div className="bg-[#09152e]/88 border border-[#4d79cc] px-2 py-1.5 shadow-[2px_2px_0_#040914]">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-pixel text-[8px] text-yellow-300">{titleLabel}</span>
            <span className="font-pixel text-[8px] text-emerald-400">
              {hud?.isSuddenDeath ? 'ALT' : `${hud?.roundNumber ?? 1}/5`}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <PixelCrest club={homeClub} size={14} />
                <span className="font-pixel text-[9px] text-white w-8">{homeClub.shortName}</span>
              </div>
              {renderPips(hud?.homeHistory ?? [])}
              <span className="font-pixel text-[10px] text-yellow-400 w-4 text-right tabular-nums">
                {hud?.homeScore ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <PixelCrest club={awayClub} size={14} />
                <span className="font-pixel text-[9px] text-white w-8">{awayClub.shortName}</span>
              </div>
              {renderPips(hud?.awayHistory ?? [])}
              <span className="font-pixel text-[10px] text-yellow-400 w-4 text-right tabular-nums">
                {hud?.awayScore ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              retroAudio.playCursor();
              setShowTouchPad((v) => !v);
            }}
            className={`border px-1.5 py-1 cursor-pointer flex items-center gap-1 text-[9px] font-bold ${
              showTouchPad
                ? 'bg-yellow-400 border-white text-slate-950'
                : 'bg-[#09152e]/88 hover:bg-[#173063] border-[#4d79cc] text-slate-100'
            }`}
            title={showTouchPad ? 'Ocultar controle Fliperama' : 'Mostrar controle Fliperama'}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {controlMode === '1P_2P' ? '2P Arcade' : 'Fliperama'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleFullscreen();
            }}
            className="bg-[#09152e]/88 hover:bg-[#173063] border border-[#4d79cc] p-1 text-slate-100 cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-yellow-300" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-200" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="bg-[#09152e]/88 hover:bg-[#173063] border border-[#4d79cc] p-1 text-slate-100 cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              onExit();
            }}
            className="bg-[#09152e]/88 hover:bg-[#4a1626] border border-red-400/80 px-2 py-1 text-[10px] font-bold text-red-200 flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Barra Compacta de Instrução / Feedback de Cobrança */}
      {hud && !finalResult && (
        <div className="pointer-events-none fixed bottom-2.5 inset-x-4 flex justify-center z-10">
          <div className="bg-[#09152e]/88 border border-yellow-400 px-3 py-1.5 text-center shadow-[3px_3px_0_#040914] max-w-md">
            <p className="font-pixel text-[9px] sm:text-[10px] text-yellow-300">{hud.message}</p>
            <p className="text-[10px] text-slate-200 mt-0.5">{hud.subMessage}</p>
          </div>
        </div>
      )}

      {/* Controles Fliperama (1P ou 2P simultâneo) */}
      {showTouchPad && !finalResult && (
        <MobileControls
          mode="penalty"
          players={controlMode === '1P_2P' ? 2 : 1}
          onStickChange={(dx, dy, pNum) => inputRef.current?.setVirtualStick(dx, dy, pNum)}
          onButtonChange={(btn: VirtualButtonName, pressed: boolean, pNum) =>
            inputRef.current?.setVirtualButton(btn, pressed, pNum)
          }
        />
      )}

      {/* Modal Final da Disputa de Pênaltis */}
      {finalResult && (
        <div className="fixed inset-0 bg-[#040914]/82 z-30 flex items-center justify-center p-4">
          <div className="retro-box-gold p-5 w-full max-w-sm text-center">
            <p className="font-pixel text-[9px] text-emerald-400 mb-2">FIM DOS PÊNALTIS</p>
            <div className="flex items-center justify-center gap-5 my-3">
              <div className="flex flex-col items-center gap-1">
                <PixelCrest club={homeClub} size={44} />
                <span className="font-pixel text-[10px] text-white">{homeClub.shortName}</span>
              </div>
              <div className="font-pixel text-2xl text-yellow-400 tabular-nums">
                {finalResult.homeScore} × {finalResult.awayScore}
              </div>
              <div className="flex flex-col items-center gap-1">
                <PixelCrest club={awayClub} size={44} />
                <span className="font-pixel text-[10px] text-white">{awayClub.shortName}</span>
              </div>
            </div>
            <h2 className="font-pixel text-xs text-yellow-300 mb-4">
              {(finalResult.winner === 'home' ? homeClub : awayClub).name.toUpperCase()} VENCEU!
            </h2>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  retroAudio.playConfirm();
                  onComplete(finalResult);
                }}
                className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white py-2.5 font-pixel text-[10px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTINUAR</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {titleLabel === 'DISPUTA DE PÊNALTIS' && (
                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playConfirm();
                    setRestartKey((k) => k + 1);
                  }}
                  className="retro-btn bg-[#163063] hover:bg-[#1e4082] text-white py-2 font-pixel text-[10px] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>NOVA DISPUTA</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
