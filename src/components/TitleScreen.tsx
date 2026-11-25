import React, { useEffect, useState } from 'react';
import {
  Gamepad2,
  Keyboard,
  Maximize2,
  Mic,
  Minimize2,
  Music,
  Square,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Play,
  Target,
} from 'lucide-react';
import { BroadcastSpeaker, MusicTrack, retroAudio } from '../audio/retroAudio';
import { getClubById } from '../data/clubs';
import { GamepadStatus, InputManager } from '../engine/inputManager';
import { Difficulty, GameMode, TournamentState } from '../types/game';
import { PixelCrest } from './PixelCrest';
import neymarStarsHeroImg from '../assets/images/neymar_stars_hero_1795509833014.jpg';

interface TitleScreenProps {
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  onSelectMode: (mode: GameMode) => void;
  savedTournament: TournamentState | null;
  onResumeTournament: () => void;
  muted: boolean;
  onToggleMute: () => void;
  musicTrack: MusicTrack;
  onToggleMusicTrack: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  difficulty,
  onChangeDifficulty,
  onSelectMode,
  savedTournament,
  onResumeTournament,
  muted,
  onToggleMute,
  musicTrack,
  onToggleMusicTrack,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [showControls, setShowControls] = useState(false);
  const [showBooth, setShowBooth] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<BroadcastSpeaker | 'duo' | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [padStatus, setPadStatus] = useState<GamepadStatus>({
    p1Connected: false,
    p2Connected: false,
    p1Name: '',
    p2Name: '',
  });

  useEffect(() => {
    const mgr = new InputManager();
    const check = () => setPadStatus(mgr.getGamepadStatus());
    check();
    const id = window.setInterval(check, 800);
    return () => {
      window.clearInterval(id);
      retroAudio.stopNarration();
    };
  }, []);

  const handlePreviewVoice = (target: BroadcastSpeaker | 'duo') => {
    retroAudio.unlock();
    if (muted) {
      onToggleMute();
    }
    setPreviewTarget(target);
    retroAudio.previewBoothVoice(target, (st) => {
      setPreviewState(st);
      if (st === 'idle') {
        setPreviewTarget(null);
      }
    });
  };

  const handleStopPreview = () => {
    retroAudio.stopNarration();
    setPreviewState('idle');
    setPreviewTarget(null);
  };

  const handleModeClick = (mode: GameMode) => {
    retroAudio.unlock();
    retroAudio.playConfirm();
    onSelectMode(mode);
  };

  const handleDifficulty = (d: Difficulty) => {
    retroAudio.unlock();
    retroAudio.playCursor();
    onChangeDifficulty(d);
  };

  const savedClub = savedTournament ? getClubById(savedTournament.userClubId) : null;

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between relative overflow-hidden bg-[#081124]"
      onClick={() => retroAudio.unlock()}
    >
      {/* Imagem de fundo atmosférica de estádio com Neymar e craques brasileiros */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-22 bg-cover bg-center"
        style={{
          backgroundImage: `url(${neymarStarsHeroImg})`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#081124]/80 via-[#081124]/75 to-[#081124]/95"
      />

      {/* Fundo retrô de gramado em faixas sutil no horizonte */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #2e8b3c 0px, #2e8b3c 48px, #226b2d 48px, #226b2d 96px)',
          maskImage: 'linear-gradient(to top, black 10%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 100%)',
        }}
      />

      {/* Barra Superior */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-slate-300 font-semibold tracking-wide">
          <span>TEMPORADA 2026</span>
          <span aria-hidden="true">·</span>
          <span>24 CLUBES</span>
          <span aria-hidden="true">·</span>
          <span>60 FPS · 12×12 COMPLETO</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <button
            type="button"
            onClick={onToggleMusicTrack}
            className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-slate-100 px-3 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Alternar música entre País do Futebol e Música da Copa"
          >
            <Music className="w-4 h-4 text-yellow-400" />
            <span>
              {musicTrack === 'pais_do_futebol' ? 'País do Futebol · MC Guimê' : 'Música da Copa'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-slate-100 px-3 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Ativar tela cheia'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-sky-300" />
            ) : (
              <Maximize2 className="w-4 h-4 text-yellow-400" />
            )}
            <span className="hidden sm:inline">{isFullscreen ? 'Janela' : 'Tela Cheia'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              retroAudio.unlock();
              retroAudio.playCursor();
              setShowBooth((v) => !v);
            }}
            className={`retro-btn px-3.5 py-2 text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              showBooth
                ? 'bg-yellow-400 text-slate-950 border-white'
                : 'bg-[#13254a] hover:bg-[#1a3366] text-slate-100'
            }`}
          >
            <Mic className={`w-4 h-4 ${showBooth ? 'text-slate-950' : 'text-yellow-400'}`} />
            <span>{showBooth ? 'Ocultar Cabine' : 'Testar Vozes'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              retroAudio.unlock();
              retroAudio.playCursor();
              setShowControls((v) => !v);
            }}
            className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-slate-100 px-3.5 py-2 text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Keyboard className="w-4 h-4 text-yellow-400" />
            <span>{showControls ? 'Ocultar Controles' : 'Controles'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              retroAudio.unlock();
              onToggleMute();
            }}
            className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-slate-100 px-3.5 py-2 text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{muted ? 'Mudo' : 'Áudio Ligado'}</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex flex-col items-center text-center">
        {/* Emblema / Título Estilo Cartucho SNES */}
        <div className="mb-5">
          <p className="font-pixel text-[11px] sm:text-xs text-emerald-400 tracking-widest mb-2.5">
            JOGO CRIADO POR EFATÁ GAMESTUDIO · 24 CLUBES · 60 FPS
          </p>
          <h1
            className="font-pixel text-2xl sm:text-4xl lg:text-5xl leading-tight text-yellow-400"
            style={{
              textShadow: '4px 4px 0px #b91c1c, 7px 7px 0px #040914',
              textWrap: 'balance',
            }}
          >
            EFATÁ
            <br />
            <span className="text-white">SOCCER 26</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Campo gigante 12×12 com zagueiros, laterais, meias e atacantes, formações táticas,
            substituições ao vivo, clima (sol, chuva, neve), dia e noite, fogos no gol e cabine com
            Galvão Bueno, Casagrande, Ronaldo e Craque Neto.
          </p>
        </div>

