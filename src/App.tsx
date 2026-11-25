import { useCallback, useEffect, useState } from 'react';
import { MusicTrack, retroAudio } from './audio/retroAudio';
import { MatchArena } from './components/MatchArena';
import { PenaltyArena } from './components/PenaltyArena';
import { PostMatchScreen } from './components/PostMatchScreen';
import { TeamSelectScreen } from './components/TeamSelectScreen';
import { TitleScreen } from './components/TitleScreen';
import { TournamentHub } from './components/TournamentHub';
import { PenaltyResult } from './engine/penaltyEngine';
import {
  clearSavedTournament,
  createNewTournament,
  getUserNextMatch,
  loadSavedTournament,
  recordUserMatchAndAdvance,
  simulateRemainingTournament,
} from './engine/tournamentEngine';
import {
  Difficulty,
  FormationId,
  GameMode,
  GameScreen,
  MatchConfig,
  MatchDurationMinutes,
  MatchResult,
  PlayerControlMode,
  TimeOfDay,
  TournamentState,
  WeatherType,
} from './types/game';

interface ActivePenaltyContext {
  homeClubId: string;
  awayClubId: string;
  controlMode: PlayerControlMode;
  titleLabel: string;
  /** Se for desempate de mata-mata, guarda o resultado do tempo normal */
  knockoutBaseResult?: MatchResult;
  knockoutMatchId?: string;
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [selectedMode, setSelectedMode] = useState<GameMode>('FRIENDLY');
  const [difficulty, setDifficulty] = useState<Difficulty>('FACIL');
  const [preferredWeather, setPreferredWeather] = useState<WeatherType>('SOL');
  const [preferredTimeOfDay, setPreferredTimeOfDay] = useState<TimeOfDay>('DIA');
  const [preferredFormation, setPreferredFormation] = useState<FormationId>('4-4-3');
  const [muted, setMuted] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrack>('pais_do_futebol');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  const [tournament, setTournament] = useState<TournamentState | null>(() =>
    loadSavedTournament()
  );
  const [activeMatchConfig, setActiveMatchConfig] = useState<MatchConfig | null>(null);
  const [activeTournamentMatchId, setActiveTournamentMatchId] = useState<string | null>(null);
  const [lastMatchResult, setLastMatchResult] = useState<MatchResult | null>(null);
  const [penaltyContext, setPenaltyContext] = useState<ActivePenaltyContext | null>(null);

