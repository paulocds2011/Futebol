import { CLUBS, getClubById } from '../data/clubs';
import {
  Difficulty,
  GroupFixture,
  GroupStandingRow,
  KnockoutMatch,
  KnockoutStageKey,
  MatchDurationMinutes,
  TournamentGroup,
  TournamentState,
} from '../types/game';

const STORAGE_KEY = 'brasileirao_superstar_26_copa_v1';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function loadSavedTournament(): TournamentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TournamentState;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.groups) && parsed.groups.length === 6) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTournament(state: TournamentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSavedTournament(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// Simula placar realista baseado nos atributos Ataque / Defesa / Velocidade
export function simulateScore(homeId: string, awayId: string): { homeScore: number; awayScore: number } {
  const home = getClubById(homeId);
  const away = getClubById(awayId);

  const homePower =
    home.stats.attack * 0.45 + home.stats.speed * 0.25 + (100 - away.stats.defense) * 0.3 + 2.5;
  const awayPower =
    away.stats.attack * 0.45 + away.stats.speed * 0.25 + (100 - home.stats.defense) * 0.3;

  const sampleGoals = (power: number): number => {
    const lambda = Math.max(0.45, Math.min(2.6, (power - 52) / 17));
    let goals = 0;
    for (let i = 0; i < 6; i++) {
      if (Math.random() < lambda / 6) goals++;
    }
    return goals;
  };

  return {
    homeScore: sampleGoals(homePower),
    awayScore: sampleGoals(awayPower),
  };
}

export function simulatePenaltyShootout(): { homePen: number; awayPen: number } {
  let h = 0;
  let a = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < 0.74) h++;
    if (Math.random() < 0.74) a++;
  }
  while (h === a) {
    const hs = Math.random() < 0.74 ? 1 : 0;
    const as = Math.random() < 0.74 ? 1 : 0;
    h += hs;
    a += as;
  }
  return { homePen: h, awayPen: a };
}

export function createNewTournament(
  userClubId: string,
  difficulty: Difficulty,
  durationMinutes: MatchDurationMinutes
): TournamentState {
  // Distribui os 24 clubes em 4 potes por força geral para criar 6 grupos equilibrados
  const sorted = [...CLUBS].sort(
    (a, b) =>
      b.stats.attack + b.stats.defense + b.stats.speed - (a.stats.attack + a.stats.defense + a.stats.speed)
  );

  const pot1 = shuffle(sorted.slice(0, 6));
  const pot2 = shuffle(sorted.slice(6, 12));
  const pot3 = shuffle(sorted.slice(12, 18));
  const pot4 = shuffle(sorted.slice(18, 24));

  const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const groups: TournamentGroup[] = groupLetters.map((letter, gi) => {
    const ids = [pot1[gi].id, pot2[gi].id, pot3[gi].id, pot4[gi].id];
    const [t0, t1, t2, t3] = ids;

    // 3 rodadas clássicas (todos contra todos em turno único)
    const fixtures: GroupFixture[] = [
      { id: `${letter}-r1-1`, round: 1, groupId: letter, homeId: t0, awayId: t1, played: false },
      { id: `${letter}-r1-2`, round: 1, groupId: letter, homeId: t2, awayId: t3, played: false },
      { id: `${letter}-r2-1`, round: 2, groupId: letter, homeId: t0, awayId: t2, played: false },
      { id: `${letter}-r2-2`, round: 2, groupId: letter, homeId: t1, awayId: t3, played: false },
      { id: `${letter}-r3-1`, round: 3, groupId: letter, homeId: t0, awayId: t3, played: false },
      { id: `${letter}-r3-2`, round: 3, groupId: letter, homeId: t1, awayId: t2, played: false },
    ];

    return {
      id: letter,
      name: `Grupo ${letter}`,
      clubIds: ids,
      fixtures,
    };
  });

  const emptyKnockout: Record<KnockoutStageKey, KnockoutMatch[]> = {
    R16: Array.from({ length: 8 }, (_, i) => ({
      id: `R16-${i}`,
      stage: 'R16',
      slot: i,
      homeId: null,
      awayId: null,
      played: false,
    })),
    QF: Array.from({ length: 4 }, (_, i) => ({
      id: `QF-${i}`,
      stage: 'QF',
      slot: i,
      homeId: null,
      awayId: null,
      played: false,
    })),
    SF: Array.from({ length: 2 }, (_, i) => ({
      id: `SF-${i}`,
      stage: 'SF',
      slot: i,
      homeId: null,
      awayId: null,
      played: false,
    })),
    FINAL: [
      {
        id: 'FINAL-0',
        stage: 'FINAL',
        slot: 0,
        homeId: null,
        awayId: null,
        played: false,
      },
    ],
  };

  const state: TournamentState = {
    version: 1,
    userClubId,
    difficulty,
    durationMinutes,
    phase: 'GROUPS',
    currentGroupRound: 1,
    currentKnockoutStage: 'R16',
    groups,
    knockout: emptyKnockout,
    championId: null,
    userEliminated: false,
    lastRoundSummary: [],
  };

  saveTournament(state);
  return state;
}

