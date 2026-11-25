import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  CloudRain,
  Gamepad2,
  LayoutGrid,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { retroAudio } from '../audio/retroAudio';
import {
  FORMATION_LIST,
  FORMATIONS,
  getClubById,
  getRoleShortLabel,
  resolveMatchKits,
} from '../data/clubs';
import { InputManager, VirtualButtonName } from '../engine/inputManager';
import { CANVAS_H, CANVAS_W, renderMatchFrame } from '../engine/pixelRenderer';
import { SoccerEngine } from '../engine/soccerEngine';
import {
  CameraMode,
  FormationId,
  MatchConfig,
  MatchResult,
  MatchSnapshotHUD,
  PlayerRole,
  SquadPlayer,
  TacticalPlayerInfo,
  TimeOfDay,
  WeatherType,
} from '../types/game';
import { MobileControls } from './MobileControls';

function getRolePillColor(role: PlayerRole): string {
  switch (role) {
    case 'GK':
      return 'bg-amber-500/20 text-amber-300 border-amber-400/50';
    case 'ZAG':
    case 'DEF':
      return 'bg-sky-500/20 text-sky-300 border-sky-400/50';
    case 'LAT':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50';
    case 'MID':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50';
    case 'FWD':
      return 'bg-rose-500/20 text-rose-300 border-rose-400/50';
  }
}

interface MatchArenaProps {
  config: MatchConfig;
  muted: boolean;
  onToggleMute: () => void;
  onFinishMatch: (result: MatchResult) => void;
  onExitMatch: () => void;
}

const CAMERA_ORDER: CameraMode[] = ['TV', 'PERTO', 'AMPLA'];

function detectTouchViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 1024
  );
}

