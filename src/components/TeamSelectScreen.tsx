import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Play,
  Users,
  Cpu,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sun,
  CloudRain,
  Snowflake,
  Moon,
  LayoutGrid,
} from 'lucide-react';
import { retroAudio } from '../audio/retroAudio';
import {
  CLUBS,
  FORMATION_LIST,
  getClubById,
  getRoleShortLabel,
  resolveMatchKits,
} from '../data/clubs';
import {
  Club,
  Difficulty,
  FormationId,
  GameMode,
  MatchConfig,
  MatchDurationMinutes,
  PlayerControlMode,
  PlayerRole,
  TimeOfDay,
  WeatherType,
} from '../types/game';
import { PixelCrest, PixelJersey } from './PixelCrest';

interface TeamSelectScreenProps {
  mode: GameMode;
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  onBack: () => void;
  onStartFriendly: (config: MatchConfig) => void;
  onStartTournament: (
    clubId: string,
    duration: MatchDurationMinutes,
    opts?: { weather?: WeatherType; timeOfDay?: TimeOfDay; formation?: FormationId }
  ) => void;
  onStartPenalties: (homeId: string, awayId: string, controlMode: PlayerControlMode) => void;
}

function getRoleBadgeClass(role: PlayerRole): string {
  switch (role) {
    case 'GK':
      return 'text-amber-300';
    case 'ZAG':
    case 'DEF':
      return 'text-sky-300';
    case 'LAT':
      return 'text-cyan-300';
    case 'MID':
      return 'text-emerald-300';
    case 'FWD':
      return 'text-rose-300';
  }
}

const GRID_COLS = 6;

const StatBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-8 font-bold text-slate-300">{label}</span>
    <div className="flex-1 h-2.5 bg-[#081124] border border-[#2d4a84]">
      <div
        className="h-full transition-all duration-150"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
      />
    </div>
    <span className="w-6 text-right font-bold tabular-nums text-white">{value}</span>
  </div>
);

function moveGridIndex(currentIndex: number, dx: number, dy: number): number {
  const total = CLUBS.length;
  const rows = Math.ceil(total / GRID_COLS);
  const col = currentIndex % GRID_COLS;
  const row = Math.floor(currentIndex / GRID_COLS);
  const nextCol = (col + dx + GRID_COLS) % GRID_COLS;
  const nextRow = (row + dy + rows) % rows;
  const candidate = nextRow * GRID_COLS + nextCol;
  return candidate < total ? candidate : total - 1;
}

