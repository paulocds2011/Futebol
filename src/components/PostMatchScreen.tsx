import React from 'react';
import { Home, RotateCcw, Trophy, Target } from 'lucide-react';
import { retroAudio } from '../audio/retroAudio';
import { getClubById } from '../data/clubs';
import { MatchResult } from '../types/game';
import { PixelCrest } from './PixelCrest';

interface PostMatchScreenProps {
  result: MatchResult;
  onRematch: () => void;
  onContinueTournament?: () => void;
  onGoToKnockoutPenalties?: () => void;
  onBackToMenu: () => void;
}

const StatCompareRow: React.FC<{
  label: string;
  homeVal: number;
  awayVal: number;
  suffix?: string;
}> = ({ label, homeVal, awayVal, suffix = '' }) => {
  const total = Math.max(1, homeVal + awayVal);
  const homePct = Math.round((homeVal / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="tabular-nums text-yellow-300 w-14 text-left">
          {homeVal}
          {suffix}
        </span>
        <span className="text-slate-300 uppercase tracking-wide">{label}</span>
        <span className="tabular-nums text-sky-300 w-14 text-right">
          {awayVal}
          {suffix}
        </span>
      </div>
      <div className="h-2.5 w-full bg-[#081124] border border-[#2d4a84] flex overflow-hidden">
        <div className="h-full bg-yellow-400" style={{ width: `${homePct}%` }} />
        <div className="h-full bg-sky-400" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
};

export const PostMatchScreen: React.FC<PostMatchScreenProps> = ({
  result,
  onRematch,
  onContinueTournament,
  onGoToKnockoutPenalties,
  onBackToMenu,
}) => {
  const homeClub = getClubById(result.config.homeClubId);
  const awayClub = getClubById(result.config.awayClubId);

  const totalPoss = Math.max(
    1,
    result.stats.homePossessionTicks + result.stats.awayPossessionTicks
  );
  const homePoss = Math.round((result.stats.homePossessionTicks / totalPoss) * 100);
  const awayPoss = 100 - homePoss;

  const needsKnockoutPenalties =
    Boolean(result.config.knockoutTiebreak) &&
    result.homeScore === result.awayScore &&
    result.homePenalties === undefined;

  const headline = needsKnockoutPenalties
    ? 'EMPATE NO MATA-MATA — DECISÃO NOS PÊNALTIS!'
    : result.winner === 'home'
      ? `VITÓRIA DO ${homeClub.name.toUpperCase()}!`
      : result.winner === 'away'
        ? `VITÓRIA DO ${awayClub.name.toUpperCase()}!`
        : 'EMPATE EM CAMPO!';

  return (
    <div className="min-h-screen w-full bg-[#081124] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-3xl flex flex-col gap-5">
        {/* Placar Final */}
        <section className="retro-box-gold p-6 text-center">
          <p className="font-pixel text-[10px] text-emerald-400 mb-2">
            {result.config.tournamentRoundLabel ?? 'FIM DE PARTIDA · SÚMULA OFICIAL'}
          </p>

          <div className="flex items-center justify-center gap-6 sm:gap-10 my-4">
            <div className="flex flex-col items-center gap-2 w-28">
              <PixelCrest club={homeClub} size={58} />
              <span className="font-pixel text-xs text-white">{homeClub.shortName}</span>
              <span className="text-xs text-slate-300">{homeClub.name}</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="font-pixel text-3xl sm:text-5xl text-yellow-400 tabular-nums">
                {result.homeScore} <span className="text-slate-500">×</span> {result.awayScore}
              </div>
              {result.homePenalties !== undefined && result.awayPenalties !== undefined && (
                <p className="mt-2 font-pixel text-xs text-emerald-300 tabular-nums">
                  PÊNALTIS: {result.homePenalties} × {result.awayPenalties}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 w-28">
              <PixelCrest club={awayClub} size={58} />
              <span className="font-pixel text-xs text-white">{awayClub.shortName}</span>
              <span className="text-xs text-slate-300">{awayClub.name}</span>
            </div>
          </div>

          <h1 className="font-pixel text-xs sm:text-sm text-white mt-2">{headline}</h1>
        </section>

        {/* Gols e Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Artilheiros da Partida */}
          <section className="retro-box p-5">
            <h2 className="font-pixel text-xs text-yellow-400 mb-3 pb-2 border-b border-[#28447d]">
              GOLS DA PARTIDA
            </h2>
            {result.stats.goals.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Placar zerado — jogo pegado nas defesas!
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {result.stats.goals.map((g, i) => {
                  const club = g.team === 'home' ? homeClub : awayClub;
                  return (
                    <li
                      key={`${g.scorerName}-${g.minute}-${i}`}
                      className="flex items-center justify-between bg-[#0c1a36] px-3 py-2 border border-[#243f75]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-pixel text-[9px] ${
                            g.team === 'home' ? 'text-yellow-400' : 'text-sky-300'
                          }`}
                        >
                          {club.shortName}
                        </span>
                        <span className="font-bold text-white">
                          #{g.scorerNumber} {g.scorerName}
                        </span>
                      </div>
                      <span className="font-bold tabular-nums text-emerald-400">{g.minute}&apos;</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Estatísticas Técnicas */}
          <section className="retro-box p-5 space-y-3">
            <h2 className="font-pixel text-xs text-yellow-400 mb-3 pb-2 border-b border-[#28447d]">
              ESTATÍSTICAS
            </h2>
            <StatCompareRow label="Posse de Bola" homeVal={homePoss} awayVal={awayPoss} suffix="%" />
            <StatCompareRow
              label="Chutes Totais"
              homeVal={result.stats.homeShots}
              awayVal={result.stats.awayShots}
            />
            <StatCompareRow
              label="Chutes no Gol"
              homeVal={result.stats.homeShotsOnTarget}
              awayVal={result.stats.awayShotsOnTarget}
            />
            <StatCompareRow
              label="Defesas Goleiro"
              homeVal={result.stats.homeSaves}
              awayVal={result.stats.awaySaves}
            />
            <StatCompareRow
              label="Faltas"
              homeVal={result.stats.homeFouls}
              awayVal={result.stats.awayFouls}
            />
          </section>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {needsKnockoutPenalties && onGoToKnockoutPenalties ? (
            <button
              type="button"
              onClick={() => {
                retroAudio.playConfirm();
                onGoToKnockoutPenalties();
              }}
              className="retro-btn bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-pixel text-xs px-6 py-3.5 flex items-center gap-2 cursor-pointer"
            >
              <Target className="w-4 h-4" />
              <span>DECIDIR NOS PÊNALTIS</span>
            </button>
          ) : result.config.mode === 'TOURNAMENT' && onContinueTournament ? (
            <button
              type="button"
              onClick={() => {
                retroAudio.playConfirm();
                onContinueTournament();
              }}
              className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white font-pixel text-xs px-6 py-3.5 flex items-center gap-2 cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>AVANÇAR NA COPA</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                retroAudio.playConfirm();
                onRematch();
              }}
              className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white font-pixel text-xs px-6 py-3.5 flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>JOGAR NOVAMENTE</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              retroAudio.playCancel();
              onBackToMenu();
            }}
            className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-white font-pixel text-xs px-5 py-3.5 flex items-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>MENU PRINCIPAL</span>
          </button>
        </div>

        <p className="text-center font-pixel text-[9px] text-yellow-300/90 tracking-wider pt-1">
          EFATÁ SOCCER 26 · JOGO CRIADO POR EFATÁ GAMESTUDIO
        </p>
      </div>
    </div>
  );
};
