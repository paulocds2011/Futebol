export type PlayerRole = 'GK' | 'ZAG' | 'LAT' | 'DEF' | 'MID' | 'FWD';

export type FormationId = '4-4-3' | '4-3-4' | '3-5-3' | '5-3-3' | '4-5-2';
export type WeatherType = 'SOL' | 'CHUVA' | 'NEVE';
export type TimeOfDay = 'DIA' | 'NOITE';

export type KitPattern =
  | 'hoops'        // Listras horizontais (FLA, VIT, SPT)
  | 'stripes'      // Listras verticais 2 cores (CAM, BOT, CEA, JUV)
  | 'tricolor-v'   // Tricolor vertical (FLU, GRE)
  | 'tricolor-h'   // Tricolor horizontal (FOR, SAO, CFC)
  | 'sash'         // Faixa diagonal (VAS)
  | 'chest-bands'  // Faixas no peito (SAO, CFC)
  | 'chest-detail' // Base sólida com detalhes/ombros (BAH, RBB, CAP)
  | 'solid';       // Sólido clássico (PAL, COR, SAN, CRU, INT, MIR, CHA, REM)

export type CrestPattern =
  | 'hoops'
  | 'stripes'
  | 'sash'
  | 'tricolor-h'
  | 'tricolor-v'
  | 'solid-star'
  | 'diamond'
  | 'sp-shield'
  | 'diagonal-split'
  | 'cross';

export interface Kit {
  pattern: KitPattern;
  primary: string;
  secondary: string;
  tertiary?: string;
  shorts: string;
  socks: string;
  gkShirt: string;
  numberColor: string;
}

export interface ClubCrest {
  pattern: CrestPattern;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
}

export interface SquadPlayer {
  name: string;
  number: number;
  role: PlayerRole;
  skin: string;
  hair: string;
  atkMod: number; // -4 to +6
  defMod: number; // -4 to +6
  spdMod: number; // -4 to +6
}

export interface Club {
  id: string;
  name: string;
  shortName: string; // 3 letters
  division: 'SÉRIE A' | 'CONVIDADO';
  stats: {
    attack: number;  // 70..96
    defense: number; // 70..96
    speed: number;   // 70..96
  };
  crest: ClubCrest;
  homeKit: Kit;
  awayKit: Kit;
  crowdColors: [string, string, string];
  /** 12 titulares em campo (1 GOL + 11 linha: ZAG, LAT, MEI, ATA) */
  squad: SquadPlayer[];
  /** 5 reservas no banco para substituições */
  bench: SquadPlayer[];
}

export type GameMode = 'FRIENDLY' | 'TOURNAMENT' | 'PENALTIES';
export type PlayerControlMode = '1P_CPU' | '1P_2P';
export type Difficulty = 'FACIL' | 'MEDIO' | 'DIFICIL';
export type MatchDurationMinutes = 2 | 3 | 5;

export type GameScreen =
  | 'TITLE'
  | 'TEAM_SELECT'
  | 'TOURNAMENT_HUB'
  | 'MATCH'
  | 'PENALTY_SHOOTOUT'
  | 'POST_MATCH';

export interface MatchConfig {
  mode: GameMode;
  controlMode: PlayerControlMode;
  homeClubId: string;
  awayClubId: string;
  durationMinutes: MatchDurationMinutes;
  difficulty: Difficulty;
  /** If true (e.g. tournament knockout), draws go to penalties */
  knockoutTiebreak?: boolean;
  tournamentRoundLabel?: string;
  weather?: WeatherType;
  timeOfDay?: TimeOfDay;
  homeFormation?: FormationId;
  awayFormation?: FormationId;
}

export interface GoalEvent {
  team: 'home' | 'away';
  scorerName: string;
  scorerNumber: number;
  minute: number;
}

export interface MatchStats {
  homePossessionTicks: number;
  awayPossessionTicks: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeSaves: number;
  awaySaves: number;
  homeFouls: number;
  awayFouls: number;
  goals: GoalEvent[];
}

export interface MatchResult {
  config: MatchConfig;
  homeScore: number;
  awayScore: number;
  homePenalties?: number;
  awayPenalties?: number;
  stats: MatchStats;
  winner: 'home' | 'away' | 'draw';
}

export type CameraMode = 'TV' | 'PERTO' | 'AMPLA';

export type ChargeType = 'shot' | 'pass' | 'cross';

export type BroadcastSpeaker = 'galvao' | 'casagrande' | 'ronaldo' | 'neto';