  // Ativa Tela Cheia automaticamente no primeiro toque, clique ou tecla pressionada ao abrir o jogo
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);

    let attempted = false;
    const triggerInitialFullscreen = () => {
      if (attempted) return;
      attempted = true;
      retroAudio.unlock();

      window.removeEventListener('pointerdown', triggerInitialFullscreen, true);
      window.removeEventListener('keydown', triggerInitialFullscreen, true);

      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Alguns navegadores/iframes restringem fullscreen nativo; o layout já ocupa 100% da janela
        });
      }
    };

    window.addEventListener('pointerdown', triggerInitialFullscreen, true);
    window.addEventListener('keydown', triggerInitialFullscreen, true);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('pointerdown', triggerInitialFullscreen, true);
      window.removeEventListener('keydown', triggerInitialFullscreen, true);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    retroAudio.unlock();
    retroAudio.playCursor();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ambiente iframe pode restringir Fullscreen nativo
    }
  }, []);

  // Controla a trilha sonora contínua ("País do Futebol" nos menus, pré-jogo até o apito inicial e tela pós-jogo)
  useEffect(() => {
    if (
      screen === 'TITLE' ||
      screen === 'TEAM_SELECT' ||
      screen === 'TOURNAMENT_HUB' ||
      screen === 'POST_MATCH' ||
      screen === 'MATCH'
    ) {
      retroAudio.startMenuMusic(musicTrack);
    } else {
      retroAudio.stopMenuMusic();
    }
  }, [screen, musicTrack]);

  const handleToggleMusicTrack = useCallback(() => {
    retroAudio.unlock();
    retroAudio.playCursor();
    const next = retroAudio.toggleMenuMusicTrack();
    setMusicTrack(next);
  }, []);

  const handleToggleMute = useCallback(() => {
    const nowMuted = retroAudio.toggleMute();
    setMuted(nowMuted);
  }, []);

  const handleSelectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    setScreen('TEAM_SELECT');
  };

  const handleStartFriendly = (config: MatchConfig) => {
    if (config.weather) setPreferredWeather(config.weather);
    if (config.timeOfDay) setPreferredTimeOfDay(config.timeOfDay);
    if (config.homeFormation) setPreferredFormation(config.homeFormation);
    setActiveTournamentMatchId(null);
    setActiveMatchConfig(config);
    setScreen('MATCH');
  };

  const handleStartTournament = (
    clubId: string,
    duration: MatchDurationMinutes,
    opts?: { weather?: WeatherType; timeOfDay?: TimeOfDay; formation?: FormationId }
  ) => {
    if (opts?.weather) setPreferredWeather(opts.weather);
    if (opts?.timeOfDay) setPreferredTimeOfDay(opts.timeOfDay);
    if (opts?.formation) setPreferredFormation(opts.formation);
    const fresh = createNewTournament(clubId, difficulty, duration);
    setTournament(fresh);
    setScreen('TOURNAMENT_HUB');
  };

  const handleStartPenalties = (
    homeClubId: string,
    awayClubId: string,
    controlMode: PlayerControlMode
  ) => {
    setPenaltyContext({
      homeClubId,
      awayClubId,
      controlMode,
      titleLabel: 'DISPUTA DE PÊNALTIS',
    });
    setScreen('PENALTY_SHOOTOUT');
  };

  const handlePlayNextTournamentMatch = () => {
    if (!tournament) return;
    const next = getUserNextMatch(tournament);
    if (!next) return;

    // Garante que o clube do usuário fique sempre sob controle do P1 (home no engine = P1!)
    // Se o usuário for o visitante no sorteio, inverte apenas na configuração da engine e mapeia de volta ao salvar.
    const userIsHomeInFixture = next.homeId === tournament.userClubId;
    const engineHomeId = userIsHomeInFixture ? next.homeId : next.awayId;
    const engineAwayId = userIsHomeInFixture ? next.awayId : next.homeId;

    setActiveTournamentMatchId(next.matchId);
    setActiveMatchConfig({
      mode: 'TOURNAMENT',
      controlMode: '1P_CPU',
      homeClubId: engineHomeId,
      awayClubId: engineAwayId,
      durationMinutes: tournament.durationMinutes,
      difficulty: tournament.difficulty,
      knockoutTiebreak: next.isKnockout,
      tournamentRoundLabel: next.label,
      weather: preferredWeather,
      timeOfDay: preferredTimeOfDay,
      homeFormation: preferredFormation,
      awayFormation: '4-4-3',
    });
    setScreen('MATCH');
  };

  const handleFinishMatch = useCallback((result: MatchResult) => {
    setLastMatchResult(result);
    setScreen('POST_MATCH');
  }, []);

  const commitTournamentMatchResult = (
    result: MatchResult,
    homePen?: number,
    awayPen?: number
  ) => {
    if (!tournament || !activeTournamentMatchId) {
      setScreen('TOURNAMENT_HUB');
      return;
    }

    const next = getUserNextMatch(tournament);
    // Se invertemos mandante para manter P1 sempre controlando o clube do usuário, desfazemos na gravação da tabela
    const userWasOriginalHome = next ? next.homeId === tournament.userClubId : true;
    const finalHomeScore = userWasOriginalHome ? result.homeScore : result.awayScore;
    const finalAwayScore = userWasOriginalHome ? result.awayScore : result.homeScore;
    const finalHomePen =
      homePen !== undefined && awayPen !== undefined
        ? userWasOriginalHome
          ? homePen
          : awayPen
        : undefined;
    const finalAwayPen =
      homePen !== undefined && awayPen !== undefined
        ? userWasOriginalHome
          ? awayPen
          : homePen
        : undefined;

    const updated = recordUserMatchAndAdvance(
      tournament,
      activeTournamentMatchId,
      finalHomeScore,
      finalAwayScore,
      finalHomePen,
      finalAwayPen
    );
    setTournament(updated);
    setActiveTournamentMatchId(null);
    setScreen('TOURNAMENT_HUB');
  };

  const handleGoToKnockoutPenalties = () => {
    if (!lastMatchResult) return;
    setPenaltyContext({
      homeClubId: lastMatchResult.config.homeClubId,
      awayClubId: lastMatchResult.config.awayClubId,
      controlMode: lastMatchResult.config.controlMode,
      titleLabel: `${lastMatchResult.config.tournamentRoundLabel ?? 'MATA-MATA'} · PÊNALTIS`,
      knockoutBaseResult: lastMatchResult,
      knockoutMatchId: activeTournamentMatchId ?? undefined,
    });
    setScreen('PENALTY_SHOOTOUT');
  };

  const handlePenaltyComplete = (penRes: PenaltyResult) => {
    if (penaltyContext?.knockoutBaseResult) {
      const merged: MatchResult = {
        ...penaltyContext.knockoutBaseResult,
        homePenalties: penRes.homeScore,
        awayPenalties: penRes.awayScore,
        winner: penRes.winner,
      };
      commitTournamentMatchResult(merged, penRes.homeScore, penRes.awayScore);
      setPenaltyContext(null);
      return;
    }

    // Modo Pênaltis avulso -> retorna ao menu principal
    setPenaltyContext(null);
    setScreen('TITLE');
  };

  return (
    <div className="min-h-screen w-full bg-[#081124] text-slate-100">
      {screen === 'TITLE' && (
        <TitleScreen
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onSelectMode={handleSelectMode}
          savedTournament={tournament}
          onResumeTournament={() => setScreen('TOURNAMENT_HUB')}
          muted={muted}
          onToggleMute={handleToggleMute}
          musicTrack={musicTrack}
          onToggleMusicTrack={handleToggleMusicTrack}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {screen === 'TEAM_SELECT' && (
        <TeamSelectScreen
          mode={selectedMode}
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onBack={() => setScreen('TITLE')}
          onStartFriendly={handleStartFriendly}
          onStartTournament={handleStartTournament}
          onStartPenalties={handleStartPenalties}
        />
      )}

      {screen === 'TOURNAMENT_HUB' && tournament && (
        <TournamentHub
          tournament={tournament}
          onPlayNextMatch={handlePlayNextTournamentMatch}
          onSimulateRest={() => {
            const finished = simulateRemainingTournament(tournament);
            setTournament(finished);
          }}
          onResetTournament={() => {
            clearSavedTournament();
            setTournament(null);
            setSelectedMode('TOURNAMENT');
            setScreen('TEAM_SELECT');
          }}
          onBackToTitle={() => setScreen('TITLE')}
        />
      )}

      {screen === 'MATCH' && activeMatchConfig && (
        <MatchArena
          config={activeMatchConfig}
          muted={muted}
          onToggleMute={handleToggleMute}
          onFinishMatch={handleFinishMatch}
          onExitMatch={() =>
            setScreen(activeMatchConfig.mode === 'TOURNAMENT' ? 'TOURNAMENT_HUB' : 'TITLE')
          }
        />
      )}

      {screen === 'PENALTY_SHOOTOUT' && penaltyContext && (
        <PenaltyArena
          homeClubId={penaltyContext.homeClubId}
          awayClubId={penaltyContext.awayClubId}
          controlMode={penaltyContext.controlMode}
          difficulty={difficulty}
          titleLabel={penaltyContext.titleLabel}
          muted={muted}
          onToggleMute={handleToggleMute}
          onComplete={handlePenaltyComplete}
          onExit={() =>
            setScreen(penaltyContext.knockoutBaseResult ? 'TOURNAMENT_HUB' : 'TITLE')
          }
        />
      )}

      {screen === 'POST_MATCH' && lastMatchResult && (
        <PostMatchScreen
          result={lastMatchResult}
          onRematch={() => {
            setActiveMatchConfig({ ...lastMatchResult.config });
            setScreen('MATCH');
          }}
          onContinueTournament={
            lastMatchResult.config.mode === 'TOURNAMENT'
              ? () => commitTournamentMatchResult(lastMatchResult)
              : undefined
          }
          onGoToKnockoutPenalties={
            lastMatchResult.config.knockoutTiebreak &&
            lastMatchResult.homeScore === lastMatchResult.awayScore
              ? handleGoToKnockoutPenalties
              : undefined
          }
          onBackToMenu={() => setScreen('TITLE')}
        />
      )}
    </div>
  );
}