        {/* Capa Principal com Foto do Neymar Jr. e Craques do Futebol Brasileiro */}
        <div className="w-full max-w-3xl mb-6 retro-box-gold overflow-hidden relative group shadow-2xl">
          <div className="relative w-full h-48 sm:h-64 overflow-hidden bg-[#060d1c]">
            <img
              src={neymarStarsHeroImg}
              alt="Neymar Jr. e craques dos clubes brasileiros em ação no estádio"
              className="w-full h-full object-cover object-top sm:object-center transition-transform duration-700 group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#081124] via-[#081124]/20 to-transparent"
            />
            <div className="absolute top-3 left-3 bg-[#081124]/90 border-2 border-yellow-400 px-2.5 py-1 text-[10px] font-pixel text-yellow-300 tracking-wider">
              CAPA OFICIAL 2026
            </div>
            <div className="absolute bottom-3 inset-x-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-left">
              <div>
                <p className="font-pixel text-[10px] sm:text-xs text-yellow-400 drop-shadow">
                  NEYMAR JR. &amp; CRAQUES DO FUTEBOL BRASILEIRO
                </p>
                <p className="text-xs text-slate-200 font-semibold drop-shadow">
                  Santos · Flamengo · Palmeiras · Corinthians · São Paulo e todos os 24 clubes em campo!
                </p>
              </div>
              <span className="self-start sm:self-auto bg-emerald-600/95 border border-emerald-300 text-white text-[10px] font-bold px-2.5 py-1 whitespace-nowrap">
                PAÍS DO FUTEBOL · 12×12
              </span>
            </div>
          </div>
        </div>

