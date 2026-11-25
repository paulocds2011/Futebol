import React, { useState } from 'react';
import { ArrowLeft, Play, Trophy, RotateCcw, FastForward } from 'lucide-react';
import { retroAudio } from '../audio/retroAudio';
import { getClubById } from '../data/clubs';
import {
  computeGroupStandings,
  getUserNextMatch,
} from '../engine/tournamentEngine';
import { KnockoutMatch, KnockoutStageKey, TournamentState } from '../types/game';
import { PixelCrest } from './PixelCrest';

interface TournamentHubProps {
  tournament: TournamentState;
  onPlayNextMatch: () => void;
  onSimulateRest: () => void;
  onResetTournament: () => void;
  onBackToTitle: () => void;
}

const STAGE_TITLES: Record<KnockoutStageKey, string> = {
  R16: 'OITAVAS',
  QF: 'QUARTAS',
  SF: 'SEMIFINAL',
  FINAL: 'FINAL',
};

export const TournamentHub: React.FC<TournamentHubProps> = ({
  tournament,
  onPlayNextMatch,
  onSimulateRest,
  onResetTournament,
  onBackToTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'BRACKET'>(
    tournament.phase === 'GROUPS' ? 'GROUPS' : 'BRACKET'
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const userClub = getClubById(tournament.userClubId);
  const nextMatch = getUserNextMatch(tournament);
  const championClub = tournament.championId ? getClubById(tournament.championId) : null;

  const renderKnockoutCard = (m: KnockoutMatch) => {
    const home = m.homeId ? getClubById(m.homeId) : null;
    const away = m.awayId ? getClubById(m.awayId) : null;
    const isUser = m.homeId === tournament.userClubId || m.awayId === tournament.userClubId;

    return (
      <div
        key={m.id}
        className={`border-2 p-2.5 text-xs ${
          isUser ? 'border-yellow-400 bg-[#193366]' : 'border-[#2a4782] bg-[#0d1c3a]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 py-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {home ? <PixelCrest club={home} size={18} /> : <span className="w-4 h-4 bg-slate-800 inline-block" />}
            <span
              className={`truncate font-bold ${
                m.winnerId && home && m.winnerId === home.id ? 'text-yellow-300' : 'text-slate-200'
              }`}
            >
              {home ? home.shortName : 'A definir'}
            </span>
          </div>
          <span className="font-bold tabular-nums text-white">
            {m.played ? m.homeScore : '-'}
            {m.played && m.homePenalties !== undefined ? ` (${m.homePenalties})` : ''}
          </span>
        </div>

        <div className="border-t border-[#223b6e] my-1" />

        <div className="flex items-center justify-between gap-2 py-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {away ? <PixelCrest club={away} size={18} /> : <span className="w-4 h-4 bg-slate-800 inline-block" />}
            <span
              className={`truncate font-bold ${
                m.winnerId && away && m.winnerId === away.id ? 'text-yellow-300' : 'text-slate-200'
              }`}
            >
              {away ? away.shortName : 'A definir'}
            </span>
          </div>
          <span className="font-bold tabular-nums text-white">
            {m.played ? m.awayScore : '-'}
            {m.played && m.awayPenalties !== undefined ? ` (${m.awayPenalties})` : ''}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#081124] px-4 sm:px-6 py-5">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-5">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#233d70] pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                retroAudio.playCancel();
                onBackToTitle();
              }}
              className="retro-btn bg-[#13254a] hover:bg-[#1a3366] text-white px-3 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Menu</span>
            </button>
            <div>
              <h1 className="font-pixel text-xs sm:text-base text-yellow-400">
                COPA EFATÁ SOCCER 26
              </h1>
              <p className="text-xs text-slate-400">
                Seu clube: <strong className="text-white">{userClub.name}</strong> · Progresso salvo
                automaticamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#0d1b38] border-2 border-[#2b4a87] p-0.5">
              <button
                type="button"
                onClick={() => {
                  retroAudio.playCursor();
                  setActiveTab('GROUPS');
                }}
                className={`px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                  activeTab === 'GROUPS'
                    ? 'bg-yellow-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Fase de Grupos (A–F)
              </button>
              <button
                type="button"
                onClick={() => {
                  retroAudio.playCursor();
                  setActiveTab('BRACKET');
                }}
                className={`px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                  activeTab === 'BRACKET'
                    ? 'bg-yellow-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Mata-Mata (16)
              </button>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="retro-btn bg-[#2c1525] hover:bg-[#421c35] border-red-500/70 text-red-200 px-3 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playConfirm();
                    setConfirmReset(false);
                    onResetTournament();
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 text-xs font-bold cursor-pointer"
                >
                  Confirmar Novo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-2 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Banner de Campeão OU Próximo Confronto */}
        {tournament.phase === 'FINISHED' && championClub ? (
          <div className="retro-box-gold p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Trophy className="w-12 h-12 text-yellow-400 shrink-0" />
              <PixelCrest club={championClub} size={56} />
              <div>
                <p className="font-pixel text-[11px] text-emerald-400">
                  {championClub.id === tournament.userClubId
                    ? 'PARABÉNS! VOCÊ É CAMPEÃO!'
                    : 'CAMPEÃO DA COPA EFATÁ SOCCER 26'}
                </p>
                <h2 className="font-pixel text-lg sm:text-2xl text-yellow-300 mt-1">
                  {championClub.name.toUpperCase()}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                retroAudio.playConfirm();
                onResetTournament();
              }}
              className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white font-pixel text-xs px-5 py-3 whitespace-nowrap cursor-pointer"
            >
              NOVO CAMPEONATO
            </button>
          </div>
        ) : nextMatch ? (
          <div className="retro-box-gold p-5 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <PixelCrest club={getClubById(nextMatch.homeId)} size={48} />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-yellow-300">{nextMatch.label}</p>
                  <h2 className="font-pixel text-sm sm:text-base text-white mt-0.5">
                    {getClubById(nextMatch.homeId).shortName}{' '}
                    <span className="text-yellow-400">×</span>{' '}
                    {getClubById(nextMatch.awayId).shortName}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {getClubById(nextMatch.homeId).name} vs {getClubById(nextMatch.awayId).name}
                    {nextMatch.isKnockout ? ' · Empate vai aos pênaltis' : ''}
                  </p>
                </div>
                <PixelCrest club={getClubById(nextMatch.awayId)} size={48} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                retroAudio.unlock();
                retroAudio.playConfirm();
                onPlayNextMatch();
              }}
              className="retro-btn bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white font-pixel text-xs px-6 py-3.5 flex items-center gap-2.5 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>JOGAR PARTIDA</span>
            </button>
          </div>
        ) : (
          <div className="retro-box p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-red-500/80">
            <div>
              <p className="font-pixel text-xs text-red-400">ELIMINADO DA COMPETIÇÃO</p>
              <p className="text-sm text-slate-200 mt-1">
                O {userClub.name} encerrou sua participação nesta edição. Você pode simular o
                restante do mata-mata para descobrir o campeão ou iniciar uma nova Copa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                retroAudio.playConfirm();
                onSimulateRest();
              }}
              className="retro-btn bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-pixel text-[11px] px-4 py-3 flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>SIMULAR ATÉ A FINAL</span>
            </button>
          </div>
        )}

        {/* Resumo da Última Rodada */}
        {tournament.lastRoundSummary.length > 0 && (
          <div className="bg-[#0d1c3b] border border-[#29457d] px-4 py-2.5 text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-bold text-yellow-400">ÚLTIMA RODADA:</span>
            {tournament.lastRoundSummary.map((line, i) => (
              <span key={`${line}-${i}`} className="tabular-nums">
                {line}
              </span>
            ))}
          </div>
        )}

        {/* Conteúdo das Abas */}
        {activeTab === 'GROUPS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tournament.groups.map((group) => {
              const rows = computeGroupStandings(group);
              const hasUser = group.clubIds.includes(tournament.userClubId);
              return (
                <section
                  key={group.id}
                  className={`p-3.5 ${hasUser ? 'retro-box-gold' : 'retro-box'}`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="font-pixel text-xs text-yellow-300">{group.name.toUpperCase()}</h3>
                    <span className="text-[11px] text-slate-400">2 líderes + 4 melhores 3º</span>
                  </div>

                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-[11px] text-slate-400 border-b border-[#28447d]">
                        <th className="text-left py-1 font-semibold">#</th>
                        <th className="text-left py-1 font-semibold">CLUBE</th>
                        <th className="text-right py-1 font-semibold">P</th>
                        <th className="text-right py-1 font-semibold">J</th>
                        <th className="text-right py-1 font-semibold">V</th>
                        <th className="text-right py-1 font-semibold">E</th>
                        <th className="text-right py-1 font-semibold">D</th>
                        <th className="text-right py-1 font-semibold">SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const club = getClubById(row.clubId);
                        const isUserRow = row.clubId === tournament.userClubId;
                        const zoneColor =
                          idx < 2
                            ? 'text-emerald-400'
                            : idx === 2
                              ? 'text-sky-300'
                              : 'text-slate-500';
                        return (
                          <tr
                            key={row.clubId}
                            className={`border-b border-[#1b315e] last:border-b-0 ${
                              isUserRow ? 'bg-[#1c3975]' : ''
                            }`}
                          >
                            <td className={`py-1.5 font-bold tabular-nums ${zoneColor}`}>
                              {idx + 1}
                            </td>
                            <td className="py-1.5">
                              <div className="flex items-center gap-2">
                                <PixelCrest club={club} size={18} />
                                <span
                                  className={`font-bold truncate max-w-[110px] ${
                                    isUserRow ? 'text-yellow-300' : 'text-slate-100'
                                  }`}
                                >
                                  {club.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 text-right font-bold tabular-nums text-yellow-300">
                              {row.points}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-slate-300">
                              {row.played}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-slate-300">
                              {row.won}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-slate-300">
                              {row.drawn}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-slate-300">
                              {row.lost}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-slate-200">
                              {row.gd > 0 ? `+${row.gd}` : row.gd}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="retro-box p-4 overflow-x-auto">
            <div className="min-w-[820px] grid grid-cols-4 gap-4 items-center">
              {(['R16', 'QF', 'SF', 'FINAL'] as KnockoutStageKey[]).map((stageKey) => (
                <div key={stageKey} className="flex flex-col gap-3">
                  <h3 className="font-pixel text-[11px] text-center text-yellow-400 pb-1 border-b border-[#2a4782]">
                    {STAGE_TITLES[stageKey]}
                  </h3>
                  <div className="flex flex-col gap-3 justify-around">
                    {tournament.knockout[stageKey].map(renderKnockoutCard)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