export const MatchArena: React.FC<MatchArenaProps> = ({
  config,
  muted,
  onToggleMute,
  onFinishMatch,
  onExitMatch,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SoccerEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const cameraModeRef = useRef<CameraMode>('TV');

  const [restartKey, setRestartKey] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('TV');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const [showTouchPad, setShowTouchPad] = useState<boolean>(() => detectTouchViewport());
  const [showTacticsModal, setShowTacticsModal] = useState<boolean>(false);
  const [tacticsTeam, setTacticsTeam] = useState<'home' | 'away'>('home');
  const [selectedFieldPlayerId, setSelectedFieldPlayerId] = useState<string | null>(null);
  const [tacticalView, setTacticalView] = useState<{
    lineup: TacticalPlayerInfo[];
    bench: SquadPlayer[];
    formation: FormationId;
    subsUsed: number;
    maxSubs: number;
  } | null>(null);

  const homeClub = useMemo(() => getClubById(config.homeClubId), [config.homeClubId]);
  const awayClub = useMemo(() => getClubById(config.awayClubId), [config.awayClubId]);
  const { homeKit, awayKit } = useMemo(
    () => resolveMatchKits(homeClub, awayClub),
    [homeClub, awayClub]
  );

  const [hud, setHud] = useState<MatchSnapshotHUD>({
    homeScore: 0,
    awayScore: 0,
    clockMinutes: 0,
    clockSeconds: 0,
    half: 1,
    phase: 'KICKOFF',
    p1PlayerName: homeClub.squad[11]?.name ?? homeClub.squad[0].name,
    p1PlayerNumber: homeClub.squad[11]?.number ?? 9,
    p1Stamina: 100,
    p1Charge: 0,
    p1ChargeType: 'shot',
    p2PlayerName:
      config.controlMode === '1P_2P' ? (awayClub.squad[11]?.name ?? awayClub.squad[0].name) : null,
    p2PlayerNumber:
      config.controlMode === '1P_2P' ? (awayClub.squad[11]?.number ?? 9) : null,
    p2Stamina: 100,
    p2Charge: 0,
    p2ChargeType: 'shot',
    callout: null,
    goalBanner: null,
    replayInfo: null,
    broadcastLine: null,
    broadcastSpeaker: 'galvao',
    broadcastPartner: null,
    isPaused: false,
    weather: config.weather ?? 'SOL',
    timeOfDay: config.timeOfDay ?? 'DIA',
    homeFormation: config.homeFormation ?? '4-4-3',
    awayFormation: config.awayFormation ?? '4-4-3',
    homeSubsUsed: 0,
    awaySubsUsed: 0,
    maxSubs: 5,
  });

  const refreshTacticalSnapshot = (team: 'home' | 'away') => {
    const eng = engineRef.current;
    if (!eng) return;
    setTacticalView(eng.getTacticalSnapshot(team));
  };

  const openTacticsPanel = (team: 'home' | 'away' = 'home') => {
    const eng = engineRef.current;
    if (!eng) return;
    inputRef.current?.resetVirtualInputs();
    if (!eng.isPaused) {
      eng.togglePause();
    }
    setTacticsTeam(team);
    setSelectedFieldPlayerId(null);
    setTacticalView(eng.getTacticalSnapshot(team));
    setShowTacticsModal(true);
    setHud(eng.getHUDSnapshot());
  };

  const closeTacticsAndResume = () => {
    const eng = engineRef.current;
    setShowTacticsModal(false);
    setSelectedFieldPlayerId(null);
    if (eng && eng.isPaused) {
      eng.togglePause();
      setHud(eng.getHUDSnapshot());
    }
  };

  const handleChangeFormation = (formation: FormationId) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setFormation(tacticsTeam, formation);
    refreshTacticalSnapshot(tacticsTeam);
    setHud(eng.getHUDSnapshot());
  };

  const handlePerformSub = (benchIdx: number) => {
    const eng = engineRef.current;
    if (!eng || !selectedFieldPlayerId) return;
    const ok = eng.makeSubstitution(tacticsTeam, selectedFieldPlayerId, benchIdx);
    if (ok) {
      setSelectedFieldPlayerId(null);
      refreshTacticalSnapshot(tacticsTeam);
      setHud(eng.getHUDSnapshot());
    }
  };

  const handleChangeWeather = (w: WeatherType) => {
    const eng = engineRef.current;
    if (!eng) return;
    retroAudio.playCursor();
    eng.setWeather(w);
    setHud(eng.getHUDSnapshot());
  };

  const handleChangeTimeOfDay = (t: TimeOfDay) => {
    const eng = engineRef.current;
    if (!eng) return;
    retroAudio.playCursor();
    eng.setTimeOfDay(t);
    setHud(eng.getHUDSnapshot());
  };

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    if (!showTouchPad || hud.isPaused) {
      inputRef.current?.resetVirtualInputs();
    }
    if (!hud.isPaused && showTacticsModal) {
      setShowTacticsModal(false);
      setSelectedFieldPlayerId(null);
    }
  }, [showTouchPad, hud.isPaused, showTacticsModal]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyCam = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') {
        retroAudio.playCursor();
        setCameraMode('TV');
      } else if (e.code === 'Digit2') {
        retroAudio.playCursor();
        setCameraMode('PERTO');
      } else if (e.code === 'Digit3') {
        retroAudio.playCursor();
        setCameraMode('AMPLA');
      } else if (e.code === 'Tab') {
        e.preventDefault();
        retroAudio.playCursor();
        setCameraMode((prev) => {
          const idx = CAMERA_ORDER.indexOf(prev);
          return CAMERA_ORDER[(idx + 1) % CAMERA_ORDER.length];
        });
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyCam);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyCam);
    };
  }, []);

  useEffect(() => {
    retroAudio.unlock();
    retroAudio.startMenuMusic(retroAudio.getMenuMusicTrack());
    retroAudio.startStadiumAtmosphere();

    const engine = new SoccerEngine(config, onFinishMatch);
    const input = new InputManager();
    input.attach();

    engineRef.current = engine;
    inputRef.current = input;

    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const FIXED_DT = 1 / 60;
    let hudTickCounter = 0;

    const loop = (now: number) => {
      const frameDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      accumulator += frameDt;

      const isSinglePlayer = config.controlMode === '1P_CPU';
      while (accumulator >= FIXED_DT) {
        const p1 = input.pollPlayer(1, isSinglePlayer);
        const p2 = input.pollPlayer(2, false);
        engine.step(FIXED_DT, p1, p2);
        accumulator -= FIXED_DT;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderMatchFrame(ctx, engine, cameraModeRef.current);
        }
      }

      // Atualiza HUD React ~20x/s (fluido e leve)
      hudTickCounter++;
      if (hudTickCounter % 3 === 0) {
        setHud(engine.getHUDSnapshot());
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      engine.destroy();
      retroAudio.stopStadiumAtmosphere();
      retroAudio.stopNarration();
      input.detach();
    };
  }, [config, onFinishMatch, restartKey]);

  const handleCycleCamera = () => {
    retroAudio.playCursor();
    setCameraMode((prev) => {
      const idx = CAMERA_ORDER.indexOf(prev);
      return CAMERA_ORDER[(idx + 1) % CAMERA_ORDER.length];
    });
  };

  const handleToggleFullscreen = async () => {
    retroAudio.playCursor();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ambiente iframe pode restringir Fullscreen nativo; o jogo já ocupa 100% da janela
    }
  };

  const handleStickChange = (dx: number, dy: number, playerNum: 1 | 2 = 1) => {
    inputRef.current?.setVirtualStick(dx, dy, playerNum);
  };

  const handleButtonChange = (btn: VirtualButtonName, pressed: boolean, playerNum: 1 | 2 = 1) => {
    inputRef.current?.setVirtualButton(btn, pressed, playerNum);
  };

  const formattedClock = `${String(hud.clockMinutes).padStart(2, '0')}:${String(
    hud.clockSeconds
  ).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#040914] overflow-hidden select-none flex items-center justify-center">
      {/* Canvas Pixel Art HD 960x540 em Tela Cheia */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-full object-contain block pixelated"
      />

      {/* HUD SUPERIOR COMPACTO */}
      <div className="pointer-events-none fixed top-1.5 inset-x-2 sm:inset-x-3 flex items-start justify-between gap-2 z-10">
        {/* Placar Retrô Compacto + Cronômetro */}
        <div className="flex items-center bg-[#09152e]/88 border border-[#4d79cc] shadow-[2px_2px_0_#040914]">
          <div className="flex items-center gap-1.5 px-1.5 py-1">
            <span
              className="w-2 h-3.5 border border-white/60 shrink-0"
              style={{ backgroundColor: homeKit?.primary ?? '#ef4444' }}
            />
            <span className="font-pixel text-[9px] sm:text-[10px] text-white">
              {homeClub?.shortName ?? 'CAS'}
            </span>
          </div>

          <div className="px-2 py-1 bg-[#040914]/95 border-x border-[#315399] font-pixel text-[10px] sm:text-xs text-yellow-400 tabular-nums">
            {hud.homeScore}
            <span className="text-slate-500 mx-0.5">-</span>
            {hud.awayScore}
          </div>

          <div className="flex items-center gap-1.5 px-1.5 py-1">
            <span className="font-pixel text-[9px] sm:text-[10px] text-white">
              {awayClub?.shortName ?? 'VIS'}
            </span>
            <span
              className="w-2 h-3.5 border border-white/60 shrink-0"
              style={{ backgroundColor: awayKit?.primary ?? '#3b82f6' }}
            />
          </div>

          <div className="px-1.5 py-1 bg-[#12264d]/95 border-l border-[#315399] flex items-center gap-1">
            <span className="font-pixel text-[8px] text-emerald-400">{hud.half}T</span>
            <span className="font-pixel text-[9px] sm:text-[10px] text-white tabular-nums">
              {formattedClock}
            </span>
          </div>
        </div>

        {/* Rodada do Campeonato (compacta) */}
        {config.tournamentRoundLabel && (
          <div className="hidden lg:block bg-[#09152e]/82 border border-[#3b60a8] px-2 py-1 font-pixel text-[8px] text-yellow-300">
            {config.tournamentRoundLabel}
          </div>
        )}

        {/* Botões Rápidos Compactos (Tática/Subs + Câmera + Touch + Tela Cheia + Som + Pausa) */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              retroAudio.playCursor();
              openTacticsPanel('home');
            }}
            className="bg-[#112854]/92 hover:bg-[#1b3c7d] border border-yellow-400/90 px-1.5 py-1 text-[9px] font-bold text-yellow-200 cursor-pointer flex items-center gap-1"
            title="Mexer na Formação, Fazer Substituições e Mudar Clima"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-yellow-300" />
            <span className="font-pixel text-[7.5px] hidden sm:inline">
              TÁTICA · {hud.homeFormation}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              handleCycleCamera();
            }}
            className="bg-[#09152e]/88 hover:bg-[#173063] border border-[#4d79cc] px-1.5 py-1 text-[9px] font-bold text-slate-100 cursor-pointer flex items-center gap-1"
            title="Trocar câmera (Teclas 1 / 2 / 3 ou Tab)"
          >
            <Camera className="w-3.5 h-3.5 text-sky-300" />
            <span className="font-pixel text-[7.5px]">{cameraMode}</span>
          </button>

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
            title={
              showTouchPad
                ? 'Ocultar controle Fliperama na tela'
                : config.controlMode === '1P_2P'
                  ? 'Abrir controle 2P Fliperama na tela'
                  : 'Abrir controle Fliperama na tela'
            }
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[9px]">
              {config.controlMode === '1P_2P' ? '2P Arcade' : 'Fliperama'}
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
            title={muted ? 'Ativar som' : 'Silenciar som'}
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
              inputRef.current?.resetVirtualInputs();
              engineRef.current?.togglePause();
            }}
            className="bg-[#09152e]/88 hover:bg-[#173063] border border-[#4d79cc] p-1 text-slate-100 cursor-pointer"
            title="Pausar (Esc / P)"
          >
            <Pause className="w-3.5 h-3.5 text-yellow-400" />
          </button>
        </div>
      </div>

      {/* ESTAMINA + BARRA DE TOQUE / CRUZAMENTO / CHUTE P1 */}
      <div className="pointer-events-none fixed top-10 left-2 sm:left-3 z-10 bg-[#09152e]/84 border border-yellow-400/80 px-2 py-1 min-w-[132px] sm:min-w-[158px]">
        <div className="flex items-center justify-between gap-1.5 text-[10px]">
          <span className="font-bold text-yellow-400">P1</span>
          <span className="font-bold text-white truncate max-w-[106px]">
            #{hud.p1PlayerNumber} {hud.p1PlayerName}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <div className="flex-1 h-1.5 bg-[#040914] border border-[#2f4d87]">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${Math.round(hud.p1Stamina)}%`,
                backgroundColor:
                  hud.p1Stamina > 45 ? '#22c55e' : hud.p1Stamina > 20 ? '#facc15' : '#ef4444',
              }}
            />
          </div>
        </div>
        {hud.p1Charge > 0.02 && (
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`font-pixel text-[7px] shrink-0 ${
                hud.p1ChargeType === 'pass'
                  ? 'text-emerald-300'
                  : hud.p1ChargeType === 'cross'
                    ? 'text-sky-300'
                    : 'text-yellow-300'
              }`}
            >
              {hud.p1ChargeType === 'pass'
                ? 'TOQUE'
                : hud.p1ChargeType === 'cross'
                  ? 'CRUZ'
                  : 'CHUTE'}
            </span>
            <div className="flex-1 h-2 bg-[#040914] border border-white/45 overflow-hidden">
              <div
                className="h-full transition-all duration-50"
                style={{
                  width: `${Math.round(hud.p1Charge * 100)}%`,
                  backgroundColor:
                    hud.p1ChargeType === 'pass'
                      ? hud.p1Charge < 0.72
                        ? '#22c55e'
                        : '#34d399'
                      : hud.p1ChargeType === 'cross'
                        ? hud.p1Charge < 0.72
                          ? '#38bdf8'
                          : '#818cf8'
                        : hud.p1Charge < 0.55
                          ? '#22c55e'
                          : hud.p1Charge < 0.85
                            ? '#facc15'
                            : '#ef4444',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ESTAMINA + BARRA DE TOQUE / CRUZAMENTO / CHUTE P2 (quando 2P Local) */}
      {hud.p2PlayerName && (
        <div className="pointer-events-none fixed top-10 right-2 sm:right-3 z-10 bg-[#09152e]/84 border border-sky-400/80 px-2 py-1 min-w-[132px] sm:min-w-[158px]">
          <div className="flex items-center justify-between gap-1.5 text-[10px]">
            <span className="font-bold text-sky-400">P2</span>
            <span className="font-bold text-white truncate max-w-[106px]">
              #{hud.p2PlayerNumber} {hud.p2PlayerName}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 bg-[#040914] border border-[#2f4d87]">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${Math.round(hud.p2Stamina)}%`,
                backgroundColor:
                  hud.p2Stamina > 45 ? '#38bdf8' : hud.p2Stamina > 20 ? '#facc15' : '#ef4444',
              }}
            />
          </div>
          {hud.p2Charge > 0.02 && (
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`font-pixel text-[7px] shrink-0 ${
                  hud.p2ChargeType === 'pass'
                    ? 'text-emerald-300'
                    : hud.p2ChargeType === 'cross'
                      ? 'text-sky-300'
                      : 'text-yellow-300'
                }`}
              >
                {hud.p2ChargeType === 'pass'
                  ? 'TOQUE'
                  : hud.p2ChargeType === 'cross'
                    ? 'CRUZ'
                    : 'CHUTE'}
              </span>
              <div className="flex-1 h-2 bg-[#040914] border border-white/45 overflow-hidden">
                <div
                  className="h-full transition-all duration-50"
                  style={{
                    width: `${Math.round(hud.p2Charge * 100)}%`,
                    backgroundColor:
                      hud.p2ChargeType === 'pass'
                        ? '#22c55e'
                        : hud.p2ChargeType === 'cross'
                          ? '#38bdf8'
                          : hud.p2Charge < 0.55
                            ? '#22c55e'
                            : hud.p2Charge < 0.85
                              ? '#facc15'
                              : '#ef4444',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* OVERLAY DE REPLAY DO GOL (ESTILO TRANSMISSÃO DE TV EM CÂMERA LENTA) */}
      {hud.phase === 'GOAL_REPLAY' && hud.replayInfo && (
        <div className="pointer-events-none fixed inset-x-0 top-12 bottom-3 z-20 flex flex-col justify-between items-center px-4">
          <div className="bg-[#070f22]/90 border-2 border-red-500 px-3.5 py-1.5 flex items-center gap-3 shadow-[3px_3px_0_#040914]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-red-500 animate-pulse inline-block" />
              <span className="font-pixel text-[9px] sm:text-[10px] text-white tracking-wider">
                REPLAY
              </span>
            </div>
            <span className="text-xs font-bold text-yellow-300">
              #{hud.replayInfo.scorerNumber} {hud.replayInfo.scorerName.toUpperCase()} ({hud.replayInfo.minute}&apos;)
            </span>
            <span className="hidden sm:inline text-[10px] font-bold text-emerald-300 uppercase">
              {hud.replayInfo.teamName}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-3 bg-[#070f22]/88 border border-sky-400/70 px-3 py-1.5 shadow-[3px_3px_0_#040914]">
            <div className="w-28 sm:w-44 h-1.5 bg-[#040914] border border-slate-600 overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-75"
                style={{ width: `${Math.round(hud.replayInfo.progress * 100)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.skipReplay()}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-pixel text-[8px] px-2.5 py-1 cursor-pointer"
            >
              PULAR (Z/X)
            </button>
          </div>
        </div>
      )}

      {/* BANNER DE GOL COMPACTO */}
      {hud.goalBanner && hud.phase !== 'GOAL_REPLAY' && (
        <div className="pointer-events-none fixed inset-x-0 top-14 flex flex-col items-center justify-center z-20 px-4">
          <div className="bg-[#09152e]/92 border-2 border-yellow-400 px-5 py-2.5 text-center shadow-[4px_4px_0_#040914]">
            <div className="font-pixel text-xl sm:text-3xl animate-goal-blink tracking-wider">
              GOOOOL!!
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 font-pixel text-[10px] sm:text-xs text-white">
              <span className="text-yellow-300">#{hud.goalBanner.scorerNumber}</span>
              <span>{hud.goalBanner.scorerName.toUpperCase()}</span>
            </div>
            <p className="mt-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              {hud.goalBanner.teamName}
            </p>
          </div>
        </div>
      )}

      {/* BANNER DE LANCE COMPACTO (ESCANTEIO, FALTA, LATERAL, TIRO DE META) */}
      {!hud.goalBanner && hud.callout && (
        <div className="pointer-events-none fixed inset-x-0 top-11 flex justify-center z-20 px-4">
          <div
            className={`px-3 py-1 border shadow-[3px_3px_0_#040914] text-center ${
              hud.callout.type === 'foul'
                ? 'bg-[#450a0a]/92 border-red-400'
                : 'bg-[#09152e]/90 border-yellow-400'
            }`}
          >
            <p className="font-pixel text-[9px] sm:text-[10px] text-yellow-300">
              {hud.callout.text}
            </p>
            {hud.callout.subtext && (
              <p className="text-[10px] font-bold text-slate-100">{hud.callout.subtext}</p>
            )}
          </div>
        </div>
      )}

      {/* FAIXA DE NARRAÇÃO E COMENTÁRIOS (SOLO OU BATE-BOLA EM DUPLA · VOICE DESIGN) */}
      {hud.broadcastLine && !hud.callout && (!hud.goalBanner || hud.phase === 'GOAL_REPLAY') && (
        <div
          className={`pointer-events-none fixed inset-x-0 flex justify-center z-20 px-6 sm:px-24 ${
            hud.phase === 'GOAL_REPLAY' ? 'bottom-12' : 'top-10'
          }`}
        >
          <div className="bg-[#060f24]/92 border border-[#3d64b0] px-2.5 py-0.5 flex items-center gap-2 shadow-[2px_2px_0_#040914] max-w-2xl">
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`px-1.5 py-0.5 text-[7px] font-pixel whitespace-nowrap ${
                  hud.broadcastSpeaker === 'casagrande'
                    ? 'bg-amber-500 text-slate-950'
                    : hud.broadcastSpeaker === 'ronaldo'
                      ? 'bg-emerald-500 text-slate-950'
                      : hud.broadcastSpeaker === 'neto'
                        ? 'bg-orange-500 text-slate-950'
                        : 'bg-red-600 text-white'
                }`}
              >
                {hud.broadcastSpeaker === 'casagrande'
                  ? 'CASAGRANDE'
                  : hud.broadcastSpeaker === 'ronaldo'
                    ? 'RONALDO'
                    : hud.broadcastSpeaker === 'neto'
                      ? 'CRAQUE NETO'
                      : 'GALVÃO BUENO'}
              </span>
              {hud.broadcastPartner && (
                <>
                  <span className="text-[8px] font-bold text-slate-400">+</span>
                  <span
                    className={`px-1.5 py-0.5 text-[7px] font-pixel whitespace-nowrap ${
                      hud.broadcastPartner === 'casagrande'
                        ? 'bg-amber-500 text-slate-950'
                        : hud.broadcastPartner === 'ronaldo'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-orange-500 text-slate-950'
                    }`}
                  >
                    {hud.broadcastPartner === 'casagrande'
                      ? 'CASAGRANDE'
                      : hud.broadcastPartner === 'ronaldo'
                        ? 'RONALDO'
                        : 'CRAQUE NETO'}
                  </span>
                </>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 line-clamp-2 leading-tight">
              {hud.broadcastLine}
            </span>
          </div>
        </div>
      )}

      {/* Dica Discreta de Teclado (somente quando Controle Fliperama na tela está desligado) */}
      {!showTouchPad && (
        <div className="pointer-events-none hidden sm:block fixed bottom-2 right-2.5 z-10 bg-[#09152e]/78 border border-[#345699]/80 px-2 py-1 text-[9px] text-slate-300">
          {hud.p2PlayerName ? (
            <>
              <span className="text-yellow-400 font-bold">P1</span> Setas+Z/X/V/C ·{' '}
              <span className="text-sky-300 font-bold">P2</span> WASD+F/G/J/H ·{' '}
              <span className="text-emerald-300 font-bold">2P Arcade</span> no topo
            </>
          ) : (
            <>
              <span className="text-yellow-400 font-bold">Setas/WASD</span> Mover ·{' '}
              <span className="text-yellow-400 font-bold">Z</span> Passe (Corre Auto) ·{' '}
              <span className="text-yellow-400 font-bold">X</span> Chute/Bicicleta ·{' '}
              <span className="text-teal-300 font-bold">V</span> Tomar/Pedalar ·{' '}
              <span className="text-yellow-400 font-bold">C</span> Cruzar/Bicicleta ·{' '}
              <span className="text-yellow-400 font-bold">Shift/Espaço</span> Correr ·{' '}
              <span className="text-sky-300 font-bold">1-3</span> Câm
            </>
          )}
        </div>
      )}

      {/* Controle Fliperama (1P ou 2P simultâneo na tela) */}
      {showTouchPad && !hud.isPaused && (
        <MobileControls
          mode="match"
          players={config.controlMode === '1P_2P' ? 2 : 1}
          onStickChange={handleStickChange}
          onButtonChange={handleButtonChange}
        />
      )}

      {/* MODAL DE TÁTICA, FORMAÇÃO, SUBSTITUIÇÕES E CLIMA AO VIVO */}
      {hud.isPaused && showTacticsModal && tacticalView && (
        <div className="fixed inset-0 bg-[#040914]/88 z-40 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="retro-box-gold p-4 w-full max-w-4xl my-auto">
            {/* Cabeçalho do Painel Tático */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2b4a87]">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-yellow-400" />
                <div>
                  <h2 className="font-pixel text-xs sm:text-sm text-yellow-400">
                    TÁTICA, FORMAÇÃO E SUBSTITUIÇÕES
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    {tacticsTeam === 'home' ? homeClub.name : awayClub.name} · Esquema{' '}
                    <strong className="text-yellow-300">{tacticalView.formation}</strong> · Subs:{' '}
                    <strong className="text-emerald-300">
                      {tacticalView.subsUsed}/{tacticalView.maxSubs}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {config.controlMode === '1P_2P' && (
                  <div className="flex border border-[#3a5ea3] bg-[#081329]">
                    <button
                      type="button"
                      onClick={() => {
                        retroAudio.playCursor();
                        setTacticsTeam('home');
                        setSelectedFieldPlayerId(null);
                        refreshTacticalSnapshot('home');
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold cursor-pointer ${
                        tacticsTeam === 'home'
                          ? 'bg-yellow-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      P1 · {homeClub.shortName}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        retroAudio.playCursor();
                        setTacticsTeam('away');
                        setSelectedFieldPlayerId(null);
                        refreshTacticalSnapshot('away');
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold cursor-pointer ${
                        tacticsTeam === 'away'
                          ? 'bg-sky-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      P2 · {awayClub.shortName}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playConfirm();
                    closeTacticsAndResume();
                  }}
                  className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white px-3 py-1.5 font-pixel text-[9px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>VOLTAR AO JOGO</span>
                </button>
              </div>
            </div>

            {/* Barra de Formação + Clima / Horário ao Vivo */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Seleção de Formação + Mini-Campo Tático */}
              <div className="md:col-span-5 bg-[#09152e] border border-[#2b4a87] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[9px] text-yellow-300">FORMAÇÃO (12×12)</span>
                  <span className="text-[10px] text-slate-400">
                    {FORMATIONS[tacticalView.formation]?.description}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {FORMATION_LIST.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleChangeFormation(f.id)}
                      className={`py-1.5 text-[10px] font-bold border cursor-pointer transition-colors ${
                        tacticalView.formation === f.id
                          ? 'bg-yellow-400 text-slate-950 border-white'
                          : 'bg-[#0c1d3d] text-slate-200 border-[#2b4a87] hover:border-yellow-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Mini-Campo Tático Visual */}
                <div className="relative w-full h-36 bg-[#1e6d2c] border-2 border-white/75 overflow-hidden">
                  {/* Linha central + círculo */}
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/55" />
                  <div className="absolute top-1/2 left-1/2 w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/55" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-16 border-y border-r border-white/55" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-16 border-y border-l border-white/55" />

                  {FORMATIONS[tacticalView.formation]?.slots.map((slot, idx) => {
                    const pl = tacticalView.lineup[idx];
                    const isSelected = pl && pl.id === selectedFieldPlayerId;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => pl && setSelectedFieldPlayerId(pl.id)}
                        title={pl ? `#${pl.number} ${pl.name} (${getRoleShortLabel(slot.role)})` : ''}
                        style={{
                          left: `${Math.min(92, Math.max(6, slot.x * 112))}%`,
                          top: `${Math.min(90, Math.max(10, slot.y * 100))}%`,
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border cursor-pointer transition-transform ${
                          isSelected
                            ? 'bg-yellow-400 text-slate-950 border-white scale-125 z-10'
                            : slot.role === 'GK'
                              ? 'bg-amber-400 text-slate-950 border-slate-900'
                              : tacticsTeam === 'home'
                                ? 'bg-red-600 text-white border-white'
                                : 'bg-sky-500 text-slate-950 border-white'
                        }`}
                      >
                        {pl?.number ?? idx + 1}
                      </button>
                    );
                  })}
                </div>

                {/* Controle Rápido de Clima e Horário */}
                <div className="pt-2 border-t border-[#223d73] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'SOL' as WeatherType, label: 'Sol', Icon: Sun },
                        { id: 'CHUVA' as WeatherType, label: 'Chuva', Icon: CloudRain },
                        { id: 'NEVE' as WeatherType, label: 'Neve', Icon: Snowflake },
                      ] as const
                    ).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleChangeWeather(id)}
                        className={`px-2 py-1 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                          hud.weather === id
                            ? 'bg-sky-400 text-slate-950 border-white'
                            : 'bg-[#081329] text-slate-300 border-[#28457d]'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleChangeTimeOfDay('DIA')}
                      className={`px-2 py-1 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                        hud.timeOfDay === 'DIA'
                          ? 'bg-yellow-300 text-slate-950 border-white'
                          : 'bg-[#081329] text-slate-300 border-[#28457d]'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      <span>Dia</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeTimeOfDay('NOITE')}
                      className={`px-2 py-1 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                        hud.timeOfDay === 'NOITE'
                          ? 'bg-indigo-400 text-slate-950 border-white'
                          : 'bg-[#081329] text-slate-300 border-[#28457d]'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      <span>Noite</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Substituições: 12 em Campo -> 5 no Banco */}
              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Coluna 1: 12 Titulares em Campo */}
                <div className="bg-[#09152e] border border-[#2b4a87] p-2.5 flex flex-col">
                  <p className="font-pixel text-[8.5px] text-yellow-300 mb-1.5">
                    1. CLIQUE QUEM SAI (12 EM CAMPO)
                  </p>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {tacticalView.lineup.map((p) => {
                      const selected = selectedFieldPlayerId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            retroAudio.playCursor();
                            setSelectedFieldPlayerId(selected ? null : p.id);
                          }}
                          className={`w-full px-2 py-1 border text-left flex items-center justify-between gap-1.5 text-[11px] cursor-pointer transition-colors ${
                            selected
                              ? 'bg-yellow-400/20 border-yellow-400 text-white'
                              : 'bg-[#0c1b3a] border-[#223d73] text-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-1 py-0.2 border text-[8px] font-bold shrink-0 ${getRolePillColor(
                                p.role
                              )}`}
                            >
                              {getRoleShortLabel(p.role)}
                            </span>
                            <span className="font-bold text-yellow-300 w-5 text-right tabular-nums shrink-0">
                              {p.number}
                            </span>
                            <span className="truncate font-semibold">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="w-10 h-1.5 bg-[#040914] border border-slate-600">
                              <div
                                className="h-full"
                                style={{
                                  width: `${p.stamina}%`,
                                  backgroundColor:
                                    p.stamina > 55
                                      ? '#22c55e'
                                      : p.stamina > 28
                                        ? '#facc15'
                                        : '#ef4444',
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Coluna 2: Banco de Reservas */}
                <div className="bg-[#09152e] border border-[#2b4a87] p-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-pixel text-[8.5px] text-emerald-300">
                        2. CLIQUE QUEM ENTRA (BANCO)
                      </p>
                      <span className="text-[10px] font-bold text-slate-300">
                        {tacticalView.subsUsed}/{tacticalView.maxSubs}
                      </span>
                    </div>

                    {tacticalView.subsUsed >= tacticalView.maxSubs ? (
                      <div className="p-3 bg-[#172545] border border-amber-400/50 text-xs text-amber-200 text-center">
                        Limite de {tacticalView.maxSubs} substituições atingido!
                      </div>
                    ) : tacticalView.bench.length === 0 ? (
                      <div className="p-3 bg-[#172545] border border-slate-600 text-xs text-slate-300 text-center">
                        Sem reservas restantes no banco.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {tacticalView.bench.map((b, bIdx) => {
                          const canSub = Boolean(selectedFieldPlayerId);
                          return (
                            <button
                              key={`${b.number}-${b.name}-${bIdx}`}
                              type="button"
                              disabled={!canSub}
                              onClick={() => handlePerformSub(bIdx)}
                              className={`w-full px-2.5 py-2 border text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                                canSub
                                  ? 'bg-emerald-950/70 border-emerald-400 hover:bg-emerald-800/60 text-white cursor-pointer'
                                  : 'bg-[#0b1833] border-[#223d73] text-slate-400 opacity-75 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-1 border text-[8px] font-bold shrink-0 ${getRolePillColor(
                                    b.role
                                  )}`}
                                >
                                  {getRoleShortLabel(b.role)}
                                </span>
                                <span className="font-bold text-emerald-300 w-5 text-right tabular-nums shrink-0">
                                  {b.number}
                                </span>
                                <span className="truncate font-bold">{b.name}</span>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-300 shrink-0">
                                {canSub ? 'ENTRAR →' : '100%'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 pt-2 border-t border-[#223d73] text-[10px] text-slate-400">
                    {selectedFieldPlayerId
                      ? 'Agora clique em um jogador do banco para fazer a substituição imediata!'
                      : 'Selecione primeiro um titular na lista da esquerda para substituí-lo.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAUSA */}
      {hud.isPaused && !showTacticsModal && (
        <div className="fixed inset-0 bg-[#040914]/82 z-30 flex items-center justify-center p-4">
          <div className="retro-box-gold p-5 w-full max-w-sm text-center">
            <h2 className="font-pixel text-base text-yellow-400 mb-1.5">JOGO PAUSADO</h2>
            <p className="text-xs text-slate-300 mb-3">
              {homeClub?.name} {hud.homeScore} × {hud.awayScore} {awayClub?.name}
            </p>

            {/* Atalho rápido de Clima e Horário direto no Pause */}
            <div className="mb-3 p-2 bg-[#09152e] border border-[#2b4a87] flex flex-wrap items-center justify-center gap-1.5">
              {(
                [
                  { id: 'SOL' as WeatherType, label: 'Sol', Icon: Sun },
                  { id: 'CHUVA' as WeatherType, label: 'Chuva', Icon: CloudRain },
                  { id: 'NEVE' as WeatherType, label: 'Neve', Icon: Snowflake },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleChangeWeather(id)}
                  className={`px-2 py-1 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                    hud.weather === id
                      ? 'bg-sky-400 text-slate-950 border-white'
                      : 'bg-[#081329] text-slate-300 border-[#28457d]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleChangeTimeOfDay(hud.timeOfDay === 'DIA' ? 'NOITE' : 'DIA')}
                className={`px-2 py-1 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                  hud.timeOfDay === 'DIA'
                    ? 'bg-yellow-300 text-slate-950 border-white'
                    : 'bg-indigo-400 text-slate-950 border-white'
                }`}
              >
                {hud.timeOfDay === 'DIA' ? (
                  <>
                    <Sun className="w-3 h-3" />
                    <span>Dia</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3" />
                    <span>Noite</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  retroAudio.playConfirm();
                  engineRef.current?.togglePause();
                  setHud((prev) => ({ ...prev, isPaused: false }));
                }}
                className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white py-2 font-pixel text-[10px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>CONTINUAR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  retroAudio.playCursor();
                  openTacticsPanel('home');
                }}
                className="retro-btn bg-[#1e3d7a] hover:bg-[#28509e] border-yellow-400 text-yellow-200 py-2 font-pixel text-[10px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>FORMAÇÃO E SUBSTITUIÇÕES</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  retroAudio.playConfirm();
                  setShowTacticsModal(false);
                  setRestartKey((k) => k + 1);
                }}
                className="retro-btn bg-[#163063] hover:bg-[#1e4082] text-white py-2 font-pixel text-[10px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>REINICIAR PARTIDA</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  retroAudio.playCancel();
                  onExitMatch();
                }}
                className="retro-btn bg-[#381320] hover:bg-[#521c2e] border-red-400 text-red-100 py-2 font-pixel text-[10px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>SAIR DA PARTIDA</span>
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#29457d] text-[10px] text-slate-400 space-y-1">
              <div>
                P1: Setas + Z/X/C/V (Tomar/Driblar GK)/Shift · Direcional após chute: Curva · P2: WASD + F/G/H/J/Espaço · Câmeras: 1 / 2 / 3
              </div>
              <div className="text-yellow-300/90 font-bold tracking-wide">
                Jogo criado por Efatá GameStudio
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