export interface PlayerInputState {
  dx: number; // -1..1
  dy: number; // -1..1
  pass: boolean;
  passJustPressed: boolean;
  passJustReleased: boolean;
  shoot: boolean;
  shootJustPressed: boolean;
  shootJustReleased: boolean;
  lob: boolean;
  lobJustPressed: boolean;
  lobJustReleased: boolean;
  steal: boolean;
  stealJustPressed: boolean;
  sprint: boolean;
  pauseJustPressed: boolean;
}

export type MatchPhase =
  | 'KICKOFF'
  | 'PLAYING'
  | 'GOAL_CELEBRATION'
  | 'GOAL_REPLAY'
  | 'THROW_IN'
  | 'CORNER'
  | 'GOAL_KICK'
  | 'FREE_KICK'
  | 'HALFTIME'
  | 'FULLTIME';

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  rotation: number;
  ownerId: string | null;
  lastTouchTeam: 'home' | 'away' | null;
  lastTouchPlayerId: string | null;
  lastTouchPlayerName: string;
  lastTouchPlayerNumber: number;
  shotInFlight: boolean;
  shotTeam: 'home' | 'away' | null;
  passTargetId: string | null;
  passTargetX: number;
  passTargetY: number;
  isCrossBall: boolean;
  isBicycleShot?: boolean;
}

export interface FieldPlayer {
  id: string;
  team: 'home' | 'away';
  index: number; // 0..11 (0 = GK)
  name: string;
  number: number;
  role: PlayerRole;
  skin: string;
  hair: string;
  attack: number;
  defense: number;
  speed: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  homeX: number;
  homeY: number;
  stamina: number; // 0..100
  animFrame: number;
  animTimer: number;
  tackleTimer: number;
  tackleCooldown: number;
  stealAnimTimer: number;
  stealCooldown: number;
  passAnimTimer: number;
  headerAnimTimer: number;
  bicycleAnimTimer: number;
  queuedBicycle: boolean;
  skillMoveTimer: number;
  skillMoveType: 'pedalada' | 'elastico' | 'giro';
  kickType: 'shot' | 'pass' | 'lob' | 'cross' | 'header' | 'bicycle';
  celebrating: boolean;
  stunTimer: number;
  kickAnimTimer: number;
  diveTimer: number;
  diveDirX: number;
  diveDirY: number;
  gkRushActive: boolean;
  chargePower: number; // 0..1 while holding shoot/pass/cross
  chargeType: ChargeType;
  isCharging: boolean;
  holdBallTimer: number; // GK holding ball
  gkNoCatchTimer: number; // prevents GK from re-catching own pass/launch
  aiDecisionTimer: number;
}

export interface ReplayPlayerSnapshot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  animFrame: number;
  tackleTimer: number;
  stealAnimTimer: number;
  passAnimTimer: number;
  headerAnimTimer: number;
  bicycleAnimTimer: number;
  skillMoveTimer: number;
  skillMoveType: 'pedalada' | 'elastico' | 'giro';
  kickType: 'shot' | 'pass' | 'lob' | 'cross' | 'header' | 'bicycle';
  celebrating: boolean;
  stunTimer: number;
  kickAnimTimer: number;
  diveTimer: number;
  diveDirX: number;
  diveDirY: number;
  gkRushActive: boolean;
}

export interface ReplayFrameSnapshot {
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    rotation: number;
    ownerId: string | null;
    shotInFlight: boolean;
    isCrossBall: boolean;
    passTargetX: number;
    passTargetY: number;
  };
  players: ReplayPlayerSnapshot[];
  referee: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facingX: number;
    animFrame: number;
    whistleTimer: number;
    signalTimer: number;
    signalDirX: number;
  };
  linesmen: [
    { x: number; y: number; vx: number; facingX: number; animFrame: number; flagRaisedTimer: number; flagDirX: number },
    { x: number; y: number; vx: number; facingX: number; animFrame: number; flagRaisedTimer: number; flagDirX: number }
  ];
  netRipples: NetRipple[];
  cameraX: number;
  cameraY: number;
}

export interface RefereeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  animFrame: number;
  animTimer: number;
  whistleTimer: number;
  cardTimer: number;
  signalTimer: number;
  signalDirX: number;
}

export interface LinesmanState {
  side: 'top' | 'bottom';
  x: number;
  y: number;
  vx: number;
  facingX: number;
  animFrame: number;
  animTimer: number;
  flagRaisedTimer: number;
  flagDirX: number;
}