export const TeamSelectScreen: React.FC<TeamSelectScreenProps> = ({
  mode,
  difficulty,
  onChangeDifficulty,
  onBack,
  onStartFriendly,
  onStartTournament,
  onStartPenalties,
}) => {
  const [homeId, setHomeId] = useState<string>('fla');
  const [awayId, setAwayId] = useState<string>('pal');
  const [activeSlot, setActiveSlot] = useState<'home' | 'away'>('home');
  const [controlMode, setControlMode] = useState<PlayerControlMode>('1P_CPU');
  const [duration, setDuration] = useState<MatchDurationMinutes>(3);
  const [weather, setWeather] = useState<WeatherType>('SOL');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DIA');
  const [homeFormation, setHomeFormation] = useState<FormationId>('4-4-3');
  const [awayFormation, setAwayFormation] = useState<FormationId>('4-4-3');

  // Confirmação independente para P1 e P2 (P2 pode escolher e confirmar a qualquer momento sem depender do P1)
  const [p1Ready, setP1Ready] = useState<boolean>(false);
  const [p2Ready, setP2Ready] = useState<boolean>(false);

  const isSinglePick = mode === 'TOURNAMENT';
  const isTwoPlayer = !isSinglePick && controlMode === '1P_2P';
  const homeClub = getClubById(homeId);
  const awayClub = getClubById(awayId);

  const resolvedKits = useMemo(
    () => resolveMatchKits(homeClub, awayClub),
    [homeClub, awayClub]
  );

  const pickForP1 = useCallback((club: Club) => {
    retroAudio.unlock();
    retroAudio.playCursor();
    setHomeId(club.id);
    setP1Ready(false);
  }, []);

  const pickForP2 = useCallback((club: Club) => {
    retroAudio.unlock();
    retroAudio.playCursor();
    setAwayId(club.id);
    setP2Ready(false);
  }, []);

  const handleSelectClub = (club: Club) => {
    retroAudio.unlock();
    retroAudio.playCursor();
    if (isSinglePick) {
      setHomeId(club.id);
      return;
    }
    if (activeSlot === 'home') {
      setHomeId(club.id);
      setP1Ready(false);
      // No modo 1P vs CPU facilita a escolha sequencial; em 2P cada jogador escolhe livremente!
      if (!isTwoPlayer) {
        setActiveSlot('away');
      }
    } else {
      setAwayId(club.id);
      setP2Ready(false);
      if (!isTwoPlayer) {
        setActiveSlot('home');
      }
    }
  };

  const handleConfirm = useCallback(() => {
    retroAudio.unlock();
    retroAudio.playConfirm();
    if (mode === 'TOURNAMENT') {
      onStartTournament(homeId, duration, { weather, timeOfDay, formation: homeFormation });
    } else if (mode === 'PENALTIES') {
      onStartPenalties(homeId, awayId, controlMode);
    } else {
      onStartFriendly({
        mode: 'FRIENDLY',
        controlMode,
        homeClubId: homeId,
        awayClubId: awayId,
        durationMinutes: duration,
        difficulty,
        weather,
        timeOfDay,
        homeFormation,
        awayFormation,
      });
    }
  }, [
    awayFormation,
    awayId,
    controlMode,
    difficulty,
    duration,
    homeFormation,
    homeId,
    mode,
    onStartFriendly,
    onStartPenalties,
    onStartTournament,
    timeOfDay,
    weather,
  ]);

  // Navegação simultânea e independente por teclado: P1 (Setas + Z/Enter) e P2 (WASD + F/G/Espaço)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      // Jogador 1 (Setas + Z / Enter)
      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
        const dx = code === 'ArrowRight' ? 1 : code === 'ArrowLeft' ? -1 : 0;
        const dy = code === 'ArrowDown' ? 1 : code === 'ArrowUp' ? -1 : 0;
        if (!isTwoPlayer && !isSinglePick && activeSlot === 'away') {
          setAwayId((curr) => {
            const idx = Math.max(0, CLUBS.findIndex((c) => c.id === curr));
            return CLUBS[moveGridIndex(idx, dx, dy)].id;
          });
        } else {
          setHomeId((curr) => {
            const idx = Math.max(0, CLUBS.findIndex((c) => c.id === curr));
            return CLUBS[moveGridIndex(idx, dx, dy)].id;
          });
          setP1Ready(false);
        }
        retroAudio.unlock();
        retroAudio.playCursor();
        return;
      }

      if (code === 'KeyZ' || code === 'Enter') {
        if (isTwoPlayer) {
          e.preventDefault();
          retroAudio.unlock();
          if (p1Ready && p2Ready && code === 'Enter') {
            handleConfirm();
          } else {
            retroAudio.playConfirm();
            setP1Ready((prev) => !prev);
          }
        }
        return;
      }

      // Jogador 2 totalmente independente (W/A/S/D + F/G/Espaço) — funciona mesmo antes do P1 escolher!
      if (!isSinglePick && (code === 'KeyW' || code === 'KeyS' || code === 'KeyA' || code === 'KeyD')) {
        e.preventDefault();
        if (controlMode !== '1P_2P') {
          setControlMode('1P_2P');
        }
        const dx = code === 'KeyD' ? 1 : code === 'KeyA' ? -1 : 0;
        const dy = code === 'KeyS' ? 1 : code === 'KeyW' ? -1 : 0;
        setAwayId((curr) => {
          const idx = Math.max(0, CLUBS.findIndex((c) => c.id === curr));
          return CLUBS[moveGridIndex(idx, dx, dy)].id;
        });
        setP2Ready(false);
        retroAudio.unlock();
        retroAudio.playCursor();
        return;
      }

      if (!isSinglePick && (code === 'KeyF' || code === 'KeyG' || code === 'Space')) {
        if (controlMode === '1P_2P') {
          e.preventDefault();
          retroAudio.unlock();
          retroAudio.playConfirm();
          setP2Ready((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSlot, controlMode, handleConfirm, isSinglePick, isTwoPlayer, p1Ready, p2Ready]);

  // Suporte independente a 2 controles USB (Gamepad 1 -> P1, Gamepad 2 -> P2)
  const padCooldownRef = useRef<[number, number]>([0, 0]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const now = performance.now();

      for (let pi = 0; pi < 2; pi++) {
        const pad = pads[pi];
        if (!pad || now < padCooldownRef.current[pi]) continue;
        if (pi === 1 && isSinglePick) continue;

        const axX = pad.axes[0] ?? 0;
        const axY = pad.axes[1] ?? 0;
        const left = axX < -0.55 || Boolean(pad.buttons[14]?.pressed);
        const right = axX > 0.55 || Boolean(pad.buttons[15]?.pressed);
        const up = axY < -0.55 || Boolean(pad.buttons[12]?.pressed);
        const down = axY > 0.55 || Boolean(pad.buttons[13]?.pressed);
        const confirmBtn = Boolean(pad.buttons[0]?.pressed || pad.buttons[9]?.pressed);

        if (left || right || up || down) {
          const dx = right ? 1 : left ? -1 : 0;
          const dy = down ? 1 : up ? -1 : 0;
          if (pi === 0) {
            setHomeId((curr) => {
              const idx = Math.max(0, CLUBS.findIndex((c) => c.id === curr));
              return CLUBS[moveGridIndex(idx, dx, dy)].id;
            });
            setP1Ready(false);
          } else {
            setControlMode('1P_2P');
            setAwayId((curr) => {
              const idx = Math.max(0, CLUBS.findIndex((c) => c.id === curr));
              return CLUBS[moveGridIndex(idx, dx, dy)].id;
            });
            setP2Ready(false);
          }
          retroAudio.unlock();
          retroAudio.playCursor();
          padCooldownRef.current[pi] = now + 175;
        } else if (confirmBtn) {
          retroAudio.unlock();
          retroAudio.playConfirm();
          if (pi === 0) {
            if (isTwoPlayer) setP1Ready((prev) => !prev);
            else handleConfirm();
          } else {
            setControlMode('1P_2P');
            setP2Ready((prev) => !prev);
          }
          padCooldownRef.current[pi] = now + 280;
        }
      }
    }, 55);

    return () => window.clearInterval(timer);
  }, [handleConfirm, isSinglePick, isTwoPlayer]);

  const modeTitle =
    mode === 'TOURNAMENT'
      ? 'CAMPEONATO · ESCOLHA SEU CLUBE'
      : mode === 'PENALTIES'
        ? 'DISPUTA DE PÊNALTIS · ESCOLHA OS CLUBES'
        : 'AMISTOSO · SELEÇÃO DE CLUBES';

  return (
    <div className="min-h-screen w-full bg-[#081124] px-4 sm:px-6 py-5 flex flex-col">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-5 flex-1">
        {/* Topo */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#233d70] pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                retroAudio.playCancel();
                onBack();
              }}
              className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-white px-3 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <h1 className="font-pixel text-xs sm:text-base text-yellow-400">{modeTitle}</h1>
          </div>

          {/* Configurações rápidas */}
          <div className="flex flex-wrap items-center gap-3">
            {!isSinglePick && (
              <div className="flex items-center bg-[#0d1b38] border-2 border-[#2b4a87] p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playCursor();
                    setControlMode('1P_CPU');
                    setP1Ready(false);
                    setP2Ready(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    controlMode === '1P_CPU'
                      ? 'bg-yellow-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>1P vs CPU</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playCursor();
                    setControlMode('1P_2P');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    controlMode === '1P_2P'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>2P Fliperama</span>
                </button>
              </div>
            )}

            {mode !== 'PENALTIES' && (
              <div className="flex items-center gap-1 bg-[#0d1b38] border-2 border-[#2b4a87] p-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
                {([2, 3, 5] as MatchDurationMinutes[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      retroAudio.playCursor();
                      setDuration(m);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold tabular-nums whitespace-nowrap cursor-pointer ${
                      duration === m
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            )}

            {(isSinglePick || controlMode === '1P_CPU') && (
              <div className="flex items-center gap-1 bg-[#0d1b38] border-2 border-[#2b4a87] p-0.5">
                {(['FACIL', 'MEDIO', 'DIFICIL'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      retroAudio.playCursor();
                      onChangeDifficulty(d);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                      difficulty === d
                        ? 'bg-yellow-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {d === 'FACIL' ? 'Fácil' : d === 'MEDIO' ? 'Médio' : 'Difícil'}
                  </button>
                ))}
              </div>
            )}

            {mode !== 'PENALTIES' && (
              <>
                {/* Seletor de Tempo (Sol / Chuva / Neve) */}
                <div className="flex items-center gap-0.5 bg-[#0d1b38] border-2 border-[#2b4a87] p-0.5">
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
                      onClick={() => {
                        retroAudio.playCursor();
                        setWeather(id);
                      }}
                      className={`px-2 py-1.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        weather === id
                          ? id === 'SOL'
                            ? 'bg-amber-400 text-slate-950'
                            : id === 'CHUVA'
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-slate-100 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Seletor de Horário (Dia / Noite) */}
                <div className="flex items-center gap-0.5 bg-[#0d1b38] border-2 border-[#2b4a87] p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      retroAudio.playCursor();
                      setTimeOfDay('DIA');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      timeOfDay === 'DIA'
                        ? 'bg-yellow-300 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Dia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      retroAudio.playCursor();
                      setTimeOfDay('NOITE');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      timeOfDay === 'NOITE'
                        ? 'bg-indigo-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Noite</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Layout Principal: Grade 6x4 (esquerda) + Painel de Detalhes & Escalações 2026 (direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Grade 6x4 dos 24 Clubes */}
          <section className="lg:col-span-7 retro-box p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-300">
              <span className="font-bold">
                {isSinglePick
                  ? 'SELECIONE SEU CLUBE ENTRE OS 24 PARTICIPANTES'
                  : isTwoPlayer
                    ? 'SELEÇÃO LIVRE: P1 (SETAS) E P2 (WASD) ESCOLHEM DE FORMA INDEPENDENTE!'
                    : activeSlot === 'home'
                      ? 'ESCOLHENDO: TIME DA CASA (P1 — AMARELO)'
                      : 'ESCOLHENDO: VISITANTE (CPU — CIANO)'}
              </span>
              {!isSinglePick && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSlot('home')}
                    className={`px-2 py-0.5 border font-bold cursor-pointer ${
                      activeSlot === 'home'
                        ? 'border-yellow-400 text-yellow-300 bg-[#1a3366]'
                        : 'border-slate-600 text-slate-400'
                    }`}
                  >
                    Foco P1
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSlot('away')}
                    className={`px-2 py-0.5 border font-bold cursor-pointer ${
                      activeSlot === 'away'
                        ? 'border-sky-400 text-sky-300 bg-[#1a3366]'
                        : 'border-slate-600 text-slate-400'
                    }`}
                  >
                    Foco {isTwoPlayer ? 'P2' : 'CPU'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {CLUBS.map((club) => {
                const isHome = club.id === homeId;
                const isAway = !isSinglePick && club.id === awayId;
                let borderStyle = 'border-[#254078] bg-[#0c1a36] hover:border-slate-300';
                if (isHome && isAway) {
                  borderStyle = 'border-emerald-400 bg-[#18386e]';
                } else if (isHome) {
                  borderStyle = 'border-yellow-400 bg-[#1b3469]';
                } else if (isAway) {
                  borderStyle = 'border-sky-400 bg-[#12335c]';
                }

                return (
                  <div
                    key={club.id}
                    className={`relative border-2 p-1.5 flex flex-col items-center justify-between gap-1 transition-colors ${borderStyle}`}
                    title={`${club.name} (${club.division})`}
                  >
                    {isHome && (
                      <span className="absolute top-0.5 left-1 font-pixel text-[8px] text-yellow-400">
                        P1{p1Ready && isTwoPlayer ? '✓' : ''}
                      </span>
                    )}
                    {isAway && (
                      <span className="absolute top-0.5 right-1 font-pixel text-[8px] text-sky-300">
                        {isTwoPlayer ? `P2${p2Ready ? '✓' : ''}` : 'CPU'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelectClub(club)}
                      className="w-full pt-1 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <PixelCrest club={club} size={32} />
                      <span className="font-pixel text-[9px] text-white tracking-tight">
                        {club.shortName}
                      </span>
                      <span className="text-[10px] text-slate-300 truncate max-w-full leading-none">
                        {club.name}
                      </span>
                    </button>

                    {/* Botões diretos P1 e P2: permite que o Jogador 2 escolha seu clube a qualquer hora sem esperar o Jogador 1 */}
                    {!isSinglePick && (
                      <div className="w-full grid grid-cols-2 gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pickForP1(club);
                          }}
                          className={`text-[9px] font-bold py-0.5 border cursor-pointer transition-colors ${
                            isHome
                              ? 'bg-yellow-400 text-slate-950 border-yellow-200'
                              : 'bg-[#081329] text-yellow-300 border-[#28457d] hover:bg-yellow-400/20'
                          }`}
                        >
                          P1
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pickForP2(club);
                          }}
                          className={`text-[9px] font-bold py-0.5 border cursor-pointer transition-colors ${
                            isAway
                              ? 'bg-sky-400 text-slate-950 border-sky-200'
                              : 'bg-[#081329] text-sky-300 border-[#28457d] hover:bg-sky-400/20'
                          }`}
                        >
                          {isTwoPlayer ? 'P2' : 'CPU'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>1–20: Série A 2026</span>
              <span>21–24: Convidados (FOR, CEA, SPT, JUV)</span>
            </div>

            {!isSinglePick && (
              <div className="mt-3 px-3 py-2 bg-[#0c1d3d] border border-sky-400/70 text-[11px] text-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-yellow-300">P1:</strong> Setas + Z (ou USB 1 / botão P1)
                </span>
                <span>
                  <strong className="text-sky-300">P2 (Independente):</strong> WASD + F/Espaço (ou USB 2 / botão P2)
                </span>
                {isTwoPlayer && (
                  <span className="text-emerald-300 font-bold">
                    + Fliperama Touch 2P disponível no jogo!
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Painel Direito: Comparação + Elenco Titular 7x7 de 2026 */}
          <aside className="lg:col-span-5 flex flex-col gap-4">
            {/* Cartão do Time da Casa (ou Único no Campeonato) */}
            <div className="retro-box-gold p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <PixelCrest club={homeClub} size={46} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-bold text-yellow-300">
                        {isSinglePick ? 'SEU CLUBE NA COPA' : 'MANDANTE · JOGADOR 1'}
                      </p>
                      {isTwoPlayer && (
                        <button
                          type="button"
                          onClick={() => {
                            retroAudio.playConfirm();
                            setP1Ready((prev) => !prev);
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                            p1Ready
                              ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                              : 'bg-[#0b1936] text-yellow-200 border-yellow-400/60 hover:bg-yellow-400/20'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{p1Ready ? 'PRONTO' : 'CONFIRMAR P1'}</span>
                        </button>
                      )}
                    </div>
                    <h2 className="font-pixel text-sm text-white">{homeClub.name}</h2>
                    <p className="text-xs text-slate-400">{homeClub.division} · Uniforme Titular</p>
                  </div>
                </div>
                <PixelJersey kit={resolvedKits.homeKit} size={46} />
              </div>

              <div className="space-y-1.5 mb-3">
                <StatBar label="ATA" value={homeClub.stats.attack} color="#ef4444" />
                <StatBar label="DEF" value={homeClub.stats.defense} color="#3b82f6" />
                <StatBar label="VEL" value={homeClub.stats.speed} color="#22c55e" />
              </div>

              <div className="border-t border-[#2b4a87] pt-2.5">
                {mode !== 'PENALTIES' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-yellow-300 flex items-center gap-1">
                      <LayoutGrid className="w-3 h-3" />
                      FORMAÇÃO:
                    </span>
                    <div className="flex items-center gap-1">
                      {FORMATION_LIST.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            retroAudio.playCursor();
                            setHomeFormation(f.id);
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-bold border cursor-pointer ${
                            homeFormation === f.id
                              ? 'bg-yellow-400 text-slate-950 border-white'
                              : 'bg-[#081329] text-slate-300 border-[#28457d] hover:border-yellow-400'
                          }`}
                          title={f.description}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold text-slate-400">
                    12 TITULARES 2026 (12×12)
                  </p>
                  <span className="text-[10px] font-bold text-emerald-300">
                    +{homeClub.bench.length} reservas
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                  {homeClub.squad.map((p, idx) => (
                    <div key={`${homeClub.id}-${idx}-${p.number}-${p.name}`} className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-yellow-400 w-4 tabular-nums text-right">{p.number}</span>
                      <span className={`text-[9px] font-bold w-6 ${getRoleBadgeClass(p.role)}`}>
                        {getRoleShortLabel(p.role)}
                      </span>
                      <span className="text-slate-100 truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cartão do Visitante (Amistoso / Pênaltis) */}
            {!isSinglePick && (
              <div className="retro-box p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <PixelCrest club={awayClub} size={46} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold text-sky-300">
                          VISITANTE · {isTwoPlayer ? 'JOGADOR 2' : 'CPU'}
                        </p>
                        {isTwoPlayer && (
                          <button
                            type="button"
                            onClick={() => {
                              retroAudio.playConfirm();
                              setP2Ready((prev) => !prev);
                            }}
                            className={`px-1.5 py-0.5 text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                              p2Ready
                                ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                                : 'bg-[#0b1936] text-sky-200 border-sky-400/60 hover:bg-sky-400/20'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{p2Ready ? 'PRONTO' : 'CONFIRMAR P2'}</span>
                          </button>
                        )}
                      </div>
                      <h2 className="font-pixel text-sm text-white">{awayClub.name}</h2>
                      <p className="text-xs text-slate-400">
                        {awayClub.division} ·{' '}
                        {resolvedKits.awayUsedReserve ? 'Uniforme Reserva (Auto)' : 'Uniforme Titular'}
                      </p>
                    </div>
                  </div>
                  <PixelJersey kit={resolvedKits.awayKit} size={46} />
                </div>

                {resolvedKits.awayUsedReserve && (
                  <div className="mb-3 px-2.5 py-1.5 bg-[#0c1d3d] border border-yellow-500/60 flex items-center gap-2 text-[11px] text-yellow-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Cores parecidas detectadas — uniforme reserva ativado automaticamente.</span>
                  </div>
                )}

                <div className="space-y-1.5 mb-3">
                  <StatBar label="ATA" value={awayClub.stats.attack} color="#ef4444" />
                  <StatBar label="DEF" value={awayClub.stats.defense} color="#3b82f6" />
                  <StatBar label="VEL" value={awayClub.stats.speed} color="#22c55e" />
                </div>

                <div className="border-t border-[#2b4a87] pt-2.5">
                  {mode !== 'PENALTIES' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold text-sky-300 flex items-center gap-1">
                        <LayoutGrid className="w-3 h-3" />
                        FORMAÇÃO:
                      </span>
                      <div className="flex items-center gap-1">
                        {FORMATION_LIST.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              retroAudio.playCursor();
                              setAwayFormation(f.id);
                            }}
                            className={`px-1.5 py-0.5 text-[10px] font-bold border cursor-pointer ${
                              awayFormation === f.id
                                ? 'bg-sky-400 text-slate-950 border-white'
                                : 'bg-[#081329] text-slate-300 border-[#28457d] hover:border-sky-400'
                            }`}
                            title={f.description}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-slate-400">12 TITULARES 2026</p>
                    <span className="text-[10px] font-bold text-sky-300">
                      +{awayClub.bench.length} reservas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                    {awayClub.squad.map((p, idx) => (
                      <div key={`${awayClub.id}-${idx}-${p.number}-${p.name}`} className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-sky-300 w-4 tabular-nums text-right">{p.number}</span>
                        <span className={`text-[9px] font-bold w-6 ${getRoleBadgeClass(p.role)}`}>
                          {getRoleShortLabel(p.role)}
                        </span>
                        <span className="text-slate-100 truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botão Principal de Início */}
            <button
              type="button"
              onClick={handleConfirm}
              className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white py-4 px-6 font-pixel text-xs sm:text-sm flex items-center justify-center gap-3 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {mode === 'TOURNAMENT'
                  ? 'INICIAR COPA 2026'
                  : mode === 'PENALTIES'
                    ? 'IR PARA AS COBRANÇAS'
                    : isTwoPlayer && p1Ready && p2Ready
                      ? 'P1 & P2 PRONTOS · ENTRAR EM CAMPO!'
                      : 'ENTRAR EM CAMPO'}
              </span>
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};