export function computeGroupStandings(group: TournamentGroup): GroupStandingRow[] {
  const map = new Map<string, GroupStandingRow>();
  for (const clubId of group.clubIds) {
    map.set(clubId, {
      clubId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const fx of group.fixtures) {
    if (!fx.played || fx.homeScore === undefined || fx.awayScore === undefined) continue;
    const h = map.get(fx.homeId)!;
    const a = map.get(fx.awayId)!;
    h.played++;
    a.played++;
    h.gf += fx.homeScore;
    h.ga += fx.awayScore;
    a.gf += fx.awayScore;
    a.ga += fx.homeScore;
    h.gd = h.gf - h.ga;
    a.gd = a.gf - a.ga;

    if (fx.homeScore > fx.awayScore) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (fx.awayScore > fx.homeScore) {
      a.won++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.clubId.localeCompare(b.clubId);
  });
}

export function getUserNextMatch(state: TournamentState): {
  homeId: string;
  awayId: string;
  label: string;
  isKnockout: boolean;
  matchId: string;
} | null {
  if (state.phase === 'FINISHED' || state.userEliminated) return null;

  if (state.phase === 'GROUPS') {
    for (const g of state.groups) {
      const fx = g.fixtures.find(
        (f) =>
          f.round === state.currentGroupRound &&
          !f.played &&
          (f.homeId === state.userClubId || f.awayId === state.userClubId)
      );
      if (fx) {
        return {
          homeId: fx.homeId,
          awayId: fx.awayId,
          label: `GRUPO ${g.id} · RODADA ${state.currentGroupRound}/3`,
          isKnockout: false,
          matchId: fx.id,
        };
      }
    }
    return null;
  }

  const stageMatches = state.knockout[state.currentKnockoutStage];
  const m = stageMatches.find(
    (km) =>
      !km.played &&
      km.homeId !== null &&
      km.awayId !== null &&
      (km.homeId === state.userClubId || km.awayId === state.userClubId)
  );
  if (!m || !m.homeId || !m.awayId) return null;

  const stageLabels: Record<KnockoutStageKey, string> = {
    R16: 'OITAVAS DE FINAL',
    QF: 'QUARTAS DE FINAL',
    SF: 'SEMIFINAL',
    FINAL: 'GRANDE FINAL',
  };

  return {
    homeId: m.homeId,
    awayId: m.awayId,
    label: stageLabels[state.currentKnockoutStage],
    isKnockout: true,
    matchId: m.id,
  };
}

export function recordUserMatchAndAdvance(
  prevState: TournamentState,
  matchId: string,
  homeScore: number,
  awayScore: number,
  homePenalties?: number,
  awayPenalties?: number
): TournamentState {
  const state: TournamentState = JSON.parse(JSON.stringify(prevState));
  const summary: string[] = [];

  if (state.phase === 'GROUPS') {
    const round = state.currentGroupRound;

    for (const g of state.groups) {
      for (const fx of g.fixtures) {
        if (fx.round !== round || fx.played) continue;

        if (fx.id === matchId) {
          fx.played = true;
          fx.homeScore = homeScore;
          fx.awayScore = awayScore;
        } else {
          const sim = simulateScore(fx.homeId, fx.awayId);
          fx.played = true;
          fx.homeScore = sim.homeScore;
          fx.awayScore = sim.awayScore;
        }

        const hc = getClubById(fx.homeId);
        const ac = getClubById(fx.awayId);
        summary.push(`${hc.shortName} ${fx.homeScore}x${fx.awayScore} ${ac.shortName}`);
      }
    }

    state.lastRoundSummary = summary;

    if (round < 3) {
      state.currentGroupRound = (round + 1) as 2 | 3;
    } else {
      // Finalizou Fase de Grupos -> Classifica 2 líderes de cada grupo + 4 melhores 3º colocados = 16 clubes!
      seedKnockoutBracket(state);
    }

    saveTournament(state);
    return state;
  }

  // --- MATA-MATA ---
  const stage = state.currentKnockoutStage;
  const stageMatches = state.knockout[stage];

  for (const km of stageMatches) {
    if (km.played || !km.homeId || !km.awayId) continue;

    if (km.id === matchId) {
      km.played = true;
      km.homeScore = homeScore;
      km.awayScore = awayScore;
      km.homePenalties = homePenalties;
      km.awayPenalties = awayPenalties;
      if (homeScore > awayScore) km.winnerId = km.homeId;
      else if (awayScore > homeScore) km.winnerId = km.awayId;
      else km.winnerId = (homePenalties ?? 0) >= (awayPenalties ?? 0) ? km.homeId : km.awayId;
    } else {
      const sim = simulateScore(km.homeId, km.awayId);
      km.played = true;
      km.homeScore = sim.homeScore;
      km.awayScore = sim.awayScore;
      if (sim.homeScore > sim.awayScore) {
        km.winnerId = km.homeId;
      } else if (sim.awayScore > sim.homeScore) {
        km.winnerId = km.awayId;
      } else {
        const pen = simulatePenaltyShootout();
        km.homePenalties = pen.homePen;
        km.awayPenalties = pen.awayPen;
        km.winnerId = pen.homePen > pen.awayPen ? km.homeId : km.awayId;
      }
    }

    const hc = getClubById(km.homeId);
    const ac = getClubById(km.awayId);
    const penText =
      km.homePenalties !== undefined ? ` (${km.homePenalties}-${km.awayPenalties} pên.)` : '';
    summary.push(`${hc.shortName} ${km.homeScore}x${km.awayScore} ${ac.shortName}${penText}`);
  }

  state.lastRoundSummary = summary;
  advanceKnockoutStage(state);
  saveTournament(state);
  return state;
}

export function simulateRemainingTournament(prevState: TournamentState): TournamentState {
  let state: TournamentState = JSON.parse(JSON.stringify(prevState));
  while (state.phase !== 'FINISHED') {
    if (state.phase === 'GROUPS') {
      state = recordUserMatchAndAdvance(state, '__SIM__', 0, 0);
    } else {
      const stage = state.currentKnockoutStage;
      for (const km of state.knockout[stage]) {
        if (km.played || !km.homeId || !km.awayId) continue;
        const sim = simulateScore(km.homeId, km.awayId);
        km.played = true;
        km.homeScore = sim.homeScore;
        km.awayScore = sim.awayScore;
        if (sim.homeScore > sim.awayScore) km.winnerId = km.homeId;
        else if (sim.awayScore > sim.homeScore) km.winnerId = km.awayId;
        else {
          const pen = simulatePenaltyShootout();
          km.homePenalties = pen.homePen;
          km.awayPenalties = pen.awayPen;
          km.winnerId = pen.homePen > pen.awayPen ? km.homeId : km.awayId;
        }
      }
      advanceKnockoutStage(state);
    }
  }
  saveTournament(state);
  return state;
}

function seedKnockoutBracket(state: TournamentState): void {
  const firsts: GroupStandingRow[] = [];
  const seconds: GroupStandingRow[] = [];
  const thirds: GroupStandingRow[] = [];

  for (const g of state.groups) {
    const standings = computeGroupStandings(g);
    firsts.push(standings[0]);
    seconds.push(standings[1]);
    thirds.push(standings[2]);
  }

  const sortRows = (rows: GroupStandingRow[]) =>
    [...rows].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

  const bestThirds = sortRows(thirds).slice(0, 4);
  const qualified = new Set([
    ...firsts.map((r) => r.clubId),
    ...seconds.map((r) => r.clubId),
    ...bestThirds.map((r) => r.clubId),
  ]);

  state.userEliminated = !qualified.has(state.userClubId);

  // Chaveamento balanceado das Oitavas (8 jogos):
  // 1A x 3º(4), 2B x 2C, 1D x 3º(2), 1E x 2F, 1B x 3º(3), 2A x 2D, 1C x 3º(1), 1F x 2E
  const pairings: Array<[string, string]> = [
    [firsts[0].clubId, bestThirds[3].clubId],
    [seconds[1].clubId, seconds[2].clubId],
    [firsts[3].clubId, bestThirds[1].clubId],
    [firsts[4].clubId, seconds[5].clubId],
    [firsts[1].clubId, bestThirds[2].clubId],
    [seconds[0].clubId, seconds[3].clubId],
    [firsts[2].clubId, bestThirds[0].clubId],
    [firsts[5].clubId, seconds[4].clubId],
  ];

  pairings.forEach(([homeId, awayId], i) => {
    state.knockout.R16[i].homeId = homeId;
    state.knockout.R16[i].awayId = awayId;
  });

  state.phase = 'KNOCKOUT';
  state.currentKnockoutStage = 'R16';
}

function advanceKnockoutStage(state: TournamentState): void {
  const stage = state.currentKnockoutStage;
  const currentMatches = state.knockout[stage];

  // Verifica se o clube do usuário foi eliminado nesta fase
  const userMatch = currentMatches.find(
    (m) => m.homeId === state.userClubId || m.awayId === state.userClubId
  );
  if (userMatch && userMatch.winnerId && userMatch.winnerId !== state.userClubId) {
    state.userEliminated = true;
  }

  if (stage === 'FINAL') {
    state.championId = currentMatches[0].winnerId ?? null;
    state.phase = 'FINISHED';
    return;
  }

  const nextStageMap: Record<'R16' | 'QF' | 'SF', KnockoutStageKey> = {
    R16: 'QF',
    QF: 'SF',
    SF: 'FINAL',
  };
  const nextStage = nextStageMap[stage];
  const nextMatches = state.knockout[nextStage];

  for (let i = 0; i < nextMatches.length; i++) {
    nextMatches[i].homeId = currentMatches[i * 2].winnerId ?? null;
    nextMatches[i].awayId = currentMatches[i * 2 + 1].winnerId ?? null;
  }

  state.currentKnockoutStage = nextStage;
}