export interface CrowdChantBubble {
  id: number;
  text: string;
  worldX: number;
  team: 'home' | 'away';
  kind: 'chant' | 'anthem' | 'taunt';
  timer: number;
  maxTimer: number;
}

export interface NetRipple {
  side: 'left' | 'right';
  impactY: number;
  amplitude: number;
  phase: number;
}

export interface CalloutBanner {
  text: string;
  subtext?: string;
  timer: number;
  maxTimer: number;
  type: 'goal' | 'setpiece' | 'info' | 'foul';
}

export interface FireworkRocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
  secondaryColor: string;
  trail: Array<{ x: number; y: number }>;
  exploded: boolean;
}

export interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  twinkle: number;
}

export interface TacticalPlayerInfo {
  id: string;
  index: number;
  name: string;
  number: number;
  role: PlayerRole;
  stamina: number;
  attack: number;
  defense: number;
  speed: number;
  subbedIn?: boolean;
}

export interface MatchSnapshotHUD {
  homeScore: number;
  awayScore: number;
  clockMinutes: number;
  clockSeconds: number;
  half: 1 | 2;
  phase: MatchPhase;
  p1PlayerName: string;
  p1PlayerNumber: number;
  p1Stamina: number;
  p1Charge: number;
  p1ChargeType: ChargeType;
  p2PlayerName: string | null;
  p2PlayerNumber: number | null;
  p2Stamina: number;
  p2Charge: number;
  p2ChargeType: ChargeType;
  callout: CalloutBanner | null;
  broadcastLine: string | null;
  broadcastSpeaker: BroadcastSpeaker;
  broadcastPartner?: BroadcastSpeaker | null;
  goalBanner: {
    scorerName: string;
    scorerNumber: number;
    teamName: string;
    teamColor: string;
  } | null;
  replayInfo: {
    active: boolean;
    progress: number;
    scorerName: string;
    scorerNumber: number;
    teamName: string;
    minute: number;
  } | null;
  isPaused: boolean;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  homeFormation: FormationId;
  awayFormation: FormationId;
  homeSubsUsed: number;
  awaySubsUsed: number;
  maxSubs: number;
}

// --- TOURNAMENT (COPA 24 CLUBES: 6 GRUPOS DE 4 + MATA-MATA 16) ---

export interface GroupFixture {
  id: string;
  round: 1 | 2 | 3;
  groupId: string;
  homeId: string;
  awayId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
}

export interface GroupStandingRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface TournamentGroup {
  id: string; // 'A'..'F'
  name: string;
  clubIds: string[];
  fixtures: GroupFixture[];
}

export type KnockoutStageKey = 'R16' | 'QF' | 'SF' | 'FINAL';

export interface KnockoutMatch {
  id: string;
  stage: KnockoutStageKey;
  slot: number;
  homeId: string | null;
  awayId: string | null;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  homePenalties?: number;
  awayPenalties?: number;
  winnerId?: string;
}

export interface TournamentState {
  version: number;
  userClubId: string;
  difficulty: Difficulty;
  durationMinutes: MatchDurationMinutes;
  phase: 'GROUPS' | 'KNOCKOUT' | 'FINISHED';
  currentGroupRound: 1 | 2 | 3;
  currentKnockoutStage: KnockoutStageKey;
  groups: TournamentGroup[];
  knockout: Record<KnockoutStageKey, KnockoutMatch[]>;
  championId: string | null;
  userEliminated: boolean;
  lastRoundSummary: string[];
}

// --- PENALTY SHOOTOUT ---

export type PenaltyAttemptResult = 'GOAL' | 'SAVE' | 'MISS';

export interface PenaltyKickRecord {
  team: 'home' | 'away';
  kickerName: string;
  result: PenaltyAttemptResult;
}

export interface PenaltyHUDState {
  homeScore: number;
  awayScore: number;
  homeHistory: PenaltyAttemptResult[];
  awayHistory: PenaltyAttemptResult[];
  roundNumber: number;
  isSuddenDeath: boolean;
  kickingTeam: 'home' | 'away';
  kickerName: string;
  kickerNumber: number;
  keeperName: string;
  phase: 'AIMING' | 'CHARGING' | 'FLIGHT' | 'RESULT' | 'FINISHED';
  message: string;
  subMessage: string;
  winner: 'home' | 'away' | null;
  isHumanKicker: boolean;
  isHumanKeeper: boolean;
}