        {/* Grade Principal de Modos */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button
            type="button"
            onClick={() => handleModeClick('FRIENDLY')}
            className="retro-btn bg-[#142a57] hover:bg-[#1b3a78] p-5 text-left flex flex-col justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <Play className="w-6 h-6 text-yellow-400" />
              <span className="text-xs font-bold text-emerald-400">1P / 2P ARCADE</span>
            </div>
            <div>
              <h2 className="font-pixel text-sm text-white group-hover:text-yellow-300">
                AMISTOSO
              </h2>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                1P vs CPU ou 2P Fliperama (Teclado, Arcade USB ou Tela Touch 2P) com todos os 24 clubes.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeClick('TOURNAMENT')}
            className="retro-btn bg-[#16315e] hover:bg-[#1e4280] border-yellow-400 p-5 text-left flex flex-col justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-300">COPA 24</span>
            </div>
            <div>
              <h2 className="font-pixel text-sm text-yellow-300 group-hover:text-white">
                CAMPEONATO
              </h2>
              <p className="mt-2 text-xs text-slate-200 leading-relaxed">
                6 grupos de 4 clubes + Mata-Mata de Oitavas à Final com salvamento automático.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeClick('PENALTIES')}
            className="retro-btn bg-[#142a57] hover:bg-[#1b3a78] p-5 text-left flex flex-col justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <Target className="w-6 h-6 text-yellow-400" />
              <span className="text-xs font-bold text-sky-300">5 + ALT</span>
            </div>
            <div>
              <h2 className="font-pixel text-sm text-white group-hover:text-yellow-300">
                PÊNALTIS
              </h2>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Disputa direta de 5 cobranças + alternadas com mira, força e defesa do goleiro.
              </p>
            </div>
          </button>
        </div>

        {/* Botão de Retomar Campeonato Salvo (localStorage) */}
        {savedTournament && savedClub && (
          <div className="w-full max-w-3xl retro-box-gold px-5 py-3.5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <PixelCrest club={savedClub} size={36} />
              <div>
                <p className="text-xs font-bold text-yellow-300">CAMPEONATO SALVO ENCONTRADO</p>
                <p className="text-sm font-bold text-white">
                  {savedClub.name} ·{' '}
                  {savedTournament.phase === 'GROUPS'
                    ? `Fase de Grupos (Rodada ${savedTournament.currentGroupRound}/3)`
                    : savedTournament.phase === 'KNOCKOUT'
                      ? `Mata-Mata (${savedTournament.currentKnockoutStage})`
                      : 'Temporada Encerrada'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                retroAudio.unlock();
                retroAudio.playConfirm();
                onResumeTournament();
              }}
              className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white font-pixel text-[11px] px-4 py-2.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              CONTINUAR COPA
            </button>
          </div>
        )}

        {/* Seletor de Dificuldade da CPU */}
        <div className="w-full max-w-3xl retro-box px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs font-bold text-slate-400">NÍVEL DA CPU E GOLEIROS</p>
            <p className="text-sm font-semibold text-white">
              Ajuste o ritmo de marcação, passes e reflexos da IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['FACIL', 'MEDIO', 'DIFICIL'] as Difficulty[]).map((level) => {
              const active = difficulty === level;
              const label = level === 'FACIL' ? 'Fácil' : level === 'MEDIO' ? 'Médio' : 'Difícil';
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleDifficulty(level)}
                  className={`px-4 py-2 text-xs font-bold border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-yellow-400 text-slate-950 border-white'
                      : 'bg-[#0b1730] text-slate-300 border-[#2b4a87] hover:border-yellow-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel Expansível de Prévia da Cabine (Voice Design + Bate-Bola em Dupla) */}
        {showBooth && (
          <div className="w-full max-w-3xl mt-4 retro-box p-5 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#28457d]">
              <div>
                <h3 className="font-pixel text-[11px] text-yellow-400">
                  CABINE 100% MASCULINA · VOICE DESIGN
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  {previewState === 'loading'
                    ? 'Sintetizando voz de estúdio...'
                    : previewState === 'playing'
                      ? `No ar: ${
                          previewTarget === 'duo'
                            ? 'Bate-Bola Galvão Bueno + Craque Neto'
                            : previewTarget === 'casagrande'
                              ? 'Casagrande'
                              : previewTarget === 'ronaldo'
                                ? 'Ronaldo'
                                : previewTarget === 'neto'
                                  ? 'Craque Neto'
                                  : 'Galvão Bueno'
                        }`
                      : 'Clique em um integrante para ouvir a nova voz realista ou teste o bate-bola em dupla.'}
                </p>
              </div>
              {previewState !== 'idle' && (
                <button
                  type="button"
                  onClick={handleStopPreview}
                  className="retro-btn bg-[#381320] hover:bg-[#521c2e] border-red-400 text-red-100 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Parar</span>
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {(
                [
                  { id: 'galvao', name: 'Galvão Bueno', role: 'Narrador', accent: 'border-red-400 text-red-200' },
                  { id: 'casagrande', name: 'Casagrande', role: 'Comentarista', accent: 'border-amber-400 text-amber-200' },
                  { id: 'ronaldo', name: 'Ronaldo', role: 'Comentarista', accent: 'border-emerald-400 text-emerald-200' },
                  { id: 'neto', name: 'Craque Neto', role: 'Comentarista', accent: 'border-orange-400 text-orange-200' },
                ] as const
              ).map((member) => {
                const isActive = previewTarget === member.id && previewState !== 'idle';
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handlePreviewVoice(member.id)}
                    className={`px-3 py-2.5 text-left border-2 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-yellow-400 text-slate-950 border-white'
                        : `bg-[#0b1730] hover:bg-[#13264d] ${member.accent}`
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{member.name}</div>
                    <div className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                      {isActive && previewState === 'loading'
                        ? 'Carregando...'
                        : isActive
                          ? 'Falando...'
                          : member.role}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => handlePreviewVoice('duo')}
                className={`col-span-2 sm:col-span-1 px-3 py-2.5 text-left border-2 transition-colors cursor-pointer ${
                  previewTarget === 'duo' && previewState !== 'idle'
                    ? 'bg-yellow-400 text-slate-950 border-white'
                    : 'bg-[#16315e] hover:bg-[#1e4280] border-yellow-400 text-yellow-200'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Bate-Bola</span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    previewTarget === 'duo' && previewState !== 'idle'
                      ? 'text-slate-900 font-bold'
                      : 'text-slate-300'
                  }`}
                >
                  {previewTarget === 'duo' && previewState === 'loading'
                    ? 'Carregando...'
                    : previewTarget === 'duo' && previewState === 'playing'
                      ? 'No ar (2 vozes)'
                      : 'Galvão + Neto'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Painel Expansível de Controles */}
        {showControls && (
          <div className="w-full max-w-3xl mt-4 retro-box p-5 text-left grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <h3 className="font-pixel text-[11px] text-yellow-400 mb-2">JOGADOR 1 (TECLADO)</h3>
              <ul className="text-xs text-slate-200 space-y-1.5">
                <li><strong>Setas (ou WASD em 1P):</strong> Mover / Mirar</li>
                <li><strong>Z (segurar):</strong> Barra de Toque / Passe · Trocar</li>
                <li><strong>X (segurar):</strong> Barra de Chute / Cabeceio / Carrinho</li>
                <li><strong>V:</strong> Tomar bola / Pedalar (com posse)</li>
                <li><strong>C (segurar):</strong> Barra de Cruzamento / Lançamento</li>
                <li><strong>Shift (ou Espaço em 1P):</strong> Correr (Sprint)</li>
                <li><strong>1 / 2 / 3 / Tab:</strong> Câmera (TV / Perto / Ampla)</li>
                <li><strong>Esc / P:</strong> Pausar</li>
              </ul>
            </div>
            <div>
              <h3 className="font-pixel text-[11px] text-sky-400 mb-2">JOGADOR 2 (FLIPERAMA)</h3>
              <ul className="text-xs text-slate-200 space-y-1.5">
                <li><strong>W A S D:</strong> Mover / Mirar</li>
                <li><strong>F / U (segurar):</strong> Barra de Toque / Trocar</li>
                <li><strong>G / I (segurar):</strong> Barra de Chute / Carrinho</li>
                <li><strong>J / K:</strong> Tomar bola / Pedalar</li>
                <li><strong>H / O (segurar):</strong> Barra de Cruzamento / Lançar</li>
                <li><strong>Espaço / L:</strong> Correr (Sprint)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-pixel text-[11px] text-emerald-400 mb-2">FLIPERAMA USB / TOUCH 2P</h3>
              <ul className="text-xs text-slate-200 space-y-1.5">
                <li><strong>Manche / D-Pad:</strong> Mover 8 direções</li>
                <li><strong>Botão 1 (0):</strong> Passe / Trocar / Repor GK</li>
                <li><strong>Botão 2/3 (1/2):</strong> Chute / Carrinho</li>
                <li><strong>Botão 4 (3):</strong> Lançamento alto / Bico GK</li>
                <li><strong>Botão 5 (4):</strong> Tomar bola (bote limpo)</li>
                <li><strong>Botão 6 (5/7):</strong> Correr (Sprint)</li>
                <li><strong>2P Arcade (Topo):</strong> Manche 2P na tela</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé limpo com detecção de controles USB e crédito Efatá GameStudio */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-yellow-400" />
          <span>
            {padStatus.p1Connected
              ? `Gamepad P1 detectado${padStatus.p2Connected ? ' · Gamepad P2 detectado' : ''}`
              : 'Conecte até 2 controles USB / Arcade (Gamepad API pronta)'}
          </span>
        </div>
        <div className="font-pixel text-[9px] sm:text-[10px] text-yellow-300 tracking-wider">
          JOGO CRIADO POR EFATÁ GAMESTUDIO
        </div>
        <div className="text-slate-400 text-center sm:text-right">
          P1: Setas + Z / X / C / V / Shift · Câmeras: 1 / 2 / 3
        </div>
      </footer>
    </div>
  );
};
