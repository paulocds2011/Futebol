import { NarrationMood, retroAudio } from '../audio/retroAudio';
import { FORMATIONS, getClubById, isDefenderRole, resolveMatchKits } from '../data/clubs';
import {
  BallState,
  BroadcastSpeaker,
  CalloutBanner,
  ChargeType,
  Club,
  CrowdChantBubble,
  Difficulty,
  FieldPlayer,
  FireworkRocket,
  FireworkSpark,
  FormationId,
  Kit,
  LinesmanState,
  MatchConfig,
  MatchPhase,
  MatchResult,
  MatchSnapshotHUD,
  MatchStats,
  NetRipple,
  PlayerInputState,
  RefereeState,
  ReplayFrameSnapshot,
  SquadPlayer,
  TacticalPlayerInfo,
  TimeOfDay,
  WeatherType,
} from '../types/game';

// Dimensões ampliadas para 12×12 com laterais, zagueiros, meias e atacantes (Efatá Soccer 26)
export const PITCH_W = 3600;
export const PITCH_H = 2120;
export const FIELD_LEFT = 220;
export const FIELD_RIGHT = 3380;
export const FIELD_TOP = 200;
export const FIELD_BOTTOM = 1920;
export const FIELD_CENTER_X = (FIELD_LEFT + FIELD_RIGHT) / 2; // 1800
export const FIELD_CENTER_Y = (FIELD_TOP + FIELD_BOTTOM) / 2; // 1060
export const GOAL_HALF_H = 122;
export const GOAL_TOP = FIELD_CENTER_Y - GOAL_HALF_H;
export const GOAL_BOTTOM = FIELD_CENTER_Y + GOAL_HALF_H;
export const GOAL_DEPTH = 74;
export const CROSSBAR_Z = 80;
export const PENALTY_W = 390;
export const PENALTY_HALF_H = 360;
export const GOALBOX_W = 148;
export const GOALBOX_HALF_H = 192;

const CLUB_CHANTS: Record<string, [string, string]> = {
  fla: ['MENGÔÔÔ! MENGÔÔÔ!', 'VAI FLAMENGO!'],
  pal: ['PALMEIRAS! FIU FIU!', 'VAI VERDÃO!'],
  cor: ['VAI CORINTHIANS!', 'TIMÃO! TIMÃO!'],
  san: ['SANTOS! SANTOS!', 'VAI PEIXÃO!'],
  sao: ['TRICOLOR! TRICOLOR!', 'VAI SÃO PAULO!'],
  cru: ['CRUZEIRO! CRUZEIRO!', 'VAI CABULOSO!'],
  cam: ['GALO! GALO! GALO!', 'VAI ATLÉTICO!'],
  flu: ['NENSE! NENSE!', 'VAI FLUMINENSE!'],
  bot: ['FOGÃO! FOGÃO!', 'VAI BOTAFOGO!'],
  vas: ['VASCO! VASCO!', 'VAI GIGANTE!'],
  gre: ['GRÊMIO! GRÊMIO!', 'VAI IMORTAL!'],
  int: ['INTER! INTER!', 'VAI COLORADO!'],
  bah: ['BBMP! BAHIA!', 'VAI ESQUADRÃO!'],
  cap: ['FURACÃO! FURACÃO!', 'VAI ATHLETICO!'],
  cfc: ['COXA! COXA!', 'VAI CORITIBA!'],
  vit: ['LEÃO! VITÓRIA!', 'VAI VITÓRIA!'],
  rbb: ['MASSA BRUTA!', 'VAI BRAGANTINO!'],
  mir: ['MIRASSOL! LEÃO!', 'VAI MIRASSOL!'],
  cha: ['VAMO VAMO CHAPE!', 'CHAPECOENSE!'],
  rem: ['LEÃO AZUL! REMO!', 'VAI REMO!'],
  for: ['LEÃO! FORTALEZA!', 'VAI TRICOLOR!'],
  cea: ['VOZÃO! VOZÃO!', 'VAI CEARÁ!'],
  spt: ['CAZÁ CAZÁ! SPORT!', 'VAI LEÃO!'],
  juv: ['JU! JUVENTUDE!', 'VAI PAPO!'],
};

const CLUB_ANTHEMS: Record<string, [string, string]> = {
  fla: ['UMA VEZ FLAMENGO, SEMPRE FLAMENGO!', 'FLAMENGO EU HEI DE SER, É O MEU MAIOR PRAZER!'],
  pal: ['QUANDO SURGE O ALVIVERDE IMPONENTE!', 'DEFESA QUE NINGUÉM PASSA, LINHA ATACANTE DE RAÇA!'],
  cor: ['SALVE O CORINTHIANS, CAMPEÃO DOS CAMPEÕES!', 'ETERNAMENTE DENTRO DOS NOSSOS CORAÇÕES!'],
  san: ['AGORA QUEM DÁ BOLA É O SANTOS!', 'NASCEU O NOVO CAMPEÃO, ALVINEGRO PRAIANO!'],
  sao: ['SALVE O TRICOLOR PAULISTA!', 'AMADO CLUBE BRASILEIRO, TU ÉS FORTE, TU ÉS GRANDE!'],
  cru: ['EXISTE UM GRANDE CLUBE NA CIDADE!', 'QUE MORA DENTRO DO MEU CORAÇÃO, CRUZEIRO!'],
  cam: ['NÓS SOMOS DO CLUBE ATLÉTICO MINEIRO!', 'JOGAMOS COM MUITA RAÇA E AMOR, GALO!'],
  flu: ['SOU TRICOLOR DE CORAÇÃO!', 'VENCE O FLUMINENSE COM O VERDE DA ESPERANÇA!'],
  bot: ['BOTAFOGO, BOTAFOGO, CAMPEÃO DESDE 1910!', 'ESTRELA SOLITÁRIA TE CONDUZ!'],
  vas: ['VAMOS TODOS CANTAR DE CORAÇÃO!', 'A CRUZ DE MALTA É O MEU PENDÃO, VASCO!'],
  gre: ['ATÉ A PÉ NÓS IREMOS, PARA O QUE DER E VIER!', 'COM O GRÊMIO ONDE O GRÊMIO ESTIVER!'],
  int: ['GLÓRIA DO DESPORTO NACIONAL!', 'OH, INTERNACIONAL, QUE EU VIVO A EXALTAR!'],
  bah: ['SOMOS A TURMA TRICOLOR, SOMOS A VOZ DO CAMPEÃO!', 'NINGUÉM NOS VENCE EM VIBRAÇÃO, BAHIA!'],
  cap: ['ATHLETICO, CONHECEMOS TEU VALOR!', 'FURACÃO DA BAIXADA, RUBRO-NEGRO DE RAÇA!'],
  cfc: ['LUTEI, VENCI, COXA BRANCA DO PARANÁ!', 'CORITIBA CAMPEÃO DO POVO!'],
  vit: ['MOSTRA TEU VALOR, LEÃO DA BARRA!', 'VITÓRIA, VITÓRIA, TEU BRILHO É IMORTAL!'],
  rbb: ['FORÇA MASSA BRUTA DO INTERIOR!', 'BRAGANTINO COM GARRA E CORAÇÃO!'],
  mir: ['AVANTE LEÃO AMARELO, VAMOS MIRASSOL!', 'ORGULHO DA REGIÃO, MIRASSOL!'],
  cha: ['Ó GLORIOSO VERDE QUE SE EXPANDE!', 'VAMOS, VAMOS CHAPE, FORÇA CHAPECOENSE!'],
  rem: ['CLUBE DO REMO, LEÃO AZUL DO NORTE!', 'COM RAÇA E GLÓRIA VAMOS VENCER!'],
  for: ['FORTALEZA, CLUBE DE GLÓRIA E TRADIÇÃO!', 'FORTALEZA, QUANTO MAIS TE CONHEÇO MAIS TE AMO!'],
  cea: ['TEU PASSADO É TODO GLÓRIA, VOZÃO!', 'CEARÁ SPORTING CLUB, PAIXÃO DO POVO!'],
  spt: ['COM O SPORT ETERNAMENTE ESTAREI!', 'CAZÁ, CAZÁ, O LEÃO DA ILHA É CAMPEÃO!'],
  juv: ['SALVE O JUVENTUDE, ALVIVERDE DA SERRA!', 'FORÇA E TRADIÇÃO DO PAPO!'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface DifficultyProfile {
  aiReaction: number;      // seconds between tactical choices
  aiSpeedMult: number;     // movement multiplier
  aiShotAccuracy: number;  // radians spread (lower = more accurate)
  aiTackleRate: number;    // probability per check
  gkReflex: number;        // 0..1 dive anticipation
  aiPassVision: number;    // likelihood of smart forward pass
}

const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  FACIL: {
    aiReaction: 0.44,
    aiSpeedMult: 0.80,
    aiShotAccuracy: 0.28,
    aiTackleRate: 0.14,
    gkReflex: 0.34,
    aiPassVision: 0.44,
  },
  MEDIO: {
    aiReaction: 0.30,
    aiSpeedMult: 0.90,
    aiShotAccuracy: 0.18,
    aiTackleRate: 0.24,
    gkReflex: 0.50,
    aiPassVision: 0.66,
  },
  DIFICIL: {
    aiReaction: 0.18,
    aiSpeedMult: 1.00,
    aiShotAccuracy: 0.11,
    aiTackleRate: 0.36,
    gkReflex: 0.66,
    aiPassVision: 0.84,
  },
};

export class SoccerEngine {
  public readonly config: MatchConfig;
  public readonly homeClub: Club;
  public readonly awayClub: Club;
  public readonly homeKit: Kit;
  public readonly awayKit: Kit;

  public players: FieldPlayer[] = [];
  public homeBench: SquadPlayer[] = [];
  public awayBench: SquadPlayer[] = [];
  public homeSubsUsed = 0;
  public awaySubsUsed = 0;
  public readonly maxSubs = 5;
  public subbedInIds = new Set<string>();

  public weather: WeatherType = 'SOL';
  public timeOfDay: TimeOfDay = 'DIA';
  public homeFormation: FormationId = '4-4-3';
  public awayFormation: FormationId = '4-4-3';

  // Fogos de artifício ao fazer o gol (coordenadas normalizadas 0..1 na tela do estádio)
  public fireworkRockets: FireworkRocket[] = [];
  public fireworkSparks: FireworkSpark[] = [];
  public fireworkFlash = 0;
  private fireworkShowTimer = 0;
  private fireworkSpawnCooldown = 0;
  private fireworkColors: [string, string, string] = ['#facc15', '#ffffff', '#38bdf8'];

  public ball: BallState;
  public referee: RefereeState;
  public linesmen: [LinesmanState, LinesmanState];
  public crowdChants: CrowdChantBubble[] = [];

  public phase: MatchPhase = 'KICKOFF';
  public half: 1 | 2 = 1;
  public homeScore = 0;
  public awayScore = 0;

  // Tempo em segundos reais de jogo
  public elapsedRealSeconds = 0;
  public readonly totalRealSeconds: number;

  // Qual lado o time "home" ataca (1 = direita no 1º tempo, -1 = esquerda no 2º tempo)
  public homeAttackDir: 1 | -1 = 1;

  public p1SelectedId = 'home-11';
  public p2SelectedId = 'away-11';

  public cameraX = FIELD_CENTER_X;
  public cameraY = FIELD_CENTER_Y;
  public screenShake = 0;
  public crowdExcitement = 0.25; // 0..1 (1 na comemoração do gol)
  public animTime = 0;

  public netRipples: NetRipple[] = [];
  public callout: CalloutBanner | null = null;
  public broadcastLine: string | null = null;
  public broadcastSpeaker: BroadcastSpeaker = 'galvao';
  public broadcastPartner: BroadcastSpeaker | null = null;
  public goalBanner: MatchSnapshotHUD['goalBanner'] = null;
  public isPaused = false;

  public stats: MatchStats = {
    homePossessionTicks: 1,
    awayPossessionTicks: 1,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeSaves: 0,
    awaySaves: 0,
    homeFouls: 0,
    awayFouls: 0,
    goals: [],
  };

  private phaseTimer = 1.2;
  private setPieceTeam: 'home' | 'away' = 'home';
  private setPieceSpotX = FIELD_CENTER_X;
  private setPieceSpotY = FIELD_CENTER_Y;
  private setPieceTakerId: string | null = null;
  private setPieceWaitTimer = 0;
  private kickoffTeam: 'home' | 'away' = 'home';
  private lastTouchedCooldown = 0;
  private broadcastTimer = 0;
  private playByPlayCooldown = 1.6;
  private livePlayByPlayTimer = 2.6;
  private isOpeningKickoff = true;
  private commentatorToggle = 0;
  private pendingCommentator: {
    line: string;
    speaker: 'casagrande' | 'ronaldo' | 'neto';
    mood: NarrationMood;
    displaySec: number;
    delay: number;
  } | null = null;
  private lastLiveNarrationPlayerId: string | null = null;
  private lastPasserName: string | null = null;
  private lastPasserTeam: 'home' | 'away' | null = null;
  private lastPasserTime = 0;
  private announcedLateMatch = false;
  private announcedPossessionStat = false;
  private crowdChantTimer = 3.5;
  private crowdAnthemCounter = 0;
  private pendingRivalReply: { team: 'home' | 'away'; delay: number } | null = null;
  private nextChantId = 1;
  private matchFinishedCallback: ((res: MatchResult) => void) | null = null;
  private hasEmittedFinish = false;

  // Sistema de Replay dos Gols (buffer circular a 30fps + reprodução em câmera lenta)
  private replayRing: ReplayFrameSnapshot[] = [];
  private replayCaptureTick = 0;
  private replayPlaybackFrames: ReplayFrameSnapshot[] = [];
  private replayCursor = 0;
  private replayGoalRecordTimer = 0;
  private replayPendingConcedingTeam: 'home' | 'away' = 'away';
  private replayMeta: {
    scorerName: string;
    scorerNumber: number;
    teamName: string;
    minute: number;
    isBicycleGoal?: boolean;
  } | null = null;
  private preReplayState: ReplayFrameSnapshot | null = null;
  // Ponto exato de interceptação para cada goleiro durante a ponte (evita passar direto da bola!)
  private gkDiveTargets = new Map<string, { x: number; y: number }>();
  // Controle leve de efeito/curva na bola logo após o chute (after-touch!)
  private shotAfterTouchTimer = 0;
  private shotControllerTeam: 'home' | 'away' | null = null;
  private finishTimeoutId: number | null = null;

  constructor(config: MatchConfig, onFinish?: (res: MatchResult) => void) {
    this.config = config;
    this.homeClub = getClubById(config.homeClubId);
    this.awayClub = getClubById(config.awayClubId);
    const resolved = resolveMatchKits(this.homeClub, this.awayClub);
    this.homeKit = resolved.homeKit;
    this.awayKit = resolved.awayKit;
    this.weather = config.weather ?? 'SOL';
    this.timeOfDay = config.timeOfDay ?? 'DIA';
    this.homeFormation = config.homeFormation ?? '4-4-3';
    this.awayFormation = config.awayFormation ?? '4-4-3';
    this.homeBench = this.homeClub.bench.map((b) => ({ ...b }));
    this.awayBench = this.awayClub.bench.map((b) => ({ ...b }));
    this.totalRealSeconds = config.durationMinutes * 60;
    this.matchFinishedCallback = onFinish ?? null;

    this.ball = this.createInitialBall();
    this.referee = {
      x: FIELD_CENTER_X,
      y: FIELD_CENTER_Y - 125,
      vx: 0,
      vy: 0,
      facingX: 0,
      facingY: 1,
      animFrame: 0,
      animTimer: 0,
      whistleTimer: 0,
      cardTimer: 0,
      signalTimer: 0,
      signalDirX: 1,
    };
    this.linesmen = [
      {
        side: 'top',
        x: FIELD_CENTER_X + 260,
        y: FIELD_TOP - 22,
        vx: 0,
        facingX: -1,
        animFrame: 0,
        animTimer: 0,
        flagRaisedTimer: 0,
        flagDirX: 1,
      },
      {
        side: 'bottom',
        x: FIELD_CENTER_X - 260,
        y: FIELD_BOTTOM + 22,
        vx: 0,
        facingX: 1,
        animFrame: 0,
        animTimer: 0,
        flagRaisedTimer: 0,
        flagDirX: -1,
      },
    ];
    this.createTeams();
    this.setupKickoff('home', true);
  }

  private createInitialBall(): BallState {
    return {
      x: FIELD_CENTER_X,
      y: FIELD_CENTER_Y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      rotation: 0,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchPlayerId: null,
      lastTouchPlayerName: '',
      lastTouchPlayerNumber: 0,
      shotInFlight: false,
      shotTeam: null,
      passTargetId: null,
      passTargetX: FIELD_CENTER_X,
      passTargetY: FIELD_CENTER_Y,
      isCrossBall: false,
      isBicycleShot: false,
    };
  }

  private createTeams(): void {
    this.players = [];
    const buildTeam = (club: Club, team: 'home' | 'away') => {
      club.squad.forEach((sq, idx) => {
        const atk = Math.min(99, Math.max(60, club.stats.attack + sq.atkMod));
        const def = Math.min(99, Math.max(60, club.stats.defense + sq.defMod));
        const spd = Math.min(99, Math.max(60, club.stats.speed + sq.spdMod));
        this.players.push({
          id: `${team}-${idx}`,
          team,
          index: idx,
          name: sq.name,
          number: sq.number,
          role: sq.role,
          skin: sq.skin,
          hair: sq.hair,
          attack: atk,
          defense: def,
          speed: spd,
          x: FIELD_CENTER_X,
          y: FIELD_CENTER_Y,
          vx: 0,
          vy: 0,
          facingX: team === 'home' ? 1 : -1,
          facingY: 0,
          homeX: FIELD_CENTER_X,
          homeY: FIELD_CENTER_Y,
          stamina: 100,
          animFrame: 0,
          animTimer: 0,
          tackleTimer: 0,
          tackleCooldown: 0,
          stealAnimTimer: 0,
          stealCooldown: 0,
          passAnimTimer: 0,
          headerAnimTimer: 0,
          bicycleAnimTimer: 0,
          queuedBicycle: false,
          skillMoveTimer: 0,
          skillMoveType: 'pedalada',
          kickType: 'pass',
          celebrating: false,
          stunTimer: 0,
          kickAnimTimer: 0,
          diveTimer: 0,
          diveDirX: 0,
          diveDirY: 0,
          gkRushActive: false,
          chargePower: 0,
          chargeType: 'shot' as ChargeType,
          isCharging: false,
          holdBallTimer: 0,
          gkNoCatchTimer: 0,
          aiDecisionTimer: 0.1 + Math.random() * 0.2,
        });
      });
    };

    buildTeam(this.homeClub, 'home');
    buildTeam(this.awayClub, 'away');
  }

  public getAttackDir(team: 'home' | 'away'): 1 | -1 {
    return team === 'home' ? this.homeAttackDir : ((this.homeAttackDir * -1) as 1 | -1);
  }

  private computeHomePosition(team: 'home' | 'away', index: number): { x: number; y: number } {
    const dir = this.getAttackDir(team);
    const formationId = team === 'home' ? this.homeFormation : this.awayFormation;
    const def = FORMATIONS[formationId] ?? FORMATIONS['4-4-3'];
    const slot = def.slots[index] ?? def.slots[def.slots.length - 1];
    const fieldW = FIELD_RIGHT - FIELD_LEFT;
    const fieldH = FIELD_BOTTOM - FIELD_TOP;
    const x = dir === 1 ? FIELD_LEFT + slot.x * fieldW : FIELD_RIGHT - slot.x * fieldW;
    const y = FIELD_TOP + slot.y * fieldH;
    return { x, y };
  }

  public setWeather(weather: WeatherType): void {
    this.weather = weather;
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    this.timeOfDay = timeOfDay;
  }

  public setFormation(team: 'home' | 'away', formation: FormationId): void {
    if (team === 'home') this.homeFormation = formation;
    else this.awayFormation = formation;

    const def = FORMATIONS[formation] ?? FORMATIONS['4-4-3'];
    for (const p of this.players) {
      if (p.team !== team) continue;
      const pos = this.computeHomePosition(team, p.index);
      p.homeX = pos.x;
      p.homeY = pos.y;
      if (p.index > 0 && def.slots[p.index]) {
        p.role = def.slots[p.index].role;
      }
    }

    const club = team === 'home' ? this.homeClub : this.awayClub;
    this.showCallout(`FORMAÇÃO ${formation}`, `${club.shortName} · ${def.description}`, 'info', 2.0);
    retroAudio.playCursor();
    this.broadcast(
      `Mudança tática no ${club.name}! O técnico mexe no esquema e arma o time no ${formation}!`,
      'normal',
      'excited',
      3.0,
      'galvao'
    );
    const tacAnalyst = this.nextCommentator();
    this.queueCommentator(
      tacAnalyst === 'neto'
        ? `Ô Galvão, gostei dessa mexida no ${formation}! Diga-se de passagem, o técnico mostrou coragem!`
        : tacAnalyst === 'ronaldo'
          ? `Boa leitura tática, Galvão! Esse ${formation} vai dar mais liberdade pro ataque do ${club.name}!`
          : `Mexida inteligente, Galvão! O ${formation} reorganiza o meio-campo do ${club.name} na hora certa!`,
      tacAnalyst,
      2.6,
      'calm',
      2.8
    );
  }

  public makeSubstitution(
    team: 'home' | 'away',
    fieldPlayerId: string,
    benchIndex: number
  ): boolean {
    const subsUsed = team === 'home' ? this.homeSubsUsed : this.awaySubsUsed;
    if (subsUsed >= this.maxSubs) return false;

    const bench = team === 'home' ? this.homeBench : this.awayBench;
    const incoming = bench[benchIndex];
    if (!incoming) return false;

    const target = this.players.find((p) => p.team === team && p.id === fieldPlayerId);
    if (!target) return false;

    const club = team === 'home' ? this.homeClub : this.awayClub;
    const outgoingName = target.name;
    const outgoingNumber = target.number;

    // Atualiza dados do jogador em campo mantendo o slot tático (e renova 100% do fôlego!)
    target.name = incoming.name;
    target.number = incoming.number;
    target.skin = incoming.skin;
    target.hair = incoming.hair;
    target.attack = Math.min(99, Math.max(60, club.stats.attack + incoming.atkMod));
    target.defense = Math.min(99, Math.max(60, club.stats.defense + incoming.defMod));
    target.speed = Math.min(99, Math.max(60, club.stats.speed + incoming.spdMod));
    target.stamina = 100;
    target.stunTimer = 0;

    // Remove do banco e contabiliza a substituição
    bench.splice(benchIndex, 1);
    this.subbedInIds.add(target.id);
    if (team === 'home') this.homeSubsUsed++;
    else this.awaySubsUsed++;

    this.showCallout(
      'SUBSTITUIÇÃO!',
      `Sai ${outgoingName} (#${outgoingNumber}) · Entra ${incoming.name} (#${incoming.number})`,
      'info',
      2.6
    );
    retroAudio.playWhistle('short');
    this.broadcast(
      `Substituição no ${club.name}! Sai ${outgoingName}, camisa ${outgoingNumber}, e entra ${incoming.name}, camisa ${incoming.number}, com fôlego novo em campo!`,
      'high',
      'excited',
      3.4,
      'galvao'
    );
    const subAnalyst = this.nextCommentator();
    this.queueCommentator(
      subAnalyst === 'neto'
        ? `Baita alteração, Galvão! ${incoming.name} entra descansado pra incendiar o jogo pro ${club.name}!`
        : subAnalyst === 'ronaldo'
          ? `Fôlego novo faz toda diferença, Galvão! Olho em ${incoming.name} atacando as costas da zaga!`
          : `Gostei da troca, Galvão! ${incoming.name} dá novo gás e muita intensidade pro ${club.name}!`,
      subAnalyst,
      2.8,
      'calm',
      2.8
    );
    return true;
  }

  public getTacticalSnapshot(team: 'home' | 'away'): {
    lineup: TacticalPlayerInfo[];
    bench: SquadPlayer[];
    formation: FormationId;
    subsUsed: number;
    maxSubs: number;
  } {
    const lineup: TacticalPlayerInfo[] = this.players
      .filter((p) => p.team === team)
      .sort((a, b) => a.index - b.index)
      .map((p) => ({
        id: p.id,
        index: p.index,
        name: p.name,
        number: p.number,
        role: p.role,
        stamina: Math.round(p.stamina),
        attack: p.attack,
        defense: p.defense,
        speed: p.speed,
        subbedIn: this.subbedInIds.has(p.id),
      }));
    return {
      lineup,
      bench: (team === 'home' ? this.homeBench : this.awayBench).map((b) => ({ ...b })),
      formation: team === 'home' ? this.homeFormation : this.awayFormation,
      subsUsed: team === 'home' ? this.homeSubsUsed : this.awaySubsUsed,
      maxSubs: this.maxSubs,
    };
  }

  private triggerGoalFireworks(scoringClub: Club): void {
    this.fireworkShowTimer = 3.8;
    this.fireworkSpawnCooldown = 0;
    this.fireworkColors = [
      scoringClub.homeKit.primary,
      scoringClub.homeKit.secondary === '#111111' || scoringClub.homeKit.secondary === '#121212'
        ? '#facc15'
        : scoringClub.homeKit.secondary,
      '#fde047',
    ];
    // Dispara 3 foguetes imediatos no instante do gol!
    for (let i = 0; i < 3; i++) {
      this.spawnFireworkRocket(0.16 + i * 0.34 + (Math.random() - 0.5) * 0.12);
    }
  }

  private spawnFireworkRocket(normX?: number): void {
    const x = normX ?? 0.12 + Math.random() * 0.76;
    const palette = [
      this.fireworkColors[0],
      this.fireworkColors[1],
      this.fireworkColors[2],
      '#ffffff',
      '#38bdf8',
      '#fb7185',
      '#34d399',
    ];
    const color = palette[Math.floor(Math.random() * palette.length)];
    const secondaryColor = palette[Math.floor(Math.random() * palette.length)];
    this.fireworkRockets.push({
      x,
      y: 0.96,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -(0.82 + Math.random() * 0.36),
      targetY: 0.12 + Math.random() * 0.28,
      color,
      secondaryColor,
      trail: [{ x, y: 0.96 }],
      exploded: false,
    });
    retroAudio.playFireworkLaunch();
  }

  private explodeFireworkRocket(r: FireworkRocket): void {
    r.exploded = true;
    this.fireworkFlash = Math.min(1, this.fireworkFlash + 0.42);
    retroAudio.playFireworkBurst();

    const sparkCount = 34 + Math.floor(Math.random() * 16);
    const isRing = Math.random() < 0.38;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
      const speed = isRing
        ? 0.20 + Math.random() * 0.05
        : 0.07 + Math.random() * 0.24;
      const maxLife = 0.78 + Math.random() * 0.55;
      this.fireworkSparks.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 1.45,
        color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? r.color : r.secondaryColor,
        life: maxLife,
        maxLife,
        size: 2.2 + Math.random() * 2.8,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateFireworks(dt: number): void {
    if (this.fireworkFlash > 0) {
      this.fireworkFlash = Math.max(0, this.fireworkFlash - dt * 2.4);
    }

    if (this.fireworkShowTimer > 0) {
      this.fireworkShowTimer -= dt;
      this.fireworkSpawnCooldown -= dt;
      if (this.fireworkSpawnCooldown <= 0) {
        this.spawnFireworkRocket();
        if (Math.random() < 0.45) {
          this.spawnFireworkRocket();
        }
        this.fireworkSpawnCooldown = 0.30 + Math.random() * 0.28;
      }
    }

    for (let i = this.fireworkRockets.length - 1; i >= 0; i--) {
      const r = this.fireworkRockets[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy += 0.32 * dt;
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 9) r.trail.shift();

      if (r.y <= r.targetY || r.vy >= -0.05) {
        this.explodeFireworkRocket(r);
        this.fireworkRockets.splice(i, 1);
      }
    }

    for (let i = this.fireworkSparks.length - 1; i >= 0; i--) {
      const sp = this.fireworkSparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= Math.pow(0.28, dt);
      sp.vy *= Math.pow(0.32, dt);
      sp.vy += 0.26 * dt; // gravidade caindo como salgueiro luminoso
      sp.twinkle += dt * 16;
      sp.life -= dt;
      if (sp.life <= 0) {
        this.fireworkSparks.splice(i, 1);
      }
    }
  }

  private setupKickoff(kickingTeam: 'home' | 'away', isMatchStart = false): void {
    this.phase = 'KICKOFF';
    this.kickoffTeam = kickingTeam;
    this.isOpeningKickoff = isMatchStart;
    this.phaseTimer = isMatchStart ? 1.85 : 0.95;
    this.goalBanner = null;
    this.setPieceTakerId = null;

    this.ball.x = FIELD_CENTER_X;
    this.ball.y = FIELD_CENTER_Y;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.ownerId = null;
    this.ball.shotInFlight = false;
    this.ball.passTargetId = null;
    this.ball.isCrossBall = false;

    for (const p of this.players) {
      const pos = this.computeHomePosition(p.team, p.index);
      p.homeX = pos.x;
      p.homeY = pos.y;
      p.x = pos.x;
      p.y = pos.y;
      p.vx = 0;
      p.vy = 0;
      p.facingX = this.getAttackDir(p.team);
      p.facingY = 0;
      p.tackleTimer = 0;
      p.stealAnimTimer = 0;
      p.passAnimTimer = 0;
      p.headerAnimTimer = 0;
      p.skillMoveTimer = 0;
      p.celebrating = false;
      p.stunTimer = 0;
      p.kickAnimTimer = 0;
      p.diveTimer = 0;
      p.diveDirX = 0;
      p.diveDirY = 0;
      p.gkRushActive = false;
      p.isCharging = false;
      p.chargePower = 0;
      p.chargeType = 'shot';
      p.holdBallTimer = 0;
      p.gkNoCatchTimer = 0;
      p.stamina = Math.min(100, p.stamina + 18);
    }
    this.gkDiveTargets.clear();
    this.shotAfterTouchTimer = 0;
    this.shotControllerTeam = null;

    // Posiciona o juiz e os 2 bandeirinhas
    this.referee.x = FIELD_CENTER_X;
    this.referee.y = FIELD_CENTER_Y - 125;
    this.referee.vx = 0;
    this.referee.vy = 0;
    this.referee.whistleTimer = 0.85;
    this.referee.cardTimer = 0;
    this.referee.signalTimer = 0;

    this.linesmen[0].x = FIELD_CENTER_X + 260;
    this.linesmen[0].y = FIELD_TOP - 22;
    this.linesmen[0].flagRaisedTimer = 0;
    this.linesmen[1].x = FIELD_CENTER_X - 260;
    this.linesmen[1].y = FIELD_BOTTOM + 22;
    this.linesmen[1].flagRaisedTimer = 0;

    // Posiciona o centroavante que dá a saída no círculo central (12 jogadores: 11 e 10)
    const kicker = this.players.find((p) => p.team === kickingTeam && p.index === 11);
    const partner = this.players.find((p) => p.team === kickingTeam && p.index === 10);
    const dir = this.getAttackDir(kickingTeam);
    if (kicker) {
      kicker.x = FIELD_CENTER_X - dir * 18;
      kicker.y = FIELD_CENTER_Y;
    }
    if (partner) {
      partner.x = FIELD_CENTER_X - dir * 50;
      partner.y = FIELD_CENTER_Y - 64;
    }

    // Afasta adversários do círculo central
    for (const p of this.players) {
      if (p.team !== kickingTeam && p.role !== 'GK') {
        const d = Math.hypot(p.x - FIELD_CENTER_X, p.y - FIELD_CENTER_Y);
        if (d < 150) {
          p.x = FIELD_CENTER_X + dir * 156;
        }
      }
    }

    this.p1SelectedId = 'home-11';
    this.p2SelectedId = 'away-11';

    if (isMatchStart) {
      this.showCallout('EFATÁ SOCCER 26', `${this.homeClub.name} x ${this.awayClub.name}`, 'info', 1.8);
      this.spawnCrowdAnthem('home');
      this.pendingRivalReply = { team: 'away', delay: 2.6 };
    } else {
      retroAudio.playWhistle('short');
    }
  }

  public broadcast(
    line: string,
    priority: 'high' | 'normal' = 'normal',
    mood: NarrationMood = 'calm',
    displaySec = 3.0,
    speaker: BroadcastSpeaker = 'galvao'
  ): void {
    if (priority === 'normal' && this.broadcastTimer > 0.22) return;
    this.broadcastLine = line;
    this.broadcastSpeaker = speaker;
    this.broadcastPartner = null;
    this.broadcastTimer = displaySec;
    retroAudio.narrate(line, priority, mood, speaker);
  }

  public broadcastDialogue(
    leadLine: string,
    replyLine: string,
    analyst: 'casagrande' | 'ronaldo' | 'neto',
    priority: 'high' | 'normal' = 'high',
    mood: NarrationMood = 'excited',
    displaySec = 5.4
  ): void {
    this.pendingCommentator = null;
    this.broadcastLine = `${leadLine} — ${replyLine}`;
    this.broadcastSpeaker = 'galvao';
    this.broadcastPartner = analyst;
    this.broadcastTimer = displaySec;
    this.livePlayByPlayTimer = Math.max(this.livePlayByPlayTimer, displaySec + 0.6);
    retroAudio.narrateDialogue(
      [
        { speaker: 'galvao', text: leadLine },
        { speaker: analyst, text: replyLine },
      ],
      priority,
      mood
    );
  }

  private queueCommentator(
    line: string,
    speaker: 'casagrande' | 'ronaldo' | 'neto',
    delay = 2.4,
    mood: NarrationMood = 'calm',
    displaySec = 3.1
  ): void {
    this.pendingCommentator = { line, speaker, mood, displaySec, delay };
  }

  private nextCommentator(): 'casagrande' | 'ronaldo' | 'neto' {
    this.commentatorToggle = (this.commentatorToggle + 1) % 3;
    if (this.commentatorToggle === 1) return 'casagrande';
    if (this.commentatorToggle === 2) return 'ronaldo';
    return 'neto';
  }

  private getClubChant(team: 'home' | 'away'): string {
    const club = team === 'home' ? this.homeClub : this.awayClub;
    const pair = CLUB_CHANTS[club.id];
    if (pair) return pick(pair);
    return `VAI ${club.name.toUpperCase()}!`;
  }

  private getClubAnthem(team: 'home' | 'away'): string {
    const club = team === 'home' ? this.homeClub : this.awayClub;
    const pair = CLUB_ANTHEMS[club.id];
    if (pair) return pick(pair);
    return `SALVE O ${club.name.toUpperCase()}, CAMPEÃO!`;
  }

  private pushCrowdBubble(
    team: 'home' | 'away',
    text: string,
    kind: CrowdChantBubble['kind'],
    duration: number
  ): void {
    const minX = team === 'home' ? FIELD_LEFT + 130 : FIELD_CENTER_X + 110;
    const maxX = team === 'home' ? FIELD_CENTER_X - 110 : FIELD_RIGHT - 130;
    const worldX = minX + Math.random() * (maxX - minX);

    this.crowdChants.push({
      id: this.nextChantId++,
      text,
      worldX,
      team,
      kind,
      timer: duration,
      maxTimer: duration,
    });
    if (this.crowdChants.length > 6) {
      this.crowdChants.shift();
    }
  }

  private spawnCrowdChant(team: 'home' | 'away', loud = false): void {
    const text = this.getClubChant(team);
    this.pushCrowdBubble(team, text, 'chant', loud ? 2.7 : 2.2);
    this.crowdExcitement = Math.max(this.crowdExcitement, loud ? 0.85 : 0.48);
    retroAudio.playCrowdChant(text, loud);
  }

  private spawnCrowdAnthem(team: 'home' | 'away'): void {
    const club = team === 'home' ? this.homeClub : this.awayClub;
    const verse = this.getClubAnthem(team);
    this.pushCrowdBubble(team, `♪ ${verse}`, 'anthem', 3.4);
    this.crowdExcitement = Math.max(this.crowdExcitement, 0.72);
    const seed = club.id.charCodeAt(0) + club.id.charCodeAt(1);
    retroAudio.playCrowdAnthem(verse, seed);
  }

  private spawnCrowdProvocation(tauntingTeam: 'home' | 'away', isReply = false): void {
    const club = tauntingTeam === 'home' ? this.homeClub : this.awayClub;
    const rival = tauntingTeam === 'home' ? this.awayClub : this.homeClub;
    const cName = club.shortName;
    const rName = rival.name.toUpperCase();
    const rShort = rival.shortName;

    const line = isReply
      ? pick([
          `RESPEITA O ${club.name.toUpperCase()}!!`,
          `AQUI NÃO, ${rShort}! VAMO VIRAR!!`,
          `SEGURA O ${club.name.toUpperCase()}, ${rShort}!!`,
          `CALA A BOCA, ${rShort}! OLHA O ${cName}!!`,
        ])
      : pick([
          `CADÊ A TORCIDA DO ${rName}?!`,
          `TÁ COM MEDO, ${rName}? AQUI É ${cName}!!`,
          `OLÉÉÉ! PASSA A BOLA, ${rShort}!!`,
          `SILÊNCIO NO SETOR DO ${rName}!!`,
          `VAI CHORAR, ${rShort}? SÓ DÁ ${cName}!!`,
        ]);

    this.pushCrowdBubble(tauntingTeam, line, 'taunt', 2.8);
    this.crowdExcitement = Math.max(this.crowdExcitement, 0.76);
    retroAudio.playCrowdProvocation(line);

    if (!isReply) {
      const otherTeam: 'home' | 'away' = tauntingTeam === 'home' ? 'away' : 'home';
      this.pendingRivalReply = { team: otherTeam, delay: 1.75 };
    }
  }

  public showCallout(
    text: string,
    subtext: string | undefined,
    type: CalloutBanner['type'],
    duration = 1.6
  ): void {
    this.callout = {
      text,
      subtext,
      timer: duration,
      maxTimer: duration,
      type,
    };
  }

  public getMatchMinute(): number {
    const ratio = Math.min(1, this.elapsedRealSeconds / Math.max(1, this.totalRealSeconds));
    return Math.min(90, Math.max(1, Math.ceil(ratio * 90)));
  }

  public togglePause(): void {
    if (this.phase === 'FULLTIME') return;
    this.isPaused = !this.isPaused;
  }

  public destroy(): void {
    if (this.finishTimeoutId !== null) {
      window.clearTimeout(this.finishTimeoutId);
      this.finishTimeoutId = null;
    }
  }

  private captureReplaySnapshot(): ReplayFrameSnapshot {
    return {
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        z: this.ball.z,
        vx: this.ball.vx,
        vy: this.ball.vy,
        vz: this.ball.vz,
        rotation: this.ball.rotation,
        ownerId: this.ball.ownerId,
        shotInFlight: this.ball.shotInFlight,
        isCrossBall: this.ball.isCrossBall,
        passTargetX: this.ball.passTargetX,
        passTargetY: this.ball.passTargetY,
      },
      players: this.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facingX: p.facingX,
        facingY: p.facingY,
        animFrame: p.animTimer % 6,
        tackleTimer: p.tackleTimer,
        stealAnimTimer: p.stealAnimTimer,
        passAnimTimer: p.passAnimTimer,
        headerAnimTimer: p.headerAnimTimer,
        bicycleAnimTimer: p.bicycleAnimTimer,
        skillMoveTimer: p.skillMoveTimer,
        skillMoveType: p.skillMoveType,
        kickType: p.kickType,
        celebrating: p.celebrating,
        stunTimer: p.stunTimer,
        kickAnimTimer: p.kickAnimTimer,
        diveTimer: p.diveTimer,
        diveDirX: p.diveDirX,
        diveDirY: p.diveDirY,
        gkRushActive: p.gkRushActive,
      })),
      referee: {
        x: this.referee.x,
        y: this.referee.y,
        vx: this.referee.vx,
        vy: this.referee.vy,
        facingX: this.referee.facingX,
        animFrame: this.referee.animTimer % 6,
        whistleTimer: this.referee.whistleTimer,
        signalTimer: this.referee.signalTimer,
        signalDirX: this.referee.signalDirX,
      },
      linesmen: [
        {
          x: this.linesmen[0].x,
          y: this.linesmen[0].y,
          vx: this.linesmen[0].vx,
          facingX: this.linesmen[0].facingX,
          animFrame: this.linesmen[0].animTimer % 6,
          flagRaisedTimer: this.linesmen[0].flagRaisedTimer,
          flagDirX: this.linesmen[0].flagDirX,
        },
        {
          x: this.linesmen[1].x,
          y: this.linesmen[1].y,
          vx: this.linesmen[1].vx,
          facingX: this.linesmen[1].facingX,
          animFrame: this.linesmen[1].animTimer % 6,
          flagRaisedTimer: this.linesmen[1].flagRaisedTimer,
          flagDirX: this.linesmen[1].flagDirX,
        },
      ],
      netRipples: this.netRipples.map((r) => ({ ...r })),
      cameraX: this.cameraX,
      cameraY: this.cameraY,
    };
  }

  private applyReplaySnapshot(snap: ReplayFrameSnapshot): void {
    this.ball.x = snap.ball.x;
    this.ball.y = snap.ball.y;
    this.ball.z = snap.ball.z;
    this.ball.vx = snap.ball.vx;
    this.ball.vy = snap.ball.vy;
    this.ball.vz = snap.ball.vz;
    this.ball.rotation = snap.ball.rotation;
    this.ball.ownerId = snap.ball.ownerId;
    this.ball.shotInFlight = snap.ball.shotInFlight;
    this.ball.isCrossBall = snap.ball.isCrossBall;
    this.ball.passTargetX = snap.ball.passTargetX;
    this.ball.passTargetY = snap.ball.passTargetY;

    for (let i = 0; i < snap.players.length && i < this.players.length; i++) {
      const sp = snap.players[i];
      const p = this.players[i];
      p.x = sp.x;
      p.y = sp.y;
      p.vx = sp.vx;
      p.vy = sp.vy;
      p.facingX = sp.facingX;
      p.facingY = sp.facingY;
      p.animFrame = sp.animFrame;
      p.animTimer = sp.animFrame;
      p.tackleTimer = sp.tackleTimer;
      p.stealAnimTimer = sp.stealAnimTimer;
      p.passAnimTimer = sp.passAnimTimer;
      p.headerAnimTimer = sp.headerAnimTimer;
      p.bicycleAnimTimer = sp.bicycleAnimTimer;
      p.queuedBicycle = false;
      p.skillMoveTimer = sp.skillMoveTimer;
      p.skillMoveType = sp.skillMoveType;
      p.kickType = sp.kickType;
      p.celebrating = sp.celebrating;
      p.stunTimer = sp.stunTimer;
      p.kickAnimTimer = sp.kickAnimTimer;
      p.diveTimer = sp.diveTimer;
      p.diveDirX = sp.diveDirX;
      p.diveDirY = sp.diveDirY;
      p.gkRushActive = sp.gkRushActive;
      p.isCharging = false;
      p.chargePower = 0;
    }

    this.referee.x = snap.referee.x;
    this.referee.y = snap.referee.y;
    this.referee.vx = snap.referee.vx;
    this.referee.vy = snap.referee.vy;
    this.referee.facingX = snap.referee.facingX;
    this.referee.animFrame = Math.floor(snap.referee.animFrame) % 6;
    this.referee.animTimer = snap.referee.animFrame;
    this.referee.whistleTimer = snap.referee.whistleTimer;
    this.referee.signalTimer = snap.referee.signalTimer;
    this.referee.signalDirX = snap.referee.signalDirX;

    for (let i = 0; i < 2; i++) {
      this.linesmen[i].x = snap.linesmen[i].x;
      this.linesmen[i].y = snap.linesmen[i].y;
      this.linesmen[i].vx = snap.linesmen[i].vx;
      this.linesmen[i].facingX = snap.linesmen[i].facingX;
      this.linesmen[i].animFrame = Math.floor(snap.linesmen[i].animFrame) % 6;
      this.linesmen[i].animTimer = snap.linesmen[i].animFrame;
      this.linesmen[i].flagRaisedTimer = snap.linesmen[i].flagRaisedTimer;
      this.linesmen[i].flagDirX = snap.linesmen[i].flagDirX;
    }

    this.netRipples = snap.netRipples.map((r) => ({ ...r }));
    this.cameraX = snap.ball.x;
    this.cameraY = snap.ball.y;
  }

  private pushReplayFrame(): void {
    this.replayCaptureTick++;
    if (this.replayCaptureTick % 2 !== 0) return; // 30 FPS limpo
    this.replayRing.push(this.captureReplaySnapshot());
    if (this.replayRing.length > 105) {
      this.replayRing.shift();
    }
  }

  private startGoalReplay(): void {
    if (this.replayRing.length < 18) {
      this.setupKickoff(this.replayPendingConcedingTeam, false);
      return;
    }
    this.preReplayState = this.captureReplaySnapshot();
    this.replayPlaybackFrames = this.replayRing.slice();
    this.replayCursor = 0;
    this.phase = 'GOAL_REPLAY';
    this.applyReplaySnapshot(this.replayPlaybackFrames[0]);
    if (this.replayMeta) {
      const analyst = this.nextCommentator();
      const scorer = this.replayMeta.scorerName;
      const teamName = this.replayMeta.teamName;
      const isBike = Boolean(this.replayMeta.isBicycleGoal);
      const leadCall = isBike
        ? pick([
            `Olha no replay essa BICICLETA ESPETACULAR de ${scorer} pro ${teamName}! Pintura de placa!!`,
            `Reveja em câmera lenta o GOLAÇO DE BICICLETA de ${scorer}! A física não permite!!`,
          ])
        : pick([
            `Olha no replay o golaço de ${scorer} pro ${teamName}! O que você achou?!`,
            `Vamos rever no detalhe esse lance de ${scorer}! Que beleza!`,
          ]);
      const replayComment = isBike
        ? analyst === 'ronaldo'
          ? `Fenomenal, Galvão! De bicicleta no cruzamento! ${scorer} subiu no segundo andar e acertou uma acrobacia perfeita!`
          : analyst === 'neto'
            ? `Pão!! Gol de bicicleta digno de Prêmio Puskás, Galvão! Você tá de brincadeira, que pintura absurda de ${scorer}!`
            : `Uma obra de arte, Galvão! O cruzamento veio na medida e ${scorer} virou uma bicicleta histórica pro ${teamName}!`
        : analyst === 'ronaldo'
          ? pick([
              `Que frieza de ${scorer}, Galvão! Como centroavante eu bato palmas, bola colocada onde a coruja dorme!`,
              `Fenomenal, Galvão! Repara no movimento de ${scorer}, tirou do goleiro com categoria pro ${teamName}!`,
              `Golaço de placa, Galvão! Dá pra ver como ${scorer} escolheu o canto perfeito!`,
            ])
          : analyst === 'neto'
            ? pick([
                `Pão! Que golaço absurdo, Galvão! ${scorer} meteu sem chance pro goleiro! Você tá de brincadeira?!`,
                `Ô Galvão, baita pintura de ${scorer}! Diga-se de passagem, nem dois goleiros pegavam essa bola!`,
                `Que fase vive o ${scorer}, Galvão! Olha essa finalização, isso aí é gol de craque!`,
              ])
            : pick([
                `A defesa vacilou e ${scorer} não perdoou, Galvão! Gol de quem tem faro de artilheiro!`,
                `Que jogadaça, Galvão! O ${teamName} acreditou no lance e ${scorer} guardou com personalidade!`,
                `É isso aí, Galvão! Olha o posicionamento de ${scorer}, chapou bonito pro fundo da rede!`,
              ]);
      this.broadcastDialogue(leadCall, replayComment, analyst, 'high', 'excited', 5.2);
    }
  }

  public skipReplay(): void {
    if (this.phase !== 'GOAL_REPLAY') return;
    this.finishGoalReplay();
  }

  private finishGoalReplay(): void {
    if (this.preReplayState) {
      this.applyReplaySnapshot(this.preReplayState);
      this.preReplayState = null;
    }
    this.replayPlaybackFrames = [];
    this.replayRing = [];
    this.replayMeta = null;
    this.setupKickoff(this.replayPendingConcedingTeam, false);
  }

  public step(dt: number, p1Input: PlayerInputState, p2Input: PlayerInputState): void {
    if (p1Input.pauseJustPressed) {
      this.togglePause();
    }
    if (this.isPaused) return;

    this.animTime += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
    if (this.lastTouchedCooldown > 0) this.lastTouchedCooldown = Math.max(0, this.lastTouchedCooldown - dt);
    if (this.playByPlayCooldown > 0) this.playByPlayCooldown = Math.max(0, this.playByPlayCooldown - dt);

    if (this.broadcastTimer > 0) {
      this.broadcastTimer -= dt;
      if (this.broadcastTimer <= 0) this.broadcastLine = null;
    }

    // Dispara o comentário agendado do Casagrande ou Ronaldo logo após a chamada do Galvão!
    if (this.pendingCommentator && this.phase !== 'FULLTIME') {
      this.pendingCommentator.delay -= dt;
      if (this.pendingCommentator.delay <= 0) {
        const next = this.pendingCommentator;
        this.pendingCommentator = null;
        this.broadcast(next.line, 'high', next.mood, next.displaySec, next.speaker);
        this.livePlayByPlayTimer = Math.max(this.livePlayByPlayTimer, 2.8);
      }
    }

    if (this.callout) {
      this.callout.timer -= dt;
      if (this.callout.timer <= 0) this.callout = null;
    }

    for (let i = this.crowdChants.length - 1; i >= 0; i--) {
      this.crowdChants[i].timer -= dt;
      if (this.crowdChants[i].timer <= 0) this.crowdChants.splice(i, 1);
    }

    // Suaviza animação e áudio contínuo da torcida do estádio
    const targetCrowd =
      this.phase === 'GOAL_CELEBRATION' ? 1 : this.phase === 'GOAL_REPLAY' ? 0.62 : 0.34;
    this.crowdExcitement += (targetCrowd - this.crowdExcitement) * Math.min(1, dt * 3.5);
    retroAudio.setCrowdExcitement(this.crowdExcitement);

    // Atualiza fogos de artifício no céu do estádio durante comemoração e início do replay!
    this.updateFireworks(dt);

    // --- FASE DE REPLAY DOS GOLS (CÂMERA LENTA TV) ---
    if (this.phase === 'GOAL_REPLAY') {
      const skipRequested =
        p1Input.passJustPressed ||
        p1Input.shootJustPressed ||
        p1Input.lobJustPressed ||
        p2Input.passJustPressed ||
        p2Input.shootJustPressed ||
        p2Input.lobJustPressed;
      if (skipRequested && this.replayCursor > 8) {
        this.finishGoalReplay();
        return;
      }

      // 30fps gravados * 0.52 = câmera lenta cinematográfica (~5.5s)
      this.replayCursor += dt * 30 * 0.52;
      const frameIdx = Math.floor(this.replayCursor);
      if (frameIdx >= this.replayPlaybackFrames.length) {
        this.finishGoalReplay();
        return;
      }
      this.applyReplaySnapshot(this.replayPlaybackFrames[frameIdx]);
      return;
    }

    // Atualiza vibração das redes
    for (let i = this.netRipples.length - 1; i >= 0; i--) {
      const r = this.netRipples[i];
      r.phase += dt * 16;
      r.amplitude *= Math.pow(0.18, dt);
      if (r.amplitude < 0.35) this.netRipples.splice(i, 1);
    }

    // Atualiza movimentação do Juiz e dos 2 Bandeirinhas
    this.updateOfficials(dt);

    if (this.phase === 'FULLTIME') {
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'KICKOFF') {
      this.phaseTimer -= dt;
      this.updateCamera(dt);
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        if (this.isOpeningKickoff) {
          this.isOpeningKickoff = false;
          // Para suavemente a música de abertura (País do Futebol / Música da Copa) no apito inicial!
          retroAudio.stopMenuMusic(0.45);
          retroAudio.playWhistle('short');
          const homeStar = this.players.find((p) => p.team === 'home' && p.index === 11) ?? this.homeClub.squad[11];
          const awayStar = this.players.find((p) => p.team === 'away' && p.index === 11) ?? this.awayClub.squad[11];
          const climateLine =
            this.weather === 'CHUVA'
              ? 'Muita chuva no gramado!'
              : this.weather === 'NEVE'
                ? 'Neve caindo no estádio!'
                : this.timeOfDay === 'NOITE'
                  ? 'Noite de futebol iluminado!'
                  : 'Tarde linda de sol!';
          const openingAnalyst = this.nextCommentator();
          const galvaoOpen = `Bem, amigos da Rede Efatá! ${climateLine} Bola rolando para ${this.homeClub.name} e ${this.awayClub.name}, com ${homeStar.name} e ${awayStar.name} em campo!`;
          const analystOpen =
            openingAnalyst === 'casagrande'
              ? `Grande jogo hoje, Galvão! ${this.homeClub.name} no ${this.homeFormation} e ${this.awayClub.name} no ${this.awayFormation} prometem muito futebol ofensivo!`
              : openingAnalyst === 'ronaldo'
                ? `Fala, Galvão! Campo gigante, 12 contra 12 com laterais apoiando! Hoje tem tudo pra ser um espetáculo de gols!`
                : `Ô Galvão, baita clássico na tela! Diga-se de passagem, com ${homeStar.name} e ${awayStar.name} hoje vai chover gol!`;
          this.broadcastDialogue(galvaoOpen, analystOpen, openingAnalyst, 'high', 'excited', 6.2);
        }
        const kicker = this.players.find((p) => p.team === this.kickoffTeam && p.index === 11);
        if (kicker) {
          this.giveBallTo(kicker);
        }
      }
      return;
    }

    if (this.phase === 'HALFTIME') {
      this.phaseTimer -= dt;
      this.updateCamera(dt);
      if (this.phaseTimer <= 0) {
        this.half = 2;
        this.homeAttackDir = -1;
        this.setupKickoff('away', false);
        this.showCallout('2º TEMPO!', 'Troca de lados', 'info', 1.4);
        this.broadcast(
          `Rola a bola pro segundo tempo, amigos! ${this.homeClub.name} ${this.homeScore}, ${this.awayClub.name} ${this.awayScore}!`,
          'high',
          'excited',
          3.0,
          'galvao'
        );
      }
      return;
    }

    if (this.phase === 'GOAL_CELEBRATION') {
      this.phaseTimer -= dt;
      this.updateBallPhysics(dt, true);
      for (const p of this.players) {
        if (p.team === this.ball.lastTouchTeam && p.role !== 'GK') {
          p.celebrating = true;
          p.animTimer += dt * 11;
          p.animFrame = Math.floor(p.animTimer) % 6;
        }
      }
      this.updateCamera(dt);
      // Continua gravando 0.65s pós-gol para o replay mostrar a rede balançando e o grito de gol!
      if (this.replayGoalRecordTimer > 0) {
        this.replayGoalRecordTimer -= dt;
        this.pushReplayFrame();
      }
      if (this.phaseTimer <= 0) {
        this.startGoalReplay();
      }
      return;
    }

    // Fases de bola parada (LATERAL, ESCANTEIO, TIRO DE META, FALTA)
    if (
      this.phase === 'THROW_IN' ||
      this.phase === 'CORNER' ||
      this.phase === 'GOAL_KICK' ||
      this.phase === 'FREE_KICK'
    ) {
      this.updateSetPiece(dt, p1Input, p2Input);
      this.updateCamera(dt);
      return;
    }

    // --- FASE PLAYING ---
    this.elapsedRealSeconds += dt;

    // Resposta imediata da torcida rival quando provocada
    if (this.pendingRivalReply) {
      this.pendingRivalReply.delay -= dt;
      if (this.pendingRivalReply.delay <= 0) {
        const replyTeam = this.pendingRivalReply.team;
        this.pendingRivalReply = null;
        this.spawnCrowdProvocation(replyTeam, true);
      }
    }

    // Torcida alterna entre Hino do Clube, Grito de Guerra e Provocações à torcida rival!
    this.crowdChantTimer -= dt;
    if (this.crowdChantTimer <= 0) {
      this.crowdChantTimer = 5.2 + Math.random() * 3.4;
      this.crowdAnthemCounter++;
      const leadingTeam: 'home' | 'away' =
        this.homeScore > this.awayScore
          ? 'home'
          : this.awayScore > this.homeScore
            ? 'away'
            : this.ball.lastTouchTeam ?? (Math.random() < 0.55 ? 'home' : 'away');

      if (this.crowdAnthemCounter % 3 === 1) {
        this.spawnCrowdAnthem(leadingTeam);
      } else if (this.crowdAnthemCounter % 3 === 2) {
        this.spawnCrowdProvocation(leadingTeam, false);
      } else {
        this.spawnCrowdChant(leadingTeam, false);
      }
    }

    // Estatística de posse
    if (this.ball.ownerId) {
      if (this.ball.ownerId.startsWith('home')) this.stats.homePossessionTicks++;
      else this.stats.awayPossessionTicks++;
    } else if (this.ball.lastTouchTeam === 'home') {
      this.stats.homePossessionTicks++;
    } else if (this.ball.lastTouchTeam === 'away') {
      this.stats.awayPossessionTicks++;
    }

    // Checa intervalo (50% do tempo)
    if (this.half === 1 && this.elapsedRealSeconds >= this.totalRealSeconds * 0.5) {
      this.phase = 'HALFTIME';
      this.phaseTimer = 2.2;
      this.ball.ownerId = null;
      this.referee.whistleTimer = 1.2;
      this.showCallout('INTERVALO!', `${this.homeClub.shortName} ${this.homeScore} x ${this.awayScore} ${this.awayClub.shortName}`, 'info', 2.2);
      retroAudio.playWhistle('double');
      const htAnalyst = this.nextCommentator();
      const htLead = `Apita o árbitro! Termina o primeiro tempo, amigos! ${this.homeClub.name} ${this.homeScore}, ${this.awayClub.name} ${this.awayScore}!`;
      const htReply =
        htAnalyst === 'casagrande'
          ? `Bom primeiro tempo, Galvão! Quem caprichar na finalização no segundo tempo leva a vitória!`
          : htAnalyst === 'ronaldo'
            ? `Jogaço até aqui, Galvão! Os atacantes estão criando muito espaço, vem mais gol por aí!`
            : `Primeiro tempo sensacional, Galvão! Diga-se de passagem, quem vacilar na etapa final vai tomar gol!`;
      this.broadcastDialogue(htLead, htReply, htAnalyst, 'high', 'excited', 4.6);
      return;
    }

    // Checa fim de jogo
    if (this.elapsedRealSeconds >= this.totalRealSeconds) {
      this.finishMatch();
      return;
    }

    // Atualiza seleção automática se um jogador humano pegar a bola
    this.syncHumanSelection();

    // Atualiza todos os 14 jogadores
    for (const p of this.players) {
      const isP1 = p.id === this.p1SelectedId;
      const isP2 = this.config.controlMode === '1P_2P' && p.id === this.p2SelectedId;

      if (p.role === 'GK') {
        const gkInput =
          p.team === 'home'
            ? p1Input
            : this.config.controlMode === '1P_2P'
              ? p2Input
              : null;
        this.updateGoalkeeperAI(p, dt, gkInput);
      } else if (isP1) {
        this.updateHumanPlayer(p, p1Input, dt);
      } else if (isP2) {
        this.updateHumanPlayer(p, p2Input, dt);
      } else {
        this.updateOutfieldAI(p, dt);
      }
    }

    // Resolve empurrões / separação leve entre jogadores
    this.resolvePlayerSeparation();

    // Controle leve da bola em voo logo após o chute (efeito / curva com o direcional!)
    this.applyShotAfterTouch(dt, p1Input, p2Input);

    // Física 3D da bola + checagem de gol / laterais / escanteio / tiro de meta
    this.updateBallPhysics(dt, false);

    // Narração viva lance a lance (nomes dos jogadores, ações e setor do campo)
    this.updateLivePlayByPlay(dt);

    // Câmera aérea acompanhando suavemente
    this.updateCamera(dt);

    // Grava quadro no buffer circular de replay dos gols
    this.pushReplayFrame();
  }

  private updateLivePlayByPlay(dt: number): void {
    this.livePlayByPlayTimer -= dt;
    if (this.livePlayByPlayTimer > 0) return;

    // Aguarda apenas janela mínima para manter narração viva e contínua durante toda a partida!
    if (this.broadcastTimer > 0.15 || this.playByPlayCooldown > 0) {
      this.livePlayByPlayTimer = 0.35;
      return;
    }

    const minute = this.getMatchMinute();

    // 1. Tensão da reta final do 2º tempo (uma vez por partida)
    if (!this.announcedLateMatch && this.half === 2 && minute >= 78) {
      this.announcedLateMatch = true;
      this.livePlayByPlayTimer = 3.8;
      this.playByPlayCooldown = 2.4;
      const scoreInfo =
        this.homeScore === this.awayScore
          ? `Tudo empatado em ${this.homeScore} a ${this.awayScore}!`
          : this.homeScore > this.awayScore
            ? `${this.homeClub.name} vai segurando a vitória por ${this.homeScore} a ${this.awayScore}!`
            : `${this.awayClub.name} vai vencendo por ${this.awayScore} a ${this.homeScore}!`;
      this.broadcast(
        `Reta final de partida, amigos! ${minute} minutos! ${scoreInfo} É teste pra cardíaco! Haja coração!`,
        'normal',
        'excited',
        3.1,
        'galvao'
      );
      return;
    }

    // 2. Comentário de posse de bola do Casagrande ou Ronaldo no decorrer do jogo (uma vez por partida)
    if (!this.announcedPossessionStat && minute >= 24 && minute <= 68) {
      const totalTicks = this.stats.homePossessionTicks + this.stats.awayPossessionTicks;
      if (totalTicks > 140) {
        const homePct = Math.round((this.stats.homePossessionTicks / totalTicks) * 100);
        if (homePct >= 55 || homePct <= 45) {
          this.announcedPossessionStat = true;
          this.livePlayByPlayTimer = 3.6;
          this.playByPlayCooldown = 2.2;
          const domClub = homePct >= 55 ? this.homeClub : this.awayClub;
          const otherClub = homePct >= 55 ? this.awayClub : this.homeClub;
          const domPct = homePct >= 55 ? homePct : 100 - homePct;
          const analyst = this.nextCommentator();
          this.broadcast(
            analyst === 'casagrande'
              ? `Olha, Galvão, o ${domClub.name} domina a posse com ${domPct} por cento e empurra o ${otherClub.name} pra trás!`
              : analyst === 'ronaldo'
                ? `É isso mesmo, Galvão! O ${domClub.name} tá mandando no jogo com ${domPct} por cento de posse!`
                : `Ô Galvão, o ${domClub.name} tá amassando com ${domPct} por cento de posse! Diga-se de passagem, o ${otherClub.name} precisa acordar!`,
            'normal',
            'calm',
            3.0,
            analyst
          );
          return;
        }
      }
    }

    // 3. Narração contínua mesmo com bola solta / disputa no gramado!
    const owner = this.players.find((pl) => pl.id === this.ball.ownerId);
    if (!owner) {
      const nearest = this.players
        .filter((pl) => pl.role !== 'GK')
        .sort(
          (a, b) =>
            Math.hypot(a.x - this.ball.x, a.y - this.ball.y) -
            Math.hypot(b.x - this.ball.x, b.y - this.ball.y)
        )[0];
      this.livePlayByPlayTimer = 1.9 + Math.random() * 0.8;
      this.playByPlayCooldown = 1.15;
      const inBox =
        this.ball.x < FIELD_LEFT + PENALTY_W + 60 || this.ball.x > FIELD_RIGHT - PENALTY_W - 60;
      this.broadcast(
        inBox
          ? pick([
              `Bola viva na grande área! Haja coração! ${nearest ? nearest.name : 'O ataque'} disputa a sobra!`,
              `Confusão na área, amigos! Olha o perigo, quem chega primeiro nessa bola?!`,
            ])
          : pick([
              `Bola disputada no meio-campo! ${nearest ? `${nearest.name} chega forte na briga!` : 'Jogo pegado!'}`,
              `Correria pela bola solta! ${this.homeClub.name} e ${this.awayClub.name} não dão trégua!`,
            ]),
        'normal',
        inBox ? 'excited' : 'calm',
        2.1,
        'galvao'
      );
      return;
    }

    // 4. Narração quando o goleiro segura a bola para repor em jogo
    if (owner.role === 'GK') {
      const club = owner.team === 'home' ? this.homeClub : this.awayClub;
      this.livePlayByPlayTimer = 1.9 + Math.random() * 0.8;
      this.playByPlayCooldown = 1.15;
      this.broadcast(
        pick([
          `Sai que é sua, ${owner.name}! Segura firme e já olha o contra-ataque do ${club.name}!`,
          `Tranquilidade do goleirão ${owner.name} preparando a reposição pro ${club.name}!`,
        ]),
        'normal',
        'calm',
        2.0,
        'galvao'
      );
      return;
    }

    const samePlayer = owner.id === this.lastLiveNarrationPlayerId;
    this.lastLiveNarrationPlayerId = owner.id;
    this.livePlayByPlayTimer = 1.95 + Math.random() * 0.85;
    this.playByPlayCooldown = 1.2;

    const club = owner.team === 'home' ? this.homeClub : this.awayClub;
    const oppClub = owner.team === 'home' ? this.awayClub : this.homeClub;
    const oppGk = this.players.find((pl) => pl.team !== owner.team && pl.role === 'GK');
    const oppGkName = oppGk ? oppGk.name : `o goleiro do ${oppClub.name}`;
    const attackDir = this.getAttackDir(owner.team);
    const oppGoalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;
    const distGoal = Math.hypot(oppGoalX - owner.x, FIELD_CENTER_Y - owner.y);
    const speed = Math.hypot(owner.vx, owner.vy);
    const onWing = Math.abs(owner.y - FIELD_CENTER_Y) > 220;
    const inOppHalf = (owner.x - FIELD_CENTER_X) * attackDir > 70;

    // Intercala comentários frequentes de Casagrande, Ronaldo e Craque Neto durante a construção das jogadas (~44%)
    if (distGoal >= 370 && Math.random() < 0.44) {
      const analyst = this.nextCommentator();
      const commentLine =
        analyst === 'casagrande'
          ? pick([
              `Olha, Galvão, o ${club.name} tá tocando bem a bola com ${owner.name}, procurando a brecha!`,
              `Bela movimentação do ${club.name}, Galvão! A defesa do ${oppClub.name} tem que ficar ligada em ${owner.name}!`,
              `É isso aí, Galvão! Tem que jogar pra frente com coragem, o ${owner.name} tá muito bem na partida!`,
              `Jogo aberto, Galvão! Quem tiver mais capricho no último passe vai balançar a rede!`,
            ])
          : analyst === 'ronaldo'
            ? pick([
                `Que qualidade com a bola no pé, Galvão! ${owner.name} joga de cabeça erguida pro ${club.name}!`,
                `Olha o espaço nas costas da zaga, Galvão! Se ${owner.name} enfiar essa bola, sai cara a cara!`,
                `Fenomenal o ritmo desse jogo, Galvão! O ${club.name} tá chegando com perigo no ataque!`,
                `Como camisa nove eu adoro ver isso, Galvão! ${owner.name} chamando o jogo pra cima da marcação!`,
              ])
            : pick([
                `Ô Galvão, olha o ${owner.name} jogando fácil pelo ${club.name}! Baita jogador, hein?!`,
                `Diga-se de passagem, Galvão, se o ${oppClub.name} bobear na marcação, o ${owner.name} vai guardar!`,
                `Que fase vive o ${owner.name}, Galvão! Tá chamando a responsabilidade pro ${club.name}!`,
                `Você tá de brincadeira, Galvão! Olha o espaço que o ${club.name} tá encontrando com ${owner.name}!`,
              ]);
      this.broadcast(commentLine, 'normal', analyst === 'neto' ? 'excited' : 'calm', 2.8, analyst);
      return;
    }

    if (distGoal < 390) {
      this.broadcast(
        pick([
          `Olha o gol, olha o gol, olha o gol! ${owner.name} invade a área do ${oppClub.name}!`,
          `Haja coração! ${owner.name} cara a cara com ${oppGkName}!`,
          `Lá vem ele! Pintou espaço pra bater, ${owner.name} dentro da área!`,
        ]),
        'normal',
        'excited',
        2.3,
        'galvao'
      );
    } else if (distGoal < 680 && inOppHalf) {
      this.broadcast(
        pick([
          `Vem descendo ${owner.name} na entrada da área do ${oppClub.name}!`,
          `Lá vem ${owner.name} buscando espaço pra mandar pro gol!`,
          `Pressão forte do ${club.name}! ${owner.name} parte pra cima!`,
        ]),
        'normal',
        'excited',
        2.2,
        'galvao'
      );
    } else if (onWing && speed > 155) {
      this.broadcast(
        pick([
          `Que beleza! ${owner.name} dispara em velocidade pela ponta! Pode pintar cruzamento!`,
          `Olha a arrancada de ${owner.name} pelo corredor lateral!`,
          `${owner.name} acelera na linha de fundo procurando o artilheiro na área!`,
        ]),
        'normal',
        'excited',
        2.2,
        'galvao'
      );
    } else if (samePlayer) {
      this.broadcast(
        pick([
          `${owner.name} segue conduzindo com categoria pelo ${club.name}!`,
          `Levanta a cabeça ${owner.name}, cadenciando o jogo do ${club.name}!`,
          `Jogo lá e cá, amigos! ${owner.name} protege a bola da marcação do ${oppClub.name}!`,
        ]),
        'normal',
        'calm',
        2.1,
        'galvao'
      );
    } else if (Math.abs(owner.x - FIELD_CENTER_X) < 520) {
      this.broadcast(
        pick([
          `${owner.name} domina no meio e arma o ${club.name}!`,
          `Bola nos pés de ${owner.name}, camisa ${owner.number}!`,
          `Trabalha a bola o ${club.name} com ${owner.name} ditando o ritmo!`,
        ]),
        'normal',
        'calm',
        2.1,
        'galvao'
      );
    } else {
      this.broadcast(
        pick([
          `${owner.name} sai jogando atrás pelo ${club.name}.`,
          `Posse segura com ${owner.name} organizando a saída de bola.`,
        ]),
        'normal',
        'calm',
        2.0,
        'galvao'
      );
    }
  }

  private updateOfficials(dt: number): void {
    const ref = this.referee;
    if (ref.whistleTimer > 0) ref.whistleTimer = Math.max(0, ref.whistleTimer - dt);
    if (ref.cardTimer > 0) ref.cardTimer = Math.max(0, ref.cardTimer - dt);
    if (ref.signalTimer > 0) ref.signalTimer = Math.max(0, ref.signalTimer - dt);

    // Árbitro corre acompanhando a diagonal do lance, mantendo distância limpa da bola
    const targetRefX = Math.max(
      FIELD_LEFT + 130,
      Math.min(FIELD_RIGHT - 130, this.ball.x * 0.82 + FIELD_CENTER_X * 0.18 - 55)
    );
    const preferTop = this.ball.y > FIELD_CENTER_Y ? -145 : 145;
    const targetRefY = Math.max(
      FIELD_TOP + 65,
      Math.min(FIELD_BOTTOM - 65, this.ball.y + preferTop)
    );
    const rdx = targetRefX - ref.x;
    const rdy = targetRefY - ref.y;
    const rDist = Math.hypot(rdx, rdy);
    if (rDist > 12) {
      const refSpd = Math.min(205, rDist * 3.2);
      ref.vx += ((rdx / rDist) * refSpd - ref.vx) * Math.min(1, dt * 8);
      ref.vy += ((rdy / rDist) * refSpd - ref.vy) * Math.min(1, dt * 8);
      ref.x += ref.vx * dt;
      ref.y += ref.vy * dt;
      ref.animTimer += dt * (Math.hypot(ref.vx, ref.vy) / 18);
      ref.animFrame = Math.floor(ref.animTimer) % 6;
    } else {
      ref.vx *= 0.8;
      ref.vy *= 0.8;
      ref.animFrame = 0;
    }
    const bdx = this.ball.x - ref.x;
    const bdy = this.ball.y - ref.y;
    const bd = Math.hypot(bdx, bdy) || 1;
    ref.facingX = bdx / bd;
    ref.facingY = bdy / bd;

    // 2 Bandeirinhas correndo nas linhas laterais (sistema diagonal oficial!)
    const topLm = this.linesmen[0];
    const botLm = this.linesmen[1];

    const updateLm = (lm: LinesmanState, minX: number, maxX: number) => {
      if (lm.flagRaisedTimer > 0) lm.flagRaisedTimer = Math.max(0, lm.flagRaisedTimer - dt);
      const tx = Math.max(minX, Math.min(maxX, this.ball.x));
      const dx = tx - lm.x;
      if (Math.abs(dx) > 6) {
        const sp = Math.min(215, Math.abs(dx) * 4.2);
        lm.vx = Math.sign(dx) * sp;
        lm.x += lm.vx * dt;
        lm.facingX = Math.sign(dx);
        lm.animTimer += dt * (Math.abs(lm.vx) / 18);
        lm.animFrame = Math.floor(lm.animTimer) % 6;
      } else {
        lm.vx = 0;
        lm.animFrame = 0;
        lm.facingX = this.ball.x >= lm.x ? 1 : -1;
      }
    };

    updateLm(topLm, FIELD_CENTER_X - 30, FIELD_RIGHT - 8);
    updateLm(botLm, FIELD_LEFT + 8, FIELD_CENTER_X + 30);
  }

  private raiseNearestLinesmanFlag(worldX: number, worldY: number, dirX: number, dur = 1.8): void {
    const lm = worldY < FIELD_CENTER_Y ? this.linesmen[0] : this.linesmen[1];
    lm.flagRaisedTimer = dur;
    lm.flagDirX = dirX || 1;
    // Se a bola estiver na metade do outro bandeirinha, também sinaliza!
    const sideLm = worldX >= FIELD_CENTER_X ? this.linesmen[0] : this.linesmen[1];
    sideLm.flagRaisedTimer = dur;
    sideLm.flagDirX = dirX || 1;
  }

  private finishMatch(): void {
    this.phase = 'FULLTIME';
    this.ball.ownerId = null;
    this.referee.whistleTimer = 2.0;
    this.showCallout(
      'FIM DE JOGO!',
      `${this.homeClub.shortName} ${this.homeScore} x ${this.awayScore} ${this.awayClub.shortName}`,
      'info',
      3
    );
    retroAudio.playWhistle('fulltime');
    const winLine =
      this.homeScore > this.awayScore
        ? `Vitória do ${this.homeClub.name} por ${this.homeScore} a ${this.awayScore}!`
        : this.awayScore > this.homeScore
          ? `Vitória do ${this.awayClub.name} por ${this.awayScore} a ${this.homeScore}!`
          : `Tudo igual no placar: ${this.homeScore} a ${this.awayScore}!`;
    this.broadcast(`Acabou! Acabou! Apita o árbitro! Fim de jogo, amigo! ${winLine}`, 'high', 'excited', 4.0);

    if (!this.hasEmittedFinish && this.matchFinishedCallback) {
      this.hasEmittedFinish = true;
      const winner: MatchResult['winner'] =
        this.homeScore > this.awayScore
          ? 'home'
          : this.awayScore > this.homeScore
            ? 'away'
            : 'draw';
      const result: MatchResult = {
        config: this.config,
        homeScore: this.homeScore,
        awayScore: this.awayScore,
        stats: { ...this.stats, goals: [...this.stats.goals] },
        winner,
      };
      // Breve pausa dramática antes de mostrar a tela pós-jogo
      this.finishTimeoutId = window.setTimeout(() => {
        this.finishTimeoutId = null;
        this.matchFinishedCallback?.(result);
      }, 1500);
    }
  }

  private applyShotAfterTouch(
    dt: number,
    p1Input: PlayerInputState,
    p2Input: PlayerInputState
  ): void {
    if (this.shotAfterTouchTimer <= 0) return;
    if (this.ball.ownerId || !this.ball.shotInFlight) {
      this.shotAfterTouchTimer = 0;
      this.shotControllerTeam = null;
      return;
    }

    this.shotAfterTouchTimer = Math.max(0, this.shotAfterTouchTimer - dt);
    const team = this.shotControllerTeam;
    if (!team) return;

    const input =
      team === 'home'
        ? p1Input
        : this.config.controlMode === '1P_2P'
          ? p2Input
          : null;
    if (!input) return;

    const inMag = Math.hypot(input.dx, input.dy);
    if (inMag < 0.16) return;

    const b = this.ball;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 180) return;

    const dirX = b.vx / speed;
    const dirY = b.vy / speed;
    const perpX = -dirY;
    const perpY = dirX;

    // Componente lateral do direcional faz a bola fazer uma curva sutil e precisa pro canto!
    const steer = input.dx * perpX + input.dy * perpY;
    const forward = input.dx * dirX + input.dy * dirY;

    // Efeito decresce suavemente conforme a bola viaja (controle natural e realista)
    const weight = Math.min(1, this.shotAfterTouchTimer / 0.55);
    b.vx += perpX * steer * 245 * weight * dt;
    b.vy += perpY * steer * 245 * weight * dt;
    b.spin = Math.max(-10, Math.min(10, b.spin + steer * 13 * weight * dt));

    // Direcional pra frente abaixa levemente a trajetória (folha seca); pra trás sustenta um pouco no ar
    if (b.z > 4) {
      b.vz -= forward * 95 * weight * dt;
    }
  }

  private syncHumanSelection(): void {
    // Se alguém do time humano pegou a bola, passa a controlá-lo automaticamente
    if (this.ball.ownerId) {
      const owner = this.players.find((p) => p.id === this.ball.ownerId);
      if (owner) {
        if (owner.team === 'home' && owner.role !== 'GK') {
          this.p1SelectedId = owner.id;
        }
        if (this.config.controlMode === '1P_2P' && owner.team === 'away' && owner.role !== 'GK') {
          this.p2SelectedId = owner.id;
        }
      }
      return;
    }

    // Se a bola está em passe/cruzamento ou solta em campo, garante que o companheiro mais próximo do ponto de domínio seja selecionado e corra automático!
    const autoFocusTeam = (team: 'home' | 'away') => {
      const currentId = team === 'home' ? this.p1SelectedId : this.p2SelectedId;
      const current = this.players.find((p) => p.id === currentId);
      if (!current) return;

      const isFriendlyPassInFlight = !this.ball.ownerId && this.ball.lastTouchTeam === team;
      const targetSpotX =
        isFriendlyPassInFlight && (this.ball.isCrossBall || this.ball.passTargetId)
          ? this.ball.passTargetX * 0.65 + (this.ball.x + this.ball.vx * 0.18) * 0.35
          : this.ball.x + this.ball.vx * 0.14;
      const targetSpotY =
        isFriendlyPassInFlight && (this.ball.isCrossBall || this.ball.passTargetId)
          ? this.ball.passTargetY * 0.65 + (this.ball.y + this.ball.vy * 0.18) * 0.35
          : this.ball.y + this.ball.vy * 0.14;

      if (isFriendlyPassInFlight) {
        // Se não havia alvo travado (ou outro companheiro está muito mais perto da trajetória do passe/cruzamento), trava nele!
        let passReceiver = this.ball.passTargetId
          ? this.players.find((p) => p.id === this.ball.passTargetId && p.team === team && p.role !== 'GK') ?? null
          : null;

        let bestDist = passReceiver
          ? Math.hypot(passReceiver.x - targetSpotX, passReceiver.y - targetSpotY)
          : Infinity;

        for (const pl of this.players) {
          if (pl.team !== team || pl.role === 'GK') continue;
          if (this.lastTouchedCooldown > 0 && this.ball.lastTouchPlayerId === pl.id) continue;
          const d = Math.hypot(pl.x - targetSpotX, pl.y - targetSpotY);
          if (d + (passReceiver ? 65 : 0) < bestDist) {
            bestDist = d;
            passReceiver = pl;
          }
        }

        if (passReceiver) {
          this.ball.passTargetId = passReceiver.id;
          if (passReceiver.id !== currentId) {
            current.isCharging = false;
            current.chargePower = 0;
            if (team === 'home') this.p1SelectedId = passReceiver.id;
            else this.p2SelectedId = passReceiver.id;
          }
          return;
        }
      }

      if (this.lastTouchedCooldown > 0 && this.ball.lastTouchPlayerId === current.id) return;

      const curDist = Math.hypot(current.x - this.ball.x, current.y - this.ball.y);
      if (curDist < 95) return;

      let best: FieldPlayer | null = null;
      let bestDist = curDist - 65;
      for (const pl of this.players) {
        if (pl.team !== team || pl.role === 'GK' || pl.id === currentId) continue;
        const d = Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y);
        if (d < bestDist && d < 165) {
          bestDist = d;
          best = pl;
        }
      }
      if (best) {
        current.isCharging = false;
        current.chargePower = 0;
        if (team === 'home') this.p1SelectedId = best.id;
        else this.p2SelectedId = best.id;
      }
    };

    autoFocusTeam('home');
    if (this.config.controlMode === '1P_2P') {
      autoFocusTeam('away');
    }
  }

  private switchSelectedPlayer(team: 'home' | 'away'): void {
    const currentId = team === 'home' ? this.p1SelectedId : this.p2SelectedId;
    const current = this.players.find((p) => p.id === currentId);
    if (current) {
      current.isCharging = false;
      current.chargePower = 0;
    }

    const attackDir = this.getAttackDir(team);
    const ownGoalX = attackDir === 1 ? FIELD_LEFT : FIELD_RIGHT;
    const defending = this.ball.ownerId !== null && !this.ball.ownerId.startsWith(team);

    const candidates = this.players
      .filter((p) => p.team === team && p.role !== 'GK' && p.id !== currentId)
      .sort((a, b) => {
        const scorePlayer = (pl: FieldPlayer) => {
          const distBall = Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y);
          if (!defending) return distBall;
          // Na defesa, dá leve preferência para quem já está entre a bola e o próprio gol
          const goalSide = Math.sign(ownGoalX - this.ball.x) === Math.sign(pl.x - this.ball.x);
          return distBall - (goalSide ? 45 : 0);
        };
        return scorePlayer(a) - scorePlayer(b);
      });

    if (candidates.length > 0) {
      if (team === 'home') this.p1SelectedId = candidates[0].id;
      else this.p2SelectedId = candidates[0].id;
    }
  }

  private giveBallTo(player: FieldPlayer): void {
    const prevTeam = this.ball.lastTouchTeam;
    const prevOwnerId = this.ball.ownerId;
    const prevPlayerName = this.ball.lastTouchPlayerName;
    const wasPassInFlight = !prevOwnerId && prevTeam !== null && prevTeam !== player.team;

    this.ball.ownerId = player.id;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    this.ball.lastTouchPlayerName = player.name;
    this.ball.lastTouchPlayerNumber = player.number;
    this.ball.z = 0;
    this.ball.vz = 0;
    this.ball.shotInFlight = false;
    this.ball.shotTeam = null;
    this.ball.passTargetId = null;
    this.ball.isCrossBall = false;
    this.ball.isBicycleShot = false;
    for (const pl of this.players) {
      pl.queuedBicycle = false;
    }

    if (prevTeam !== player.team) {
      this.lastPasserName = null;
      this.lastPasserTeam = null;
    }

    // Interceptação limpa no meio do passe adversário
    if (
      wasPassInFlight &&
      player.role !== 'GK' &&
      this.phase === 'PLAYING' &&
      this.playByPlayCooldown <= 0 &&
      Math.random() < 0.42
    ) {
      this.playByPlayCooldown = 3.2;
      const clubName = player.team === 'home' ? this.homeClub.name : this.awayClub.name;
      const interceptedLine = prevPlayerName
        ? `Interceptou bonito ${player.name}, camisa ${player.number}! Cortou o passe de ${prevPlayerName} pro ${clubName}!`
        : `Leitura perfeita de ${player.name}! Intercepta a bola e puxa o ataque do ${clubName}!`;
      this.broadcast(interceptedLine, 'normal', 'excited', 2.6);
    }

    if (player.role === 'GK') {
      player.holdBallTimer = 1.1;
      player.gkRushActive = false;
    }
  }

  private updateHumanPlayer(p: FieldPlayer, input: PlayerInputState, dt: number): void {
    this.tickPlayerTimers(p, dt);

    if (p.stunTimer > 0) {
      p.vx *= 0.86;
      p.vy *= 0.86;
      this.integratePlayerPosition(p, dt);
      return;
    }

    if (p.tackleTimer > 0) {
      this.updateSlideTackle(p, dt);
      return;
    }

    const hasBall = this.ball.ownerId === p.id;
    const baseSpeed = 188 + (p.speed - 70) * 2.35; // Escalonado para o campo ampliado!
    const wantsSprint = input.sprint && p.stamina > 8 && (Math.abs(input.dx) > 0.1 || Math.abs(input.dy) > 0.1);
    const speedMult = (wantsSprint ? 1.32 : 1.0) * (hasBall ? 0.93 : 1.0);

    if (wantsSprint) {
      p.stamina = Math.max(0, p.stamina - dt * 26);
    } else {
      p.stamina = Math.min(100, p.stamina + dt * 15);
    }

    // Verifica se algum goleiro está com a bola nas mãos (ninguém pode vir pra cima do goleiro!)
    const ballOwner = this.ball.ownerId
      ? this.players.find((pl) => pl.id === this.ball.ownerId)
      : null;
    const oppGkHasBall = Boolean(ballOwner && ballOwner.role === 'GK' && ballOwner.team !== p.team);

    // Movimento (com assistência de marcação cerrada ao segurar TOMAR BOLA na defesa — desativada contra goleiro!)
    let moveDx = input.dx;
    let moveDy = input.dy;
    if (!hasBall && input.steal && !oppGkHasBall) {
      const bdx = this.ball.x - p.x;
      const bdy = this.ball.y - p.y;
      const bDist = Math.hypot(bdx, bdy);
      if (bDist > 8 && bDist < 260) {
        const pull = Math.hypot(moveDx, moveDy) < 0.15 ? 1.0 : 0.55;
        moveDx = moveDx * (1 - pull) + (bdx / bDist) * pull;
        moveDy = moveDy * (1 - pull) + (bdy / bDist) * pull;
        const mLen = Math.hypot(moveDx, moveDy) || 1;
        moveDx /= mLen;
        moveDy /= mLen;
      }
    }

    // CORRIDA AUTOMÁTICA DO COMPANHEIRO AO RECEBER PASSE OU CRUZAMENTO PARA DOMINAR A BOLA!
    let autoReceiveBoost = 1.0;
    const isReceivingFriendlyBall =
      !hasBall &&
      !this.ball.ownerId &&
      !oppGkHasBall &&
      this.ball.lastTouchTeam === p.team &&
      !(this.lastTouchedCooldown > 0 && this.ball.lastTouchPlayerId === p.id) &&
      (this.ball.passTargetId === p.id ||
        Math.hypot(this.ball.x - p.x, this.ball.y - p.y) < 340);

    if (isReceivingFriendlyBall) {
      const rawDistBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      const leadTime = Math.min(0.28, rawDistBall / 620);
      const interceptX =
        this.ball.isCrossBall || this.ball.z > 14
          ? this.ball.passTargetX * 0.68 + (this.ball.x + this.ball.vx * 0.16) * 0.32
          : this.ball.x + this.ball.vx * leadTime;
      const interceptY =
        this.ball.isCrossBall || this.ball.z > 14
          ? this.ball.passTargetY * 0.68 + (this.ball.y + this.ball.vy * 0.16) * 0.32
          : this.ball.y + this.ball.vy * leadTime;

      const tdx = interceptX - p.x;
      const tdy = interceptY - p.y;
      const tDist = Math.hypot(tdx, tdy);
      if (tDist > 5 && tDist < 780) {
        const autoDirX = tdx / tDist;
        const autoDirY = tdy / tDist;
        const inMag = Math.hypot(input.dx, input.dy);
        // Mesmo que o jogador ainda esteja segurando a seta do passe/cruzamento anterior, o receptor corre automático na bola!
        const stickDot = inMag > 0.15 ? (input.dx / inMag) * autoDirX + (input.dy / inMag) * autoDirY : 1;
        const autoPull = inMag < 0.2 ? 1.0 : stickDot < 0.15 ? 0.92 : 0.86;
        moveDx = autoDirX * autoPull + input.dx * (1 - autoPull);
        moveDy = autoDirY * autoPull + input.dy * (1 - autoPull);
        const mLen = Math.hypot(moveDx, moveDy) || 1;
        moveDx /= mLen;
        moveDy /= mLen;
        autoReceiveBoost = p.queuedBicycle ? 1.32 : this.ball.isCrossBall ? 1.26 : 1.22;
      }
    }

    const pressBoost = !hasBall && input.steal && !oppGkHasBall ? 1.1 : 1.0;
    const skillBoost = p.skillMoveTimer > 0 ? 1.24 : 1.0;
    const targetVx = moveDx * baseSpeed * Math.max(speedMult, autoReceiveBoost) * pressBoost * skillBoost;
    const targetVy = moveDy * baseSpeed * Math.max(speedMult, autoReceiveBoost) * pressBoost * skillBoost;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * 15);
    p.vy += (targetVy - p.vy) * Math.min(1, dt * 15);

    if (Math.hypot(moveDx, moveDy) > 0.15) {
      const len = Math.hypot(moveDx, moveDy);
      p.facingX = moveDx / len;
      p.facingY = moveDy / len;
    }

    this.integratePlayerPosition(p, dt);

    // Mantém respeito de área quando o goleiro adversário já encaixou a bola!
    if (oppGkHasBall && ballOwner) {
      const gdx = p.x - ballOwner.x;
      const gdy = p.y - ballOwner.y;
      const gDist = Math.hypot(gdx, gdy) || 1;
      const minClearance = 78;
      if (gDist < minClearance) {
        p.x = ballOwner.x + (gdx / gDist) * minClearance;
        p.y = ballOwner.y + (gdy / gDist) * minClearance;
      }
    }

    // AÇÕES COM BOLA (COM BARRA DE FORÇA PARA TOQUE, CRUZAMENTO E CHUTE!)
    if (hasBall) {
      // PEDALADA / ELÁSTICO / FIRULA COM A BOLA usando o botão de TOMAR BOLA (V / J)!
      if (input.stealJustPressed && p.stealCooldown <= 0) {
        p.isCharging = false;
        p.chargePower = 0;
        this.performSkillMove(p, input.dx, input.dy);
        return;
      }

      // 1. BARRA DE TOQUE / PASSE (segurar Z / F e soltar — toque curto ou passe enfiado forte!)
      if (p.isCharging && p.chargeType === 'pass') {
        if (input.pass) {
          p.chargePower = Math.min(1, p.chargePower + dt * 1.95);
          if (p.chargePower >= 1) {
            p.isCharging = false;
            p.chargePower = 0;
            this.performPass(p, input.dx, input.dy, false, 1.0);
            return;
          }
        } else {
          const power = Math.max(0.18, p.chargePower);
          p.isCharging = false;
          p.chargePower = 0;
          this.performPass(p, input.dx, input.dy, false, power);
          return;
        }
      } else if (p.isCharging && p.chargeType === 'cross') {
        // 2. BARRA DE CRUZAMENTO / LANÇAMENTO (segurar C / H e soltar — 1º pau, miolo ou 2º pau!)
        if (input.lob) {
          p.chargePower = Math.min(1, p.chargePower + dt * 1.7);
          if (p.chargePower >= 1) {
            p.isCharging = false;
            p.chargePower = 0;
            this.performPass(p, input.dx, input.dy, true, 1.0);
            return;
          }
        } else {
          const power = Math.max(0.22, p.chargePower);
          p.isCharging = false;
          p.chargePower = 0;
          this.performPass(p, input.dx, input.dy, true, power);
          return;
        }
      } else if (p.isCharging && p.chargeType === 'shot') {
        // 3. BARRA DE CHUTE (segurar X / G e soltar)
        if (input.shoot) {
          p.chargePower = Math.min(1, p.chargePower + dt * 1.48);
          if (p.chargePower >= 1) {
            p.isCharging = false;
            p.chargePower = 0;
            this.performShot(p, 1.0, input.dx, input.dy);
            return;
          }
        } else {
          const power = Math.max(0.26, p.chargePower);
          p.isCharging = false;
          p.chargePower = 0;
          this.performShot(p, power, input.dx, input.dy);
          return;
        }
      } else {
        // Só inicia nova barra de força em um clique NOVO (evita passe/chute acidental ao roubar ou receber a bola segurando tecla!)
        if (input.shootJustPressed) {
          p.isCharging = true;
          p.chargeType = 'shot';
          p.chargePower = 0.14;
        } else if (input.lobJustPressed) {
          p.isCharging = true;
          p.chargeType = 'cross';
          p.chargePower = 0.16;
        } else if (input.passJustPressed) {
          p.isCharging = true;
          p.chargeType = 'pass';
          p.chargePower = 0.16;
        }
      }
    } else {
      // AÇÕES SEM BOLA (Defesa, BICICLETA ACROBÁTICA ou CABECEIO em cruzamento aéreo!)
      p.isCharging = false;
      p.chargePower = 0;

      const distToBall = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      const attackDir = this.getAttackDir(p.team);
      const oppGoalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;
      const distGoal = Math.hypot(oppGoalX - p.x, FIELD_CENTER_Y - p.y);
      const isAttackingCrossOrAerial =
        !this.ball.ownerId &&
        (this.ball.isCrossBall || this.ball.z >= 7) &&
        distGoal < 780;

      // Se a bicicleta já foi engatilhada durante o voo do cruzamento, dispara assim que a bola chega no alcance!
      if (p.queuedBicycle && !this.ball.ownerId) {
        if (this.ball.z <= 2 && !this.ball.isCrossBall) {
          p.queuedBicycle = false;
        } else if (distToBall < 134 && this.ball.z >= 5 && this.ball.z <= 96) {
          this.performBicycleKick(p, input.dx, input.dy);
          return;
        }
      }

      // GOL DE BICICLETA NO CRUZAMENTO (apertar X / Chute ou C / Cruzar quando a bola vem pelo alto!)
      const wantsBicycleOrFinish = input.shootJustPressed || input.lobJustPressed;
      if (isAttackingCrossOrAerial && wantsBicycleOrFinish) {
        if (distToBall < 144 && this.ball.z >= 5 && this.ball.z <= 98) {
          this.performBicycleKick(p, input.dx, input.dy);
          return;
        }
        // Se o jogador apertou X ou C enquanto o cruzamento ainda está viajando no ar, engatilha a bicicleta automática!
        if ((this.ball.isCrossBall || this.ball.z >= 12) && distToBall < 620) {
          p.queuedBicycle = true;
          this.showCallout('BICICLETA ARMADA!!', `${p.name} prepara a acrobacia na área!`, 'info', 1.1);
          return;
        }
      }

      // CABECEIO / TESTADA AÉREA quando aperta Z (Passe) na bola alta ou fora da zona de bicicleta
      const wantsHeader =
        input.passJustPressed || (wantsBicycleOrFinish && !isAttackingCrossOrAerial);
      if (!this.ball.ownerId && wantsHeader && this.ball.z >= 6 && this.ball.z <= 88) {
        if (distToBall < 86) {
          this.performAerialHeader(p, input.dx, input.dy, input.shootJustPressed || this.ball.isCrossBall);
          return;
        }
        if (this.ball.isCrossBall && distToBall < 118) {
          const bdx = this.ball.x - p.x;
          const bdy = this.ball.y - p.y;
          const bl = Math.hypot(bdx, bdy) || 1;
          p.x += (bdx / bl) * Math.min(36, distToBall * 0.56);
          p.y += (bdy / bl) * Math.min(36, distToBall * 0.56);
          this.performAerialHeader(p, input.dx, input.dy, true);
          return;
        }
      }

      // Trocar jogador (Z / F — apenas quando a bola não é um passe aéreo chegando diretamente para este receptor)
      if (input.passJustPressed && !(isReceivingFriendlyBall && distToBall < 150)) {
        this.switchSelectedPlayer(p.team);
        return;
      }

      // BOTÃO DEDICADO: TOMAR BOLA (bloqueado contra goleiro com a bola!)
      if (input.stealJustPressed && p.stealCooldown <= 0 && !oppGkHasBall) {
        this.performStandingSteal(p);
        return;
      }

      // Carrinho (X / G — bloqueado contra goleiro com a bola ou quando um cruzamento amigo está no ar!)
      if (
        input.shootJustPressed &&
        p.tackleCooldown <= 0 &&
        !oppGkHasBall &&
        !(this.ball.isCrossBall && this.ball.lastTouchTeam === p.team)
      ) {
        this.startSlideTackle(p);
        return;
      }

      // Tentativa de domínio / interceptação automática ao alcançar o passe ou cruzamento
      this.tryClaimLooseBall(p);
    }
  }

  // PEDALADA / ELÁSTICO / GIRO COM A BOLA (usando o botão TOMAR BOLA quando tem a posse!)
  private performSkillMove(p: FieldPlayer, aimX: number, aimY: number): void {
    const moves: Array<FieldPlayer['skillMoveType']> = ['pedalada', 'elastico', 'giro'];
    const nextIdx = (moves.indexOf(p.skillMoveType) + 1) % moves.length;
    const moveType = moves[nextIdx];

    p.skillMoveType = moveType;
    p.skillMoveTimer = 0.56;
    p.stealCooldown = 0.72;
    p.stamina = Math.max(0, p.stamina - 7);

    const hasAim = Math.abs(aimX) > 0.15 || Math.abs(aimY) > 0.15;
    const baseDirX = hasAim ? aimX : p.facingX;
    const baseDirY = hasAim ? aimY : p.facingY;
    const len = Math.hypot(baseDirX, baseDirY) || 1;
    const nx = baseDirX / len;
    const ny = baseDirY / len;

    // Corte rápido diagonal no elástico ou arranque explosivo na pedalada
    const lateralSign = Math.random() < 0.5 ? 1 : -1;
    const burstX = moveType === 'elastico' ? nx * 0.85 - ny * 0.52 * lateralSign : nx;
    const burstY = moveType === 'elastico' ? ny * 0.85 + nx * 0.52 * lateralSign : ny;
    const bLen = Math.hypot(burstX, burstY) || 1;
    p.facingX = burstX / bLen;
    p.facingY = burstY / bLen;
    p.vx = p.facingX * 295;
    p.vy = p.facingY * 295;

    // Desconcerta marcadores próximos E TAMBÉM PERMITE DRIBLAR O GOLEIRO NO 1x1!
    let fooledSomeone = false;
    let dribbledGk: FieldPlayer | null = null;
    for (const opp of this.players) {
      if (opp.team === p.team) continue;
      const d = Math.hypot(opp.x - p.x, opp.y - p.y);
      if (opp.role === 'GK') {
        if (d < 96) {
          // Drible de corpo desconcerta o goleiro! Ele cai para o lado oposto e abre o gol!
          opp.stunTimer = Math.max(opp.stunTimer, 0.62);
          opp.gkNoCatchTimer = Math.max(opp.gkNoCatchTimer, 0.68);
          opp.gkRushActive = false;
          opp.diveTimer = 0.36;
          opp.diveDirX = -p.facingX * 0.45;
          opp.diveDirY = -p.facingY >= 0 ? 1 : -1;
          this.gkDiveTargets.delete(opp.id);
          const wrongSideX = -p.facingY * lateralSign;
          const wrongSideY = p.facingX * lateralSign;
          opp.vx = wrongSideX * 150;
          opp.vy = wrongSideY * 150;
          dribbledGk = opp;
          fooledSomeone = true;
        }
        continue;
      }
      if (d < 82) {
        opp.stunTimer = Math.max(opp.stunTimer, 0.56);
        const pushX = (opp.x - p.x) / (d || 1);
        const pushY = (opp.y - p.y) / (d || 1);
        opp.vx = pushX * 92;
        opp.vy = pushY * 92;
        fooledSomeone = true;
      }
    }

    this.crowdExcitement = Math.max(this.crowdExcitement, dribbledGk ? 0.94 : fooledSomeone ? 0.82 : 0.58);
    retroAudio.playSkillMove();

    if (dribbledGk) {
      this.showCallout('DRIBLOU O GOLEIRO!!', `${p.name} deixou ${dribbledGk.name} no chão!`, 'info', 1.3);
      this.playByPlayCooldown = 2.6;
      const gkSkillAnalyst = Math.random() < 0.52 ? 'ronaldo' : 'neto';
      const lead = pick([
        `OLHA O QUE ELE FEZ!! ${p.name} deixou o goleiro ${dribbledGk.name} no chão! Que beleza!`,
        `A FÍSICA NÃO PERMITE!! ${p.name} driblou ${dribbledGk.name} e ficou com o gol aberto!`,
      ]);
      const reply =
        gkSkillAnalyst === 'ronaldo'
          ? `Fenomenal, Galvão! Esse drible no goleiro me lembrou os velhos tempos, que frieza de ${p.name}!`
          : `Você tá de brincadeira, Galvão?! ${p.name} mandou o goleiro comprar pão!! Que drible absurdo!`;
      this.broadcastDialogue(lead, reply, gkSkillAnalyst, 'high', 'excited', 4.8);
    } else if (this.playByPlayCooldown <= 0 || fooledSomeone) {
      this.playByPlayCooldown = 2.0;
      const skillLines =
        moveType === 'pedalada'
          ? [`Pedalada de ${p.name}! Que beleza, deixou o marcador na saudade!`, `Olha a pedalada de ${p.name}! Haja coração!`]
          : moveType === 'elastico'
            ? [`Elástico mágico de ${p.name}! Olé!`, `Que categoria de ${p.name} no elástico!`]
            : [`Giro de corpo de ${p.name}! Limpou a marcação!`, `Que drible sensacional de ${p.name}!`];
      this.broadcast(pick(skillLines), fooledSomeone ? 'high' : 'normal', 'excited', 2.3, 'galvao');
      if (fooledSomeone && Math.random() < 0.6) {
        const skillAnalyst = Math.random() < 0.5 ? 'ronaldo' : 'neto';
        this.queueCommentator(
          skillAnalyst === 'ronaldo'
            ? `Isso é futebol arte, Galvão! ${p.name} quebrou a linha defensiva num drible só!`
            : `Ô Galvão, que entortada de ${p.name}! Baita jogada de craque, diga-se de passagem!`,
          skillAnalyst,
          2.1,
          'excited',
          2.6
        );
      }
    }
  }

  // --- FINALIZAÇÃO ACROBÁTICA DE BICICLETA NO CRUZAMENTO ---
  private performBicycleKick(p: FieldPlayer, aimX: number, aimY: number): void {
    const attackDir = this.getAttackDir(p.team);
    const oppGoalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;

    // Impulso atlético no ar para alcançar a bola em cheio na bicicleta
    const bdx = this.ball.x - p.x;
    const bdy = this.ball.y - p.y;
    const distToBall = Math.hypot(bdx, bdy);
    if (distToBall > 8) {
      const snapStep = Math.min(54, distToBall * 0.72);
      p.x += (bdx / distToBall) * snapStep;
      p.y += (bdy / distToBall) * snapStep;
    }

    p.bicycleAnimTimer = 0.66;
    p.headerAnimTimer = 0;
    p.kickAnimTimer = 0;
    p.queuedBicycle = false;
    p.kickType = 'bicycle';
    p.stamina = Math.max(0, p.stamina - 8);

    this.ball.isCrossBall = false;
    this.ball.passTargetId = null;

    // Mira cirúrgica no canto aberto longe do goleiro para facilitar golaços de bicicleta!
    const oppGk = this.players.find((pl) => pl.team !== p.team && pl.role === 'GK');
    const autoCornerSign = oppGk && oppGk.y > FIELD_CENTER_Y ? -0.82 : 0.82;
    const targetY =
      Math.abs(aimY) > 0.15
        ? FIELD_CENTER_Y + Math.max(-0.92, Math.min(0.92, aimY)) * (GOAL_HALF_H - 14)
        : FIELD_CENTER_Y + autoCornerSign * (GOAL_HALF_H - 16);

    const dx = oppGoalX - p.x;
    const dy = targetY - p.y;
    const bikeSpread = 0.012;
    const bikeAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * bikeSpread;
    const speed = 855 + (p.attack - 75) * 3.8;

    p.facingX = Math.cos(bikeAngle);
    p.facingY = Math.sin(bikeAngle);

    // Trajetória calibrada para entrar rasgando abaixo do travessão!
    const startZ = Math.max(28, Math.min(56, this.ball.z));
    this.ball.z = startZ;
    const bikeVz = startZ > 42 ? -18 : 34;
    const curlSpin = -Math.sign(targetY - FIELD_CENTER_Y) * attackDir * 2.8;

    this.releaseBall(
      p,
      Math.cos(bikeAngle) * speed,
      Math.sin(bikeAngle) * speed,
      bikeVz,
      'bicycle',
      14,
      curlSpin
    );
    this.ball.isBicycleShot = true;
    this.shotAfterTouchTimer = 0.65;
    this.shotControllerTeam = p.team;

    if (p.team === 'home') {
      this.stats.homeShots++;
      this.stats.homeShotsOnTarget++;
    } else {
      this.stats.awayShots++;
      this.stats.awayShotsOnTarget++;
    }

    this.screenShake = 0.48;
    this.crowdExcitement = Math.max(this.crowdExcitement, 0.96);
    retroAudio.playBicycleKick();
    this.showCallout(
      'BICICLETA!!',
      `${p.name} (#${p.number}) vira uma bicicleta espetacular!`,
      'info',
      1.6
    );

    const club = p.team === 'home' ? this.homeClub : this.awayClub;
    this.playByPlayCooldown = 2.6;
    this.broadcast(
      pick([
        `OLHA A BICICLETA DE ${p.name.toUpperCase()}!! Virou no ar pro ${club.name}! Haja coração!!`,
        `BICICLETA ESPETACULAR DE ${p.name.toUpperCase()}!! Que acrobacia sensacional na área!!`,
        `NO SEGUNDO ANDAR!! ${p.name} emenda uma BICICLETA cinematográfica pro gol!!`,
      ]),
      'high',
      'excited',
      2.6,
      'galvao'
    );
  }

  private performAerialHeader(
    p: FieldPlayer,
    aimX: number,
    aimY: number,
    isGoalAttempt: boolean
  ): void {
    const attackDir = this.getAttackDir(p.team);
    const oppGoalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;
    const distGoal = Math.hypot(oppGoalX - p.x, FIELD_CENTER_Y - p.y);
    const shouldShoot = isGoalAttempt || distGoal < 500;

    p.headerAnimTimer = 0.44;
    p.queuedBicycle = false;
    p.kickType = 'header';
    this.ball.isCrossBall = false;
    this.ball.passTargetId = null;

    if (shouldShoot) {
      // Cabeçada certeira buscando o canto oposto do goleiro (fácil de finalizar cruzamentos!)
      const oppGk = this.players.find((pl) => pl.team !== p.team && pl.role === 'GK');
      const autoCornerSign = oppGk && oppGk.y > FIELD_CENTER_Y ? -0.78 : 0.78;
      const targetY =
        Math.abs(aimY) > 0.15
          ? FIELD_CENTER_Y + aimY * (GOAL_HALF_H - 12)
          : FIELD_CENTER_Y + autoCornerSign * (GOAL_HALF_H - 18);
      const dx = oppGoalX - p.x;
      const dy = targetY - p.y;
      const len = Math.hypot(dx, dy) || 1;
      void len;
      const headerSpread = 0.032;
      const headerAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * headerSpread;
      const speed = 700 + (p.attack - 75) * 3.5;
      p.facingX = Math.cos(headerAngle);
      p.facingY = Math.sin(headerAngle);
      const headerVz = this.ball.z > 30 ? -24 : 36;
      this.releaseBall(
        p,
        Math.cos(headerAngle) * speed,
        Math.sin(headerAngle) * speed,
        headerVz,
        'header',
        16,
        (Math.random() - 0.5) * 1.6
      );
      this.shotAfterTouchTimer = 0.55;
      this.shotControllerTeam = p.team;
      if (p.team === 'home') {
        this.stats.homeShots++;
        this.stats.homeShotsOnTarget++;
      } else {
        this.stats.awayShots++;
        this.stats.awayShotsOnTarget++;
      }
      this.crowdExcitement = Math.max(this.crowdExcitement, 0.86);
      retroAudio.playHeader();
      this.broadcast(
        pick([
          `Cabeçada firme de ${p.name} pro gol!`,
          `Subiu bonito ${p.name} na testada!`,
          `Testada perigosa de ${p.name}!`,
        ]),
        'high',
        'excited',
        2.3
      );
    } else {
      const nx = Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1 ? aimX : attackDir;
      const ny = Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1 ? aimY : 0;
      const len = Math.hypot(nx, ny) || 1;
      p.facingX = nx / len;
      p.facingY = ny / len;
      this.releaseBall(p, (nx / len) * 390, (ny / len) * 390, 88, 'header', 14, 0);
      retroAudio.playHeader();
    }
  }

  private performStandingSteal(p: FieldPlayer): void {
    // Nunca dá bote no goleiro com a bola nas mãos
    const currentOwner = this.players.find((pl) => pl.id === this.ball.ownerId);
    if (currentOwner && currentOwner.role === 'GK') return;

    p.stealAnimTimer = 0.3;
    p.stealCooldown = 0.45;
    p.stamina = Math.max(0, p.stamina - 7);

    const dx = this.ball.x - p.x;
    const dy = this.ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      p.facingX = dx / dist;
      p.facingY = dy / dist;
    }
    p.vx = p.facingX * 265;
    p.vy = p.facingY * 265;

    if (dist < 46 && this.ball.z < 26) {
      if (!currentOwner || currentOwner.team !== p.team) {
        if (currentOwner && currentOwner.role !== 'GK') {
          currentOwner.stunTimer = 0.48;
          this.giveBallTo(p);
          retroAudio.playPass();
          if (this.playByPlayCooldown <= 0) {
            this.playByPlayCooldown = 2.0;
            this.broadcast(
              pick([
                `Desarme limpo de ${p.name} em ${currentOwner.name}!`,
                `Tomou na bola ${p.name}, tirando de ${currentOwner.name}!`,
              ]),
              'normal',
              'excited',
              2.2
            );
          }
          return;
        }
        if (!currentOwner) {
          this.giveBallTo(p);
          retroAudio.playPass();
          return;
        }
      }
    }
    retroAudio.playTackle();
  }

  private tickPlayerTimers(p: FieldPlayer, dt: number): void {
    if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
    if (p.stealCooldown > 0) p.stealCooldown = Math.max(0, p.stealCooldown - dt);
    if (p.stealAnimTimer > 0) p.stealAnimTimer = Math.max(0, p.stealAnimTimer - dt);
    if (p.passAnimTimer > 0) p.passAnimTimer = Math.max(0, p.passAnimTimer - dt);
    if (p.headerAnimTimer > 0) p.headerAnimTimer = Math.max(0, p.headerAnimTimer - dt);
    if (p.bicycleAnimTimer > 0) p.bicycleAnimTimer = Math.max(0, p.bicycleAnimTimer - dt);
    if (p.skillMoveTimer > 0) p.skillMoveTimer = Math.max(0, p.skillMoveTimer - dt);
    if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
    if (p.kickAnimTimer > 0) p.kickAnimTimer = Math.max(0, p.kickAnimTimer - dt);
    if (p.diveTimer > 0) p.diveTimer = Math.max(0, p.diveTimer - dt);
    if (p.gkNoCatchTimer > 0) p.gkNoCatchTimer = Math.max(0, p.gkNoCatchTimer - dt);
  }

  private integratePlayerPosition(p: FieldPlayer, dt: number): void {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Limites do campo com margem para laterais
    p.x = Math.max(FIELD_LEFT - 18, Math.min(FIELD_RIGHT + 18, p.x));
    p.y = Math.max(FIELD_TOP - 18, Math.min(FIELD_BOTTOM + 18, p.y));

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 18) {
      p.animTimer += dt * (speed / 19);
      p.animFrame = Math.floor(p.animTimer) % 6;
    } else {
      p.animFrame = 0;
    }
  }

  private startSlideTackle(p: FieldPlayer): void {
    p.tackleTimer = 0.34;
    p.tackleCooldown = 0.95;
    const lungeSpeed = 330 + (p.speed - 70) * 1.8;
    p.vx = p.facingX * lungeSpeed;
    p.vy = p.facingY * lungeSpeed;
    p.stamina = Math.max(0, p.stamina - 12);
    retroAudio.playTackle();
  }

  private updateSlideTackle(p: FieldPlayer, dt: number): void {
    p.tackleTimer = Math.max(0, p.tackleTimer - dt);
    p.vx *= Math.pow(0.28, dt);
    p.vy *= Math.pow(0.28, dt);
    this.integratePlayerPosition(p, dt);

    // Checa contato com a bola (desarme limpo! Nunca atinge goleiro com a bola nas mãos!)
    const distBall = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
    if (distBall < 24 && this.ball.z < 20) {
      const prevOwner = this.players.find((pl) => pl.id === this.ball.ownerId);
      if (prevOwner && prevOwner.role === 'GK') return;
      if (!prevOwner || prevOwner.team !== p.team) {
        if (prevOwner) {
          prevOwner.stunTimer = 0.45;
        }
        this.ball.ownerId = null;
        this.ball.passTargetId = null;
        this.ball.isCrossBall = false;
        this.ball.vx = p.facingX * 260;
        this.ball.vy = p.facingY * 260;
        this.ball.vz = 45;
        this.ball.lastTouchTeam = p.team;
        this.ball.lastTouchPlayerId = p.id;
        this.ball.lastTouchPlayerName = p.name;
        this.ball.lastTouchPlayerNumber = p.number;
        this.lastTouchedCooldown = 0.25;
        retroAudio.playPass();
        if (prevOwner && this.playByPlayCooldown <= 0) {
          this.playByPlayCooldown = 2.0;
          this.broadcast(
            pick([
              `Carrinho preciso de ${p.name} em ${prevOwner.name}!`,
              `Chegou na bola ${p.name}, desarmando ${prevOwner.name}!`,
            ]),
            'normal',
            'excited',
            2.2
          );
        }
        return;
      }
    }

    // Checa falta simples (atingiu portador da bola por trás sem tocar na bola)
    if (this.ball.ownerId) {
      const victim = this.players.find((pl) => pl.id === this.ball.ownerId);
      if (victim && victim.team !== p.team) {
        const distVictim = Math.hypot(p.x - victim.x, p.y - victim.y);
        if (distVictim < 21 && distBall > 22) {
          // Produto escalar positivo => entrada por trás
          const dot = p.facingX * victim.facingX + p.facingY * victim.facingY;
          if (dot > 0.25) {
            this.triggerFoul(p.team, victim.team, victim.x, victim.y, p.name, victim.name);
          }
        }
      }
    }
  }

  private triggerFoul(
    foulingTeam: 'home' | 'away',
    victimTeam: 'home' | 'away',
    spotX: number,
    spotY: number,
    foulerName?: string,
    victimPlayerName?: string
  ): void {
    if (foulingTeam === 'home') this.stats.homeFouls++;
    else this.stats.awayFouls++;

    this.phase = 'FREE_KICK';
    this.setPieceTeam = victimTeam;
    this.setPieceSpotX = Math.max(FIELD_LEFT + 60, Math.min(FIELD_RIGHT - 60, spotX));
    this.setPieceSpotY = Math.max(FIELD_TOP + 35, Math.min(FIELD_BOTTOM - 35, spotY));
    this.setPieceWaitTimer = 0.9;
    this.ball.ownerId = null;
    this.ball.x = this.setPieceSpotX;
    this.ball.y = this.setPieceSpotY;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;

    this.positionForSetPiece();
    this.referee.whistleTimer = 1.1;
    this.referee.cardTimer = 2.0; // Juiz mostra cartão amarelo!
    this.referee.signalTimer = 1.6;
    this.referee.signalDirX = this.getAttackDir(victimTeam);
    this.raiseNearestLinesmanFlag(this.setPieceSpotX, this.setPieceSpotY, this.getAttackDir(victimTeam), 1.8);
    this.showCallout(
      'FALTA!',
      foulerName
        ? `Amarelo p/ ${foulerName} · ${victimTeam === 'home' ? this.homeClub.shortName : this.awayClub.shortName}`
        : `Cartão Amarelo · ${victimTeam === 'home' ? this.homeClub.shortName : this.awayClub.shortName}`,
      'foul',
      1.9
    );
    retroAudio.playWhistle('double');
    const victimClubName = victimTeam === 'home' ? this.homeClub.name : this.awayClub.name;
    const foulLine =
      foulerName && victimPlayerName
        ? `Pode isso, Arnaldo?! Falta dura de ${foulerName} em cima de ${victimPlayerName}! Cartão amarelo e bola parada para o ${victimClubName}!`
        : `Pode isso, Arnaldo?! Falta dura marcada! Cartão amarelo e bola parada para o ${victimClubName}!`;
    const foulAnalyst = Math.random() < 0.68 ? 'neto' : 'casagrande';
    const foulReply =
      foulAnalyst === 'neto'
        ? `Ô Galvão, falta perigosíssima! Na minha época de camisa dez, daí eu guardava direto na gaveta!`
        : `Falta claríssima, Galvão! Chegou atrasado e mereceu o cartão amarelo!`;
    this.broadcastDialogue(foulLine, foulReply, foulAnalyst, 'high', 'excited', 5.0);
  }

  private performPass(
    p: FieldPlayer,
    aimX: number,
    aimY: number,
    isLob: boolean,
    power = 0.55
  ): void {
    // Se for o goleiro, usa o sistema dedicado sem bugs de distribuição
    if (p.role === 'GK') {
      this.distributeFromGoalkeeper(p, aimX, aimY, isLob);
      return;
    }

    // Limpa bicicletas engatilhadas anteriores ao iniciar novo passe/cruzamento
    for (const pl of this.players) {
      if (pl.team === p.team) pl.queuedBicycle = false;
    }

    const clampedPower = Math.max(0.18, Math.min(1, power));
    const attackDir = this.getAttackDir(p.team);
    const oppGoalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;
    const distToOppEndline = Math.abs(oppGoalX - p.x);
    const isWideWing = Math.abs(p.y - FIELD_CENTER_Y) > 145;
    const aimingInward = (FIELD_CENTER_Y - p.y) * aimY > -0.15;
    const isWingCross =
      isLob &&
      (this.phase === 'CORNER' ||
        (distToOppEndline < 1040 && isWideWing) ||
        (distToOppEndline < 840 && Math.abs(p.y - FIELD_CENTER_Y) > 100 && aimingInward));

    const dirX = Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1 ? aimX : p.facingX;
    const dirY = Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1 ? aimY : p.facingY;
    const aimLen = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / aimLen;
    const ny = dirY / aimLen;

    // --- CRUZAMENTO AJUSTADO COM BARRA DE FORÇA (1º PAU -> MIOLO -> 2º PAU) + CURVA PRECISA ---
    if (isWingCross) {
      // Ponto ideal dentro da área: seguro fora das mãos do goleiro e perfeito para cabeçada ou BICICLETA!
      const boxCenterX = oppGoalX - attackDir * (175 + (1 - clampedPower) * 58);
      // Força da barra controla profundidade: fraco = 1º pau, médio = miolo/marca do pênalti, forte = 2º pau!
      const crossDirFromWing = p.y < FIELD_CENTER_Y ? 1 : -1;
      const desiredZoneY = FIELD_CENTER_Y + crossDirFromWing * ((clampedPower - 0.5) * 195);

      let bestTarget: FieldPlayer | null = null;
      let bestCrossScore = -Infinity;
      for (const mate of this.players) {
        if (mate.team !== p.team || mate.id === p.id || mate.role === 'GK') continue;
        const distZone = Math.hypot(mate.x - boxCenterX, mate.y - desiredZoneY);
        const distFromCross = Math.hypot(mate.x - p.x, mate.y - p.y);
        if (distFromCross < 75 || distFromCross > 1350) continue;
        const roleBonus = mate.role === 'FWD' ? 2.4 : mate.role === 'MID' ? 1.2 : 0.2;
        const score = roleBonus - distZone / 320;
        if (score > bestCrossScore) {
          bestCrossScore = score;
          bestTarget = mate;
        }
      }

      // Mira inteligentemente no ponto de encontro do atacante entrando na área!
      const rawTargetX = bestTarget
        ? Math.max(
            FIELD_LEFT + GOALBOX_W + 18,
            Math.min(
              FIELD_RIGHT - GOALBOX_W - 18,
              bestTarget.x * 0.62 + boxCenterX * 0.38 + bestTarget.vx * 0.35 + attackDir * 22
            )
          )
        : boxCenterX;
      const rawTargetY = bestTarget
        ? Math.max(
            FIELD_TOP + 115,
            Math.min(
              FIELD_BOTTOM - 115,
              bestTarget.y * 0.68 + desiredZoneY * 0.32 + bestTarget.vy * 0.28
            )
          )
        : desiredZoneY;

      const dx = rawTargetX - p.x;
      const dy = rawTargetY - p.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Tempo de voo legível e natural (0.68s..1.12s) para o atacante correr e cronometrar a bicicleta ou cabeceio!
      const flightTime = Math.min(1.12, Math.max(0.68, dist / (445 + clampedPower * 125)));
      const dragComp = Math.pow(1 / 0.88, flightTime * 0.52);
      const crossSpin = crossDirFromWing * attackDir * (4.2 + clampedPower * 2.0);
      const ux = dx / dist;
      const uy = dy / dist;
      const perpX = -uy;
      const perpY = ux;
      const curveShift = crossSpin * 26 * 0.44 * flightTime * flightTime;
      const launchDx = dx - perpX * curveShift;
      const launchDy = dy - perpY * curveShift;

      const vx = (launchDx / flightTime) * dragComp;
      const vy = (launchDy / flightTime) * dragComp;
      const GRAVITY = 560;
      const startZ = 12;
      // Altura perfeita de bicicleta / testada (28..38) ao chegar no atacante!
      const arrivalHeadZ = 28 + clampedPower * 10;
      const vz = Math.min(
        365,
        Math.max(205, (arrivalHeadZ - startZ + 0.5 * GRAVITY * flightTime * flightTime) / flightTime)
      );

      p.facingX = ux;
      p.facingY = uy;

      if (bestTarget) {
        if (p.team === 'home') this.p1SelectedId = bestTarget.id;
        else if (this.config.controlMode === '1P_2P') this.p2SelectedId = bestTarget.id;
      }

      this.lastPasserName = p.name;
      this.lastPasserTeam = p.team;
      this.lastPasserTime = this.animTime;
      this.releaseBall(p, vx, vy, vz, 'cross', 18, crossSpin);
      this.ball.passTargetId = bestTarget ? bestTarget.id : null;
      this.ball.passTargetX = rawTargetX;
      this.ball.passTargetY = rawTargetY;
      this.ball.isCrossBall = true;

      retroAudio.playKick(0.55 + clampedPower * 0.28);
      this.crowdExcitement = Math.max(this.crowdExcitement, 0.78);
      const postLabel =
        clampedPower < 0.36 ? 'no primeiro pau' : clampedPower > 0.72 ? 'no segundo pau' : 'na área';
      this.broadcast(
        bestTarget
          ? `Cruzamento na medida de ${p.name} ${postLabel} pra ${bestTarget.name}!`
          : `Cruzamento venenoso de ${p.name} ${postLabel}!`,
        'high',
        'excited',
        2.3
      );
      return;
    }

    // --- PASSE RASTEIRO OU LANÇAMENTO CONTROLADO PELA BARRA DE FORÇA ---
    const maxPassDist = isLob ? 460 + clampedPower * 760 : 320 + clampedPower * 660;
    const idealPassDist = isLob ? 300 + clampedPower * 580 : 150 + clampedPower * 490;

    let bestMate: FieldPlayer | null = null;
    let bestScore = -Infinity;
    for (const mate of this.players) {
      if (mate.team !== p.team || mate.id === p.id) continue;
      const dx = mate.x - p.x;
      const dy = mate.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 38 || dist > maxPassDist) continue;
      const dot = (dx / dist) * nx + (dy / dist) * ny;
      if (dot > (isLob ? 0.22 : 0.24)) {
        let laneBlocked = 0;
        for (const opp of this.players) {
          if (opp.team === p.team) continue;
          const proj = ((opp.x - p.x) * dx + (opp.y - p.y) * dy) / (dist * dist);
          if (proj > 0.12 && proj < 0.88) {
            const perp = Math.hypot(opp.x - (p.x + dx * proj), opp.y - (p.y + dy * proj));
            if (perp < 30) laneBlocked += 0.38;
          }
        }
        const distFit = 1 - Math.min(1, Math.abs(dist - idealPassDist) / 680);
        const score = dot * 2.7 + distFit * 1.15 - (isLob ? laneBlocked * 0.2 : laneBlocked * 0.65);
        if (score > bestScore) {
          bestScore = score;
          bestMate = mate;
        }
      }
    }

    // Fallback de assistência: se nenhum companheiro estiver no cone estreito, escolhe o melhor no semicírculo à frente para que SEMPRE haja alguém correndo automático para dominar!
    if (!bestMate) {
      let fallbackScore = -Infinity;
      for (const mate of this.players) {
        if (mate.team !== p.team || mate.id === p.id || mate.role === 'GK') continue;
        const dx = mate.x - p.x;
        const dy = mate.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 40 || dist > maxPassDist * 1.18) continue;
        const dot = (dx / dist) * nx + (dy / dist) * ny;
        if (dot > -0.15) {
          const score = dot * 2.2 - dist / 650;
          if (score > fallbackScore) {
            fallbackScore = score;
            bestMate = mate;
          }
        }
      }
    }

    let vx: number;
    let vy: number;
    let vz: number;
    let spin = 0;
    let targetX = p.x + nx * idealPassDist;
    let targetY = p.y + ny * idealPassDist;

    if (bestMate) {
      const rawDist = Math.hypot(bestMate.x - p.x, bestMate.y - p.y);
      const flightTime = isLob
        ? Math.min(0.95, Math.max(0.45, rawDist / (540 + clampedPower * 130)))
        : Math.min(0.62, Math.max(0.20, rawDist / (560 + clampedPower * 220)));

      targetX = Math.max(FIELD_LEFT + 35, Math.min(FIELD_RIGHT - 35, bestMate.x + bestMate.vx * flightTime * 0.72));
      targetY = Math.max(FIELD_TOP + 35, Math.min(FIELD_BOTTOM - 35, bestMate.y + bestMate.vy * flightTime * 0.72));

      const leadX = targetX - p.x;
      const leadY = targetY - p.y;
      const dist = Math.hypot(leadX, leadY) || 1;

      if (isLob) {
        const speed = Math.min(780, Math.max(390, (dist / flightTime) * 1.07));
        vx = (leadX / dist) * speed;
        vy = (leadY / dist) * speed;
        vz = Math.min(340, Math.max(185, 0.5 * 560 * flightTime));
        spin = (ny * (leadX / dist) - nx * (leadY / dist)) * 4.4;
      } else {
        const k = 1.17;
        const zipMult = 0.88 + clampedPower * 0.30;
        const speed = Math.min(760, Math.max(310, ((dist * k) / Math.max(0.2, 1 - Math.exp(-k * flightTime)) + 30) * zipMult));
        vx = (leadX / dist) * speed;
        vy = (leadY / dist) * speed;
        vz = dist > 380 ? 22 : 8;
        spin = 0;
      }
      p.facingX = leadX / dist;
      p.facingY = leadY / dist;

      if (p.team === 'home' && bestMate.role !== 'GK') {
        this.p1SelectedId = bestMate.id;
      } else if (
        this.config.controlMode === '1P_2P' &&
        p.team === 'away' &&
        bestMate.role !== 'GK'
      ) {
        this.p2SelectedId = bestMate.id;
      }

      if (this.playByPlayCooldown <= 0) {
        const inAttackHalf = (bestMate.x - FIELD_CENTER_X) * attackDir > 80;
        if (Math.random() < (isLob ? 0.72 : inAttackHalf ? 0.52 : 0.32)) {
          this.playByPlayCooldown = 2.2;
          this.broadcast(
            isLob
              ? pick([
                  `Lançamento longo de ${p.name} pra ${bestMate.name}!`,
                  `Bola virada por ${p.name} encontrando ${bestMate.name}!`,
                ])
              : pick([
                  `Toque preciso de ${p.name} pra ${bestMate.name}!`,
                  `${p.name} aciona ${bestMate.name} com categoria!`,
                  `Bela tabela de ${p.name} com ${bestMate.name}!`,
                ]),
            'normal',
            inAttackHalf && isLob ? 'excited' : 'calm',
            2.1
          );
        }
      }
    } else {
      const speed = isLob ? 440 + clampedPower * 320 : 350 + clampedPower * 340;
      vx = nx * speed;
      vy = ny * speed;
      vz = isLob ? 185 + clampedPower * 135 : 10 + clampedPower * 16;
    }

    this.lastPasserName = p.name;
    this.lastPasserTeam = p.team;
    this.lastPasserTime = this.animTime;
    this.releaseBall(p, vx, vy, vz, isLob ? 'lob' : 'pass', 18, spin);
    this.ball.passTargetId = bestMate ? bestMate.id : null;
    this.ball.passTargetX = targetX;
    this.ball.passTargetY = targetY;
    this.ball.isCrossBall = false;

    if (isLob) {
      retroAudio.playKick(0.45 + clampedPower * 0.3);
    } else {
      retroAudio.playPass();
    }
  }

  // --- DISTRIBUIÇÃO DEDICADA E LIVRE DE BUGS DO GOLEIRO (PASSE RASTEIRO E LANÇAMENTO ALTO) ---
  private distributeFromGoalkeeper(
    gk: FieldPlayer,
    aimX: number,
    aimY: number,
    isLongLob: boolean
  ): void {
    const attackDir = this.getAttackDir(gk.team);
    const hasManualAim = Math.abs(aimX) > 0.15 || Math.abs(aimY) > 0.15;

    // Garante que a mira NUNCA aponte para trás contra o próprio gol
    let safeAimX = hasManualAim ? aimX : attackDir;
    if (safeAimX * attackDir < 0.25) {
      safeAimX = attackDir * 0.7;
    }
    const safeAimY = hasManualAim ? aimY : 0;
    const aimLen = Math.hypot(safeAimX, safeAimY) || 1;
    const nx = safeAimX / aimLen;
    const ny = safeAimY / aimLen;

    // Avalia TODOS os companheiros de linha escolhendo o melhor alvo LIVRE de marcação!
    let bestMate: FieldPlayer | null = null;
    let bestScore = -Infinity;

    for (const mate of this.players) {
      if (mate.team !== gk.team || mate.id === gk.id || mate.role === 'GK') continue;
      const dx = mate.x - gk.x;
      const dy = mate.y - gk.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 70 || dist > 1350) continue;
      // Precisa estar à frente do goleiro
      if (dx * attackDir < 40) continue;

      const dot = (dx / dist) * nx + (dy / dist) * ny;

      // Calcula o quão livre o companheiro está de marcadores adversários
      let nearestOpp = 400;
      for (const opp of this.players) {
        if (opp.team === gk.team) continue;
        const dOpp = Math.hypot(opp.x - mate.x, opp.y - mate.y);
        if (dOpp < nearestOpp) nearestOpp = dOpp;
      }
      const opennessScore = Math.min(1.6, nearestOpp / 120);

      // Passe curto prefere DEF/MID mais próximos; Lançamento longo prefere MID/FWD mais à frente
      const idealDist = isLongLob ? 760 : 340;
      const distFit = 1 - Math.min(1, Math.abs(dist - idealDist) / 720);
      const roleBonus = isLongLob
        ? mate.role === 'FWD'
          ? 0.55
          : mate.role === 'MID' || mate.role === 'LAT'
            ? 0.35
            : 0
        : isDefenderRole(mate.role)
          ? 0.55
          : mate.role === 'MID'
            ? 0.4
            : 0.1;

      const aimWeight = hasManualAim ? dot * 2.2 : dot * 0.6;
      const score = aimWeight + opennessScore * 1.15 + distFit * 0.9 + roleBonus;

      if (score > bestScore) {
        bestScore = score;
        bestMate = mate;
      }
    }

    let dirX = nx;
    let dirY = ny;
    let vx: number;
    let vy: number;
    let vz: number;

    if (bestMate) {
      // Compensa deslocamento do companheiro para entregar no pé / corrida limpa
      const leadX = bestMate.x + bestMate.vx * 0.22 - gk.x;
      const leadY = bestMate.y + bestMate.vy * 0.22 - gk.y;
      const dist = Math.hypot(leadX, leadY) || 1;
      dirX = leadX / dist;
      dirY = leadY / dist;

      if (isLongLob) {
        // Balística ajustada para arrasto no ar (0.84/s) e gravidade (560)
        const speed = Math.min(760, Math.max(460, dist * 0.94));
        vx = dirX * speed;
        vy = dirY * speed;
        vz = Math.min(340, Math.max(215, dist * 0.36));
      } else {
        // Passe rasteiro firme que chega com precisão nos pés do companheiro
        const speed = Math.min(640, Math.max(420, dist * 1.38));
        vx = dirX * speed;
        vy = dirY * speed;
        vz = 26;
      }

      // Troca seleção imediata para o jogador que vai receber a bola!
      if (gk.team === 'home') {
        this.p1SelectedId = bestMate.id;
      } else if (this.config.controlMode === '1P_2P') {
        this.p2SelectedId = bestMate.id;
      }
    } else {
      const speed = isLongLob ? 640 : 480;
      vx = dirX * speed;
      vy = dirY * speed;
      vz = isLongLob ? 280 : 28;
    }

    gk.facingX = dirX;
    gk.facingY = dirY;
    gk.holdBallTimer = 0;
    // CRÍTICO: impede o goleiro de encaixar ou rebater o próprio passe/lançamento!
    gk.gkNoCatchTimer = 0.72;

    this.releaseBall(gk, vx, vy, vz, isLongLob ? 'lob' : 'pass', 26);
    this.ball.passTargetId = bestMate ? bestMate.id : null;
    this.ball.passTargetX = bestMate ? bestMate.x : gk.x + dirX * 360;
    this.ball.passTargetY = bestMate ? bestMate.y : gk.y + dirY * 360;
    this.ball.isCrossBall = false;
    this.lastTouchedCooldown = 0.24;

    if (isLongLob) {
      retroAudio.playKick(0.75);
      this.showCallout('LANÇAMENTO DO GOLEIRO!', bestMate ? `${gk.name} -> ${bestMate.name}` : gk.name, 'info', 1.15);
      if (this.playByPlayCooldown <= 0) {
        this.playByPlayCooldown = 2.8;
        this.broadcast(
          bestMate
            ? `Saque longo de ${gk.name} procurando ${bestMate.name} no ataque!`
            : `Reposição longa do goleiro ${gk.name}!`,
          'normal',
          'calm',
          2.6
        );
      }
    } else {
      retroAudio.playPass();
      if (bestMate && this.playByPlayCooldown <= 0) {
        this.playByPlayCooldown = 3.0;
        this.broadcast(`Sai jogando curto ${gk.name} com ${bestMate.name}.`, 'normal', 'calm', 2.4);
      }
    }
  }

  private performShot(p: FieldPlayer, power: number, aimX: number, aimY: number): void {
    const attackDir = this.getAttackDir(p.team);
    const goalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;

    // Mira precisa e intuitiva: busca o canto escolhido ou o canto aberto longe do goleiro!
    const oppGk = this.players.find((pl) => pl.team !== p.team && pl.role === 'GK');
    let targetY = FIELD_CENTER_Y;
    const isAimedCorner = Math.abs(aimY) > 0.12;
    if (isAimedCorner) {
      targetY = FIELD_CENTER_Y + Math.max(-1, Math.min(1, aimY)) * (GOAL_HALF_H - 12);
    } else if (Math.abs(p.facingY) > 0.22) {
      targetY = FIELD_CENTER_Y + Math.max(-0.85, Math.min(0.85, p.facingY)) * (GOAL_HALF_H - 14);
    } else if (oppGk) {
      // Sem direcional vertical, coloca no canto contrário ao goleiro para facilitar finalizações!
      const openSide = oppGk.y >= FIELD_CENTER_Y ? -1 : 1;
      targetY = FIELD_CENTER_Y + openSide * (GOAL_HALF_H * 0.62);
    } else {
      targetY = FIELD_CENTER_Y + (Math.random() - 0.5) * 60;
    }

    const toGoalX = goalX - p.x;
    const toGoalY = targetY - p.y;
    const distGoal = Math.hypot(toGoalX, toGoalY) || 1;
    let dirX = toGoalX / distGoal;
    let dirY = toGoalY / distGoal;

    if (Math.abs(aimX) > 0.35 && Math.sign(aimX) !== attackDir && distGoal > 260) {
      const len = Math.hypot(aimX, aimY) || 1;
      dirX = aimX / len;
      dirY = aimY / len;
    }

    // Bloqueio defensivo leve (só quando o zagueiro está realmente colado na frente do chute)
    let nearestDefDist = Infinity;
    let blocker: FieldPlayer | null = null;
    for (const opp of this.players) {
      if (opp.team === p.team || opp.role === 'GK') continue;
      const odx = opp.x - p.x;
      const ody = opp.y - p.y;
      const od = Math.hypot(odx, ody);
      if (od < nearestDefDist) nearestDefDist = od;
      if (od > 6 && od < 42) {
        const align = (odx / od) * dirX + (ody / od) * dirY;
        if (align > 0.85 && Math.random() < 0.12 + (opp.defense - 78) * 0.003) {
          blocker = opp;
          break;
        }
      }
    }

    if (blocker) {
      // Zagueiro travou o chute em cima da hora!
      p.facingX = dirX;
      p.facingY = dirY;
      const deflectAngle = Math.atan2(dirY, dirX) + (Math.random() < 0.5 ? 1.15 : -1.15);
      this.releaseBall(
        p,
        Math.cos(deflectAngle) * 250,
        Math.sin(deflectAngle) * 250,
        115,
        'shot'
      );
      this.ball.lastTouchTeam = blocker.team;
      this.ball.lastTouchPlayerId = blocker.id;
      this.ball.lastTouchPlayerName = blocker.name;
      this.ball.lastTouchPlayerNumber = blocker.number;
      this.ball.shotInFlight = false;
      blocker.stealAnimTimer = 0.28;
      retroAudio.playKick(0.45);
      retroAudio.playCrowdOoh();
      this.showCallout('BLOQUEIO!!', `${blocker.name} travou!`, 'info', 1.1);
      this.broadcast(`Travou na hora H ${blocker.name}! Bloqueio salvador!`, 'normal', 'excited', 2.2, 'galvao');
      return;
    }

    // Finalização muito precisa, forte e prazerosa de fazer gols!
    const playerSpeed = Math.hypot(p.vx, p.vy);
    const pressureSpread = nearestDefDist < 58 ? ((58 - nearestDefDist) / 58) * 0.042 : 0;
    const sprintSpread = playerSpeed > 235 ? 0.018 : 0;
    const distanceSpread = distGoal > 520 ? Math.min(0.055, ((distGoal - 520) / 600) * 0.045) : 0;
    const acuteAngle =
      Math.abs(toGoalX) < 130 && Math.abs(p.y - FIELD_CENTER_Y) > GOAL_HALF_H + 75 ? 0.032 : 0;
    const overchargeSpread = power > 0.95 ? (power - 0.95) * 0.55 : 0;
    const baseSpread = ((100 - p.attack) / 100) * 0.036 + 0.008;
    const totalSpread =
      baseSpread + pressureSpread + sprintSpread + distanceSpread + acuteAngle + overchargeSpread;

    const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * totalSpread;

    const shotSpeed = 585 + power * 390 + (p.attack - 75) * 2.8;
    const vx = Math.cos(angle) * shotSpeed;
    const vy = Math.sin(angle) * shotSpeed;
    // Elevação calibrada para entrar firme abaixo do travessão (CROSSBAR_Z = 76) quase sempre!
    const overLift = power > 0.95 ? (power - 0.95) * 260 : 0;
    const vz = 48 + power * 130 + overLift;
    // Curva sutil natural ao mirar para o canto (chute colocado!)
    const naturalCurl = isAimedCorner ? -Math.sign(aimY) * attackDir * (2.0 + power * 1.5) : (Math.random() - 0.5) * 1.4;
    p.facingX = Math.cos(angle);
    p.facingY = Math.sin(angle);

    this.releaseBall(p, vx, vy, vz, 'shot', 18, naturalCurl);
    // Ativa controle leve da bola durante o voo do chute!
    this.shotAfterTouchTimer = 0.65;
    this.shotControllerTeam = p.team;

    if (p.team === 'home') this.stats.homeShots++;
    else this.stats.awayShots++;

    if (Math.sign(vx) === attackDir) {
      const tToGoal = (goalX - p.x) / (vx || 1);
      const yAtGoal = p.y + vy * tToGoal;
      if (tToGoal > 0 && Math.abs(yAtGoal - FIELD_CENTER_Y) <= GOAL_HALF_H + 12) {
        if (p.team === 'home') this.stats.homeShotsOnTarget++;
        else this.stats.awayShotsOnTarget++;
      }
      if (distGoal < 820) {
        const oppGkName = oppGk ? oppGk.name : 'o goleiro';
        this.crowdExcitement = Math.max(this.crowdExcitement, 0.76);
        this.broadcast(
          distGoal > 480
            ? pick([
                `Bomba de longe de ${p.name}! Soltou a pancada, atenção ${oppGkName}!`,
                `Arriscou de fora da área ${p.name}! Ripa na chulipa!`,
              ])
            : pick([
                `Bateu ${p.name} pro gol! Olho no lance, ${oppGkName}!`,
                `Finalização firme de ${p.name}! Olha o gol!`,
                `Mandou a bomba ${p.name} pro canto!`,
              ]),
          'normal',
          'excited',
          2.1,
          'galvao'
        );
      }
    }

    retroAudio.playKick(power);
  }

  private releaseBall(
    p: FieldPlayer,
    vx: number,
    vy: number,
    vz: number,
    kickType: 'shot' | 'pass' | 'lob' | 'cross' | 'header' | 'bicycle',
    offsetDist = 18,
    customSpin?: number
  ): void {
    const isShot = kickType === 'shot' || kickType === 'header' || kickType === 'bicycle';
    this.ball.ownerId = null;
    this.ball.x = p.x + p.facingX * offsetDist;
    this.ball.y = p.y + p.facingY * offsetDist;
    this.ball.z = Math.max(
      kickType === 'bicycle'
        ? 38
        : kickType === 'header'
          ? 32
          : kickType === 'lob' || kickType === 'cross'
            ? 12
            : 3,
      this.ball.z
    );
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = vz;
    this.ball.spin = customSpin !== undefined ? customSpin : (Math.random() - 0.5) * 3.5;
    this.ball.lastTouchTeam = p.team;
    this.ball.lastTouchPlayerId = p.id;
    this.ball.lastTouchPlayerName = p.name;
    this.ball.lastTouchPlayerNumber = p.number;
    this.ball.shotInFlight = isShot;
    this.ball.shotTeam = isShot ? p.team : null;
    this.ball.isBicycleShot = kickType === 'bicycle';
    p.kickType = kickType;
    if (kickType === 'bicycle') {
      p.bicycleAnimTimer = 0.66;
    } else if (kickType === 'header') {
      p.headerAnimTimer = 0.42;
    } else if (isShot) {
      p.kickAnimTimer = 0.36;
    } else {
      p.passAnimTimer = kickType === 'lob' || kickType === 'cross' ? 0.34 : 0.26;
    }
    this.lastTouchedCooldown = 0.18;
  }

  private tryClaimLooseBall(p: FieldPlayer): void {
    if (this.lastTouchedCooldown > 0 && this.ball.lastTouchPlayerId === p.id) return;

    // Se o jogador armou uma BICICLETA para este cruzamento/bola aérea, finaliza de bicicleta em vez de dominar!
    if (
      !this.ball.ownerId &&
      p.queuedBicycle &&
      (this.ball.isCrossBall || this.ball.z >= 5) &&
      this.ball.z <= 96
    ) {
      const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      if (dist <= 86) {
        p.queuedBicycle = false;
        this.performBicycleKick(p, p.facingX, p.facingY);
        return;
      }
    }

    const isFriendlyPass = !this.ball.ownerId && this.ball.lastTouchTeam === p.team;
    const isIntendedReceiver = this.ball.passTargetId === p.id;
    // Permite dominar passes e cruzamentos dos companheiros até a altura do peito/ombro (z <= 48) com raio generoso!
    const maxTrapZ = isFriendlyPass ? 48 : 34;
    if (this.ball.z > maxTrapZ) return;

    const claimRadius = isIntendedReceiver ? 46 : isFriendlyPass ? 35 : 27;
    const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
    if (dist > claimRadius) return;

    if (!this.ball.ownerId) {
      const incomingSpeed = Math.hypot(this.ball.vx, this.ball.vy);
      p.queuedBicycle = false;
      this.giveBallTo(p);
      // Domínio de bola amortecido e limpo no peito/pé no primeiro toque
      if (incomingSpeed > 140) {
        p.vx = p.vx * 0.72 + this.ball.vx * 0.08;
        p.vy = p.vy * 0.72 + this.ball.vy * 0.08;
        retroAudio.playFirstTouch();
      }
      return;
    }

    const owner = this.players.find((pl) => pl.id === this.ball.ownerId);
    // Nunca rouba do goleiro ou durante o pico de uma pedalada/drible limpo
    if (owner && owner.team !== p.team && owner.role !== 'GK' && owner.skillMoveTimer <= 0.12) {
      const stealChance = 0.03 + ((p.defense - owner.attack) / 600);
      if (Math.random() < Math.max(0.015, stealChance)) {
        owner.stunTimer = 0.3;
        this.giveBallTo(p);
        retroAudio.playFirstTouch();
      }
    }
  }

  // Simula a trajetória física real da bola (arrasto + gravidade + efeito Magnus) até a linha do goleiro
  private predictBallAtX(targetX: number): { y: number; z: number; time: number } | null {
    let bx = this.ball.x;
    let by = this.ball.y;
    let bz = this.ball.z;
    let vx = this.ball.vx;
    let vy = this.ball.vy;
    let vz = this.ball.vz;
    let spin = this.ball.spin;

    const movingLeft = vx < -40;
    const movingRight = vx > 40;
    if (movingLeft && bx < targetX) return null;
    if (movingRight && bx > targetX) return null;
    if (!movingLeft && !movingRight) return null;

    const stepDt = 0.035;
    const maxSteps = 34; // ~1.19s
    for (let i = 1; i <= maxSteps; i++) {
      const prevX = bx;
      const prevY = by;
      const prevZ = bz;

      bx += vx * stepDt;
      by += vy * stepDt;
      bz += vz * stepDt;
      vz -= 560 * stepDt;

      if (bz > 4 && Math.abs(spin) > 0.1) {
        const hs = Math.hypot(vx, vy);
        if (hs > 60) {
          vx += (-vy / hs) * spin * 26 * stepDt;
          vy += (vx / hs) * spin * 26 * stepDt;
        }
        spin *= Math.pow(0.72, stepDt);
      }

      if (bz <= 0) {
        bz = 0;
        if (Math.abs(vz) > 44) {
          vz = -vz * 0.52;
          vx *= 0.9;
          vy *= 0.9;
        } else {
          vz = 0;
          const fr = Math.pow(0.31, stepDt);
          vx *= fr;
          vy *= fr;
        }
      } else {
        const drag = Math.pow(0.88, stepDt);
        vx *= drag;
        vy *= drag;
      }

      const crossed = (movingLeft && bx <= targetX) || (movingRight && bx >= targetX);
      if (crossed) {
        const denom = bx - prevX || 1;
        const frac = Math.max(0, Math.min(1, (targetX - prevX) / denom));
        return {
          y: prevY + (by - prevY) * frac,
          z: Math.max(0, prevZ + (bz - prevZ) * frac),
          time: (i - 1 + frac) * stepDt,
        };
      }
    }
    return null;
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // Checagem contínua (swept) calibrada para nível fácil e divertido de fazer gols!
  private checkGoalkeeperSweptIntercept(prevX: number, prevY: number, prevZ: number): boolean {
    if (this.ball.ownerId) return false;
    const minZ = Math.min(prevZ, this.ball.z);
    if (minZ > CROSSBAR_Z + 4) return false;

    for (const gk of this.players) {
      if (gk.role !== 'GK') continue;
      if (gk.stunTimer > 0) continue;
      const canCatchNow =
        gk.gkNoCatchTimer <= 0 &&
        !(this.lastTouchedCooldown > 0 && this.ball.lastTouchPlayerId === gk.id);
      if (!canCatchNow) continue;

      const reach = gk.diveTimer > 0 ? 30 : gk.gkRushActive ? 24 : 22;
      const segDist = this.pointToSegmentDist(gk.x, gk.y, prevX, prevY, this.ball.x, this.ball.y);
      if (segDist <= reach) {
        this.goalkeeperSave(gk, gk.gkRushActive);
        return true;
      }
    }
    return false;
  }

  // --- IA DE GOLEIRO ARCADE DIVERTIDA (FÁCIL DE FAZER GOLS NOS CANTOS E NO 1x1!) ---
  private updateGoalkeeperAI(
    gk: FieldPlayer,
    dt: number,
    humanInput: PlayerInputState | null
  ): void {
    this.tickPlayerTimers(gk, dt);
    const profile = DIFFICULTY_PROFILES[this.config.difficulty];
    // Reflexos leves e acessíveis: o goleiro humano ajuda um pouco mais, e o da CPU permite belos gols!
    const effReflex = humanInput
      ? Math.min(0.64, profile.gkReflex + 0.14)
      : profile.gkReflex;
    const attackDir = this.getAttackDir(gk.team);
    const ownGoalX = attackDir === 1 ? FIELD_LEFT : FIELD_RIGHT;
    const lineX = ownGoalX + attackDir * 24;

    // Se o goleiro foi driblado / finteado no 1x1, ele desequilibra e escorrega pro lado errado!
    if (gk.stunTimer > 0) {
      gk.gkRushActive = false;
      gk.vx *= Math.pow(0.25, dt);
      gk.vy *= Math.pow(0.25, dt);
      this.integratePlayerPosition(gk, dt);
      return;
    }

    // Se goleiro está segurando a bola após defesa
    if (this.ball.ownerId === gk.id) {
      this.gkDiveTargets.delete(gk.id);
      gk.holdBallTimer -= dt;
      gk.gkRushActive = false;
      gk.vx = 0;
      gk.vy = 0;
      gk.facingX = attackDir;
      gk.facingY = humanInput && Math.abs(humanInput.dy) > 0.15 ? humanInput.dy : 0;

      if (humanInput && gk.holdBallTimer < 0.95) {
        if (humanInput.passJustPressed) {
          this.distributeFromGoalkeeper(gk, humanInput.dx, humanInput.dy, false);
          return;
        }
        if (humanInput.lobJustPressed || humanInput.shootJustPressed) {
          this.distributeFromGoalkeeper(gk, humanInput.dx, humanInput.dy, true);
          return;
        }
      }

      if (gk.holdBallTimer <= (humanInput ? -0.75 : 0)) {
        const useLob = Math.random() < 0.58;
        this.distributeFromGoalkeeper(gk, attackDir, (Math.random() - 0.5) * 0.65, useLob);
      }
      return;
    }

    const canCatchNow =
      gk.gkNoCatchTimer <= 0 &&
      !(this.lastTouchedCooldown > 0 && this.ball.lastTouchPlayerId === gk.id);

    // Ponte elástica com alcance e velocidade moderados (chutes nos cantos vencem o goleiro!)
    if (gk.diveTimer > 0) {
      const diveTarget = this.gkDiveTargets.get(gk.id);
      const diveLatSpeed = 265 + effReflex * 75;
      if (diveTarget) {
        const ddx = diveTarget.x - gk.x;
        const ddy = diveTarget.y - gk.y;
        const dDist = Math.hypot(ddx, ddy);
        if (dDist > 6) {
          const stepSpd = Math.min(diveLatSpeed, dDist * 9.5);
          gk.x += (ddx / dDist) * stepSpd * dt;
          gk.y += (ddy / dDist) * stepSpd * dt;
        }
      } else {
        gk.x += gk.diveDirX * 195 * dt;
        gk.y += gk.diveDirY * diveLatSpeed * dt;
      }

      gk.x = Math.max(FIELD_LEFT + 8, Math.min(FIELD_RIGHT - 8, gk.x));
      gk.y = Math.max(FIELD_TOP + 24, Math.min(FIELD_BOTTOM - 24, gk.y));

      const dist = Math.hypot(gk.x - this.ball.x, gk.y - this.ball.y);
      const currOwner = this.ball.ownerId
        ? this.players.find((pl) => pl.id === this.ball.ownerId)
        : null;
      const canSmother = !currOwner || currOwner.team !== gk.team;
      const catchRad = currOwner ? 23 : 31;
      if (canCatchNow && canSmother && dist < catchRad && this.ball.z < CROSSBAR_Z + 4) {
        if (currOwner && currOwner.team !== gk.team) {
          currOwner.stunTimer = 0.48;
        }
        this.gkDiveTargets.delete(gk.id);
        this.goalkeeperSave(gk, Boolean(currOwner));
      }
      return;
    }
    this.gkDiveTargets.delete(gk.id);

    // 1. Leitura preditiva de chutes (calibrada para permitir golaços no canto e de bicicleta!)
    const ballMovingTowardGoal =
      (attackDir === 1 && this.ball.vx < -115) || (attackDir === -1 && this.ball.vx > 115);
    const distXToGoal = Math.abs(this.ball.x - gk.x);

    if (canCatchNow && !this.ball.ownerId && ballMovingTowardGoal && distXToGoal < 760) {
      const pred = this.predictBallAtX(gk.x);
      if (pred) {
        const inGoalRange =
          pred.y >= GOAL_TOP - 20 &&
          pred.y <= GOAL_BOTTOM + 20 &&
          pred.z <= CROSSBAR_Z + 12;

        if (inGoalRange && pred.time < 0.88) {
          const clampedPredY = Math.max(GOAL_TOP + 16, Math.min(GOAL_BOTTOM - 16, pred.y));
          const diffY = clampedPredY - gk.y;
          const interceptX = Math.max(
            FIELD_LEFT + 14,
            Math.min(FIELD_RIGHT - 14, gk.x + attackDir * (pred.time < 0.22 ? 8 : 3))
          );

          if (pred.time > 0.30 && !this.ball.isBicycleShot) {
            const trackSpd = 185 + effReflex * 58;
            gk.vy = Math.abs(diffY) > 6 ? Math.sign(diffY) * Math.min(trackSpd, Math.abs(diffY) * 7.8) : 0;
            gk.vx = (lineX + attackDir * 10 - gk.x) * 3.5;
            gk.facingX = attackDir;
            gk.facingY = Math.sign(diffY) * 0.35;
            gk.gkRushActive = false;
            this.integratePlayerPosition(gk, dt);

            const immediateDist = Math.hypot(gk.x - this.ball.x, gk.y - this.ball.y);
            if (immediateDist < 22 && this.ball.z < CROSSBAR_Z + 4) {
              this.goalkeeperSave(gk, false);
            }
            return;
          }

          // Chutes no canto e bicicletas têm altíssima chance de superar o goleiro!
          const cornerHardness = Math.abs(clampedPredY - FIELD_CENTER_Y) / GOAL_HALF_H;
          const baseReflexThreshold = Math.max(
            0.22,
            Math.min(0.76, effReflex - cornerHardness * 0.34 + (gk.defense - 80) * 0.003)
          );
          const reflexThreshold = this.ball.isBicycleShot
            ? baseReflexThreshold * 0.22
            : baseReflexThreshold;
          if (Math.abs(diffY) > 18 || pred.time < 0.20 || this.ball.isBicycleShot) {
            if (Math.random() < reflexThreshold) {
              gk.diveTimer = 0.48;
              gk.diveDirX = attackDir * (pred.time < 0.20 ? 0.16 : 0.08);
              gk.diveDirY = Math.abs(diffY) > 4 ? Math.sign(diffY) : 0;
              this.gkDiveTargets.set(gk.id, { x: interceptX, y: clampedPredY });
              gk.gkRushActive = false;
              gk.facingX = attackDir;
              gk.facingY = Math.sign(diffY) * 0.4;
              return;
            }
          }
        }
      }
    }

    // 2. SAÍDA DO GOL (moderada para permitir cabeceios, bicicletas e dribles no 1x1!)
    const ballOwner = this.ball.ownerId
      ? this.players.find((pl) => pl.id === this.ball.ownerId)
      : null;

    const ballInGoalBox =
      (attackDir === 1
        ? this.ball.x < FIELD_LEFT + GOALBOX_W + 18
        : this.ball.x > FIELD_RIGHT - GOALBOX_W - 18) &&
      Math.abs(this.ball.y - FIELD_CENTER_Y) < GOALBOX_HALF_H + 14;

    if (canCatchNow && !ballOwner && this.ball.isCrossBall && ballInGoalBox && this.ball.z < 40) {
      gk.gkRushActive = true;
      const cdx = this.ball.x - gk.x;
      const cdy = this.ball.y - gk.y;
      const cDist = Math.hypot(cdx, cdy) || 1;
      const rushSpd = 210 + (gk.speed - 75) * 1.4;
      gk.vx = (cdx / cDist) * rushSpd;
      gk.vy = (cdy / cDist) * rushSpd;
      gk.facingX = cdx / cDist;
      gk.facingY = cdy / cDist;
      this.integratePlayerPosition(gk, dt);
      if (cDist < 26) {
        this.goalkeeperSave(gk, true);
      }
      return;
    }

    const ballInOwnBox =
      (attackDir === 1
        ? this.ball.x < FIELD_LEFT + PENALTY_W
        : this.ball.x > FIELD_RIGHT - PENALTY_W) &&
      Math.abs(this.ball.y - FIELD_CENTER_Y) < PENALTY_HALF_H;

    if (canCatchNow && !ballOwner && ballInOwnBox && this.ball.z < 34 && !ballMovingTowardGoal) {
      const gkDistToBall = Math.hypot(this.ball.x - gk.x, this.ball.y - gk.y);
      let nearestOppDist = Infinity;
      for (const pl of this.players) {
        if (pl.team === gk.team) continue;
        const d = Math.hypot(pl.x - this.ball.x, pl.y - this.ball.y);
        if (d < nearestOppDist) nearestOppDist = d;
      }
      if (gkDistToBall < nearestOppDist + 10 && gkDistToBall < 180) {
        gk.gkRushActive = true;
        const rdx = this.ball.x - gk.x;
        const rdy = this.ball.y - gk.y;
        const rDist = gkDistToBall || 1;
        const rushSpd = 205 + (gk.speed - 75) * 1.4;
        gk.vx = (rdx / rDist) * rushSpd;
        gk.vy = (rdy / rDist) * rushSpd;
        gk.facingX = rdx / rDist;
        gk.facingY = rdy / rDist;
        this.integratePlayerPosition(gk, dt);
        if (rDist < 26) {
          this.goalkeeperSave(gk, true);
        }
        return;
      }
    }

    // 2c. Saída 1x1 fácil de driblar ou tirar no canto!
    if (canCatchNow && ballOwner && ballOwner.team !== gk.team) {
      const attDistToGoal = Math.hypot(ballOwner.x - ownGoalX, ballOwner.y - FIELD_CENTER_Y);
      const inInnerDanger = attDistToGoal < 195 && Math.abs(ballOwner.y - FIELD_CENTER_Y) < 130;
      if (inInnerDanger) {
        const hasDefenderCovering = this.players.some((mate) => {
          if (mate.team !== gk.team || mate.role === 'GK') return false;
          const mateToAtt = Math.hypot(mate.x - ballOwner.x, mate.y - ballOwner.y);
          const mateCloserToGoal =
            Math.hypot(mate.x - ownGoalX, mate.y - FIELD_CENTER_Y) < attDistToGoal + 18;
          return mateToAtt < 105 && mateCloserToGoal;
        });

        if (!hasDefenderCovering) {
          gk.gkRushActive = true;
          const rdx = this.ball.x - gk.x;
          const rdy = this.ball.y - gk.y;
          const rDist = Math.hypot(rdx, rdy) || 1;
          const rushSpeed = (178 + (gk.speed - 75) * 1.4) * (0.90 + effReflex * 0.12);
          gk.vx += ((rdx / rDist) * rushSpeed - gk.vx) * Math.min(1, dt * 5.2);
          gk.vy += ((rdy / rDist) * rushSpeed - gk.vy) * Math.min(1, dt * 5.2);
          gk.facingX = rdx / rDist;
          gk.facingY = rdy / rDist;
          this.integratePlayerPosition(gk, dt);

          const attSpeed = Math.hypot(ballOwner.vx, ballOwner.vy);
          const lateralCut =
            attSpeed > 150 &&
            Math.abs((ballOwner.vx / attSpeed) * (rdy / rDist) - (ballOwner.vy / attSpeed) * (rdx / rDist)) > 0.70;
          if (rDist < 62 && lateralCut && Math.random() < 0.36) {
            gk.stunTimer = 0.52;
            gk.gkNoCatchTimer = 0.58;
            gk.gkRushActive = false;
            return;
          }

          if (rDist < 38 && this.ball.z < 30) {
            gk.diveTimer = 0.36;
            gk.diveDirX = (rdx / rDist) * 0.8;
            gk.diveDirY = (rdy / rDist) * 0.8;
            this.gkDiveTargets.set(gk.id, { x: this.ball.x, y: this.ball.y });
            if (rDist < 22) {
              ballOwner.stunTimer = 0.45;
              this.gkDiveTargets.delete(gk.id);
              this.goalkeeperSave(gk, true);
            }
          }
          return;
        }
      }
    }

    gk.gkRushActive = false;

    // 3. Posicionamento padrão na bissetriz bola-gol (deixa espaço real nos cantos para finalizações bonitas!)
    const ballDistFromGoal = Math.hypot(this.ball.x - ownGoalX, this.ball.y - FIELD_CENTER_Y);
    const advanceOut =
      ballDistFromGoal < 420
        ? Math.min(36, Math.max(8, (420 - ballDistFromGoal) * 0.11))
        : 6;
    const targetX = lineX + attackDir * advanceOut;
    const angleWeight = ballDistFromGoal < 360 ? 0.50 : ballDistFromGoal < 620 ? 0.42 : 0.34;
    const clampY = Math.max(
      GOAL_TOP + 22,
      Math.min(GOAL_BOTTOM - 22, FIELD_CENTER_Y + (this.ball.y - FIELD_CENTER_Y) * angleWeight)
    );
    const dx = targetX - gk.x;
    const dy = clampY - gk.y;
    const gkSpeed = (168 + (gk.defense - 75) * 1.6) * (0.88 + effReflex * 0.18);
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      gk.vx += ((dx / dist) * Math.min(gkSpeed, dist * 8) - gk.vx) * Math.min(1, dt * 9);
      gk.vy += ((dy / dist) * Math.min(gkSpeed, dist * 8) - gk.vy) * Math.min(1, dt * 9);
    } else {
      gk.vx *= 0.78;
      gk.vy *= 0.78;
    }
    gk.facingX = attackDir;
    gk.facingY = Math.max(-0.45, Math.min(0.45, (this.ball.y - gk.y) / 240));
    this.integratePlayerPosition(gk, dt);

    const distBall = Math.hypot(gk.x - this.ball.x, gk.y - this.ball.y);
    if (canCatchNow && !this.ball.ownerId && distBall < 22 && this.ball.z < CROSSBAR_Z + 4) {
      this.goalkeeperSave(gk, false);
    }
  }

  private goalkeeperSave(gk: FieldPlayer, wasRushSmother = false): void {
    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);
    const wasShot = this.ball.shotInFlight && this.ball.shotTeam !== gk.team;
    const shooterName =
      this.ball.lastTouchTeam !== gk.team && this.ball.lastTouchPlayerName
        ? this.ball.lastTouchPlayerName
        : null;

    retroAudio.playSave();
    this.ball.shotInFlight = false;
    this.ball.isBicycleShot = false;
    this.ball.isCrossBall = false;
    this.ball.passTargetId = null;
    this.shotAfterTouchTimer = 0;
    this.shotControllerTeam = null;

    // Em bolas fortes (> 480 px/s), o goleiro espalma pra frente gerando rebote!
    const isStrongShot = !wasRushSmother && wasShot && ballSpeed > 480;
    const isExtremeCornerRocket =
      isStrongShot && ballSpeed > 720 && Math.abs(this.ball.y - FIELD_CENTER_Y) > 54;
    const parryForward = isStrongShot && (!isExtremeCornerRocket || Math.random() < 0.76);

    if (wasShot || wasRushSmother) {
      if (gk.team === 'home') this.stats.homeSaves++;
      else this.stats.awaySaves++;
      this.showCallout(
        wasRushSmother ? 'ABAFADAÇA!!' : parryForward ? 'ESPALMOU!!' : 'DEFESAÇA!!',
        parryForward ? `Rebote de ${gk.name}!` : gk.name,
        'info',
        1.2
      );
      retroAudio.playCrowdOoh();
      this.crowdExcitement = Math.max(this.crowdExcitement, 0.86);
      const saveLead = wasRushSmother
        ? pick([
            `Sai que é sua, ${gk.name}! Fechou o ângulo nos pés do atacante!`,
            `Que coragem de ${gk.name}! Abafou o chute na hora H!`,
          ])
        : parryForward
          ? pick([
              shooterName
                ? `Bomba de ${shooterName}! Espalmou pra frente ${gk.name}! Olha o rebote, haja coração!`
                : `Espalmou pra frente ${gk.name}! Bola viva na grande área!`,
              `Soltou pra frente ${gk.name} na pancada! Atenção no rebote!`,
            ])
          : pick([
              shooterName
                ? `Defesaça de ${gk.name}! Buscou o chute de ${shooterName}! Que beleza!`
                : `Defesaça espetacular do goleirão ${gk.name}!`,
              shooterName
                ? `Encaixou firme ${gk.name} a finalização de ${shooterName}!`
                : `Que ponte fantástica de ${gk.name}!`,
            ]);
      if (Math.random() < 0.68) {
        const analyst = this.nextCommentator();
        const saveReply =
          analyst === 'casagrande'
            ? `Grande defesa, Galvão! O ${gk.name} salvou o time com um reflexo sensacional!`
            : analyst === 'ronaldo'
              ? `Nossa, Galvão! ${shooterName ? `${shooterName} bateu bonito,` : 'Que finalização,'} mas o ${gk.name} voou nela!`
              : `Você tá de brincadeira, Galvão?! Que defesaça absurda do ${gk.name}! Salvou a pátria!`;
        this.broadcastDialogue(saveLead, saveReply, analyst, 'high', 'excited', 4.8);
      } else {
        this.broadcast(saveLead, 'high', 'excited', 2.5, 'galvao');
      }
    }

    const attackDir = this.getAttackDir(gk.team);

    if (parryForward) {
      // Rebote físico pra frente/diagonal para dentro da área (a força do rebote acompanha a força do chute!)
      const powerFactor = Math.min(1.35, Math.max(0.75, ballSpeed / 640));
      const sideBias =
        Math.abs(this.ball.y - gk.y) > 8
          ? Math.sign(this.ball.y - gk.y)
          : this.ball.y < FIELD_CENTER_Y
            ? -1
            : 1;
      this.ball.ownerId = null;
      this.ball.x = gk.x + attackDir * 22;
      this.ball.y = gk.y + sideBias * 10;
      this.ball.z = Math.max(8, Math.min(24, this.ball.z));
      this.ball.vx = attackDir * (195 + Math.random() * 115) * powerFactor;
      this.ball.vy = sideBias * (85 + Math.random() * 125) * powerFactor;
      this.ball.vz = 75 + Math.random() * 58;
      this.ball.spin = sideBias * attackDir * (2.2 + Math.random() * 2.5);
      this.ball.lastTouchTeam = gk.team;
      this.ball.lastTouchPlayerId = gk.id;
      this.ball.lastTouchPlayerName = gk.name;
      this.ball.lastTouchPlayerNumber = gk.number;
      gk.gkNoCatchTimer = 0.56;
      this.lastTouchedCooldown = 0.22;
    } else if (isExtremeCornerRocket) {
      // Ponta dos dedos desviando míssil no ângulo para escanteio!
      const wideSide = this.ball.y < FIELD_CENTER_Y ? -1 : 1;
      this.ball.ownerId = null;
      this.ball.x = gk.x - attackDir * 8;
      this.ball.vx = -attackDir * 135;
      this.ball.vy = wideSide * (290 + Math.random() * 105);
      this.ball.vz = 122;
      this.ball.lastTouchTeam = gk.team;
      this.ball.lastTouchPlayerId = gk.id;
      this.ball.lastTouchPlayerName = gk.name;
      this.ball.lastTouchPlayerNumber = gk.number;
      gk.gkNoCatchTimer = 0.55;
      this.lastTouchedCooldown = 0.25;
    } else {
      // Bolas mais fracas ou médias -> goleiro encaixa seguro!
      this.giveBallTo(gk);
    }
  }

  // --- IA DE LINHA (COMPANHEIROS & ADVERSÁRIOS EM 3 NÍVEIS) ---
  private updateOutfieldAI(p: FieldPlayer, dt: number): void {
    this.tickPlayerTimers(p, dt);
    const isHumanTeam =
      p.team === 'home' || (this.config.controlMode === '1P_2P' && p.team === 'away');
    const profile = isHumanTeam
      ? DIFFICULTY_PROFILES.MEDIO
      : DIFFICULTY_PROFILES[this.config.difficulty];

    if (p.stunTimer > 0) {
      p.vx *= 0.85;
      p.vy *= 0.85;
      this.integratePlayerPosition(p, dt);
      return;
    }

    if (p.tackleTimer > 0) {
      this.updateSlideTackle(p, dt);
      return;
    }

    const attackDir = this.getAttackDir(p.team);
    const oppGoalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;
    const hasBall = this.ball.ownerId === p.id;
    const teamHasBall = this.ball.ownerId !== null && this.ball.ownerId.startsWith(p.team);

    const baseSpeed = (180 + (p.speed - 70) * 2.2) * profile.aiSpeedMult;

    if (hasBall) {
      p.aiDecisionTimer -= dt;
      const distToGoal = Math.hypot(oppGoalX - p.x, FIELD_CENTER_Y - p.y);

      let moveX = (oppGoalX - p.x) / (distToGoal || 1);
      let moveY = (FIELD_CENTER_Y - p.y) / (distToGoal || 1);

      let nearestOppDist = Infinity;
      for (const opp of this.players) {
        if (opp.team === p.team) continue;
        const d = Math.hypot(opp.x - p.x, opp.y - p.y);
        if (d < nearestOppDist) nearestOppDist = d;
        if (d < 96 && d > 1) {
          moveX += ((p.x - opp.x) / d) * 0.65;
          moveY += ((p.y - opp.y) / d) * 0.65;
        }
      }

      const mLen = Math.hypot(moveX, moveY) || 1;
      moveX /= mLen;
      moveY /= mLen;

      p.vx += (moveX * baseSpeed * 0.92 - p.vx) * Math.min(1, dt * 10);
      p.vy += (moveY * baseSpeed * 0.92 - p.vy) * Math.min(1, dt * 10);
      p.facingX = moveX;
      p.facingY = moveY;
      this.integratePlayerPosition(p, dt);

      if (p.aiDecisionTimer <= 0) {
        p.aiDecisionTimer = profile.aiReaction + Math.random() * 0.16;

        // 1. Em zona de finalização limpa -> chuta!
        if (distToGoal < 355 && Math.abs(p.y - FIELD_CENTER_Y) < 255) {
          const power = 0.54 + Math.random() * 0.34;
          const aimY = (Math.random() - 0.5) * 1.5;
          this.performShot(p, power, attackDir, aimY);
          return;
        }

        // 2. Pressionado ou vendo companheiro melhor posicionado -> passa!
        if (nearestOppDist < 88 || Math.random() < profile.aiPassVision * 0.48) {
          const forwardMate = this.players.find(
            (m) =>
              m.team === p.team &&
              m.id !== p.id &&
              m.role !== 'GK' &&
              (m.x - p.x) * attackDir > 75 &&
              Math.hypot(m.x - p.x, m.y - p.y) < 520
          );
          if (forwardMate) {
            const dx = forwardMate.x - p.x;
            const dy = forwardMate.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            const useLob = d > 360 && Math.random() < 0.35;
            this.performPass(p, dx / d, dy / d, useLob);
            return;
          }
        }
      }
      return;
    }

    // SEM BOLA: posicionamento tático + recepção automática de passe/cruzamento + respeito total ao goleiro!
    const ballOwner = this.ball.ownerId
      ? this.players.find((pl) => pl.id === this.ball.ownerId)
      : null;
    const anyGkHasBall = Boolean(ballOwner && ballOwner.role === 'GK');
    const oppGkHasBall = Boolean(anyGkHasBall && ballOwner && ballOwner.team !== p.team);
    const isPassTarget = !this.ball.ownerId && this.ball.passTargetId === p.id;
    const isFriendlyLoosePass =
      !this.ball.ownerId && !this.ball.shotInFlight && this.ball.lastTouchTeam === p.team;

    // Atacante/companheiro sobe de BICICLETA ou cabeça quando recebe cruzamento na área!
    if (
      !this.ball.ownerId &&
      this.ball.isCrossBall &&
      this.ball.lastTouchTeam === p.team &&
      this.ball.z >= 6 &&
      this.ball.z <= 86
    ) {
      const distBall = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      if (p.queuedBicycle && distBall < 118) {
        p.queuedBicycle = false;
        this.performBicycleKick(p, attackDir, (Math.random() - 0.5) * 0.7);
        return;
      }
      if (!isHumanTeam && distBall < 52 && this.ball.z >= 10 && this.ball.z <= 66) {
        if (Math.random() < 0.42) {
          this.performBicycleKick(p, attackDir, (Math.random() - 0.5) * 0.8);
        } else {
          this.performAerialHeader(p, attackDir, (Math.random() - 0.5) * 0.9, true);
        }
        return;
      }
    }

    const teamMates = this.players.filter((m) => m.team === p.team && m.role !== 'GK');
    teamMates.sort(
      (a, b) =>
        Math.hypot(a.x - this.ball.x, a.y - this.ball.y) -
        Math.hypot(b.x - this.ball.x, b.y - this.ball.y)
    );
    const ownGoalX = attackDir === 1 ? FIELD_LEFT : FIELD_RIGHT;
    const dangerNearOwnBox = Math.abs(this.ball.x - ownGoalX) < 500;
    const isBallLoose = !this.ball.ownerId;
    const distSelfToBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
    // Companheiros próximos ao passe ou cruzamento correm automaticamente para dominar!
    const isFriendlyPassReceiver =
      isFriendlyLoosePass &&
      (isPassTarget || teamMates[0]?.id === p.id || (teamMates[1]?.id === p.id && distSelfToBall < 320));
    // Quando a bola está SOZINHA em campo (solta ou rebote), o jogador mais próximo de CADA time corre imediatamente para dominar!
    const isLooseBallHunter =
      isBallLoose &&
      !isPassTarget &&
      (isFriendlyPassReceiver ||
        teamMates[0]?.id === p.id ||
        (teamMates[1]?.id === p.id && distSelfToBall < 275));

    const isClosestChaser =
      !teamHasBall &&
      !anyGkHasBall &&
      (isLooseBallHunter ||
        ((teamMates[0]?.id === p.id || (dangerNearOwnBox && teamMates[1]?.id === p.id && isDefenderRole(p.role))) &&
          !(isHumanTeam && !dangerNearOwnBox && !isBallLoose && distSelfToBall > 220)));

    let targetX = p.homeX;
    let targetY = p.homeY;

    if (oppGkHasBall && ballOwner) {
      // QUANDO A BOLA JÁ ESTÁ COM O GOLEIRO, NINGUÉM VEM PRA CIMA: adversários recuam para fora da área!
      const awayDir = ballOwner.x < FIELD_CENTER_X ? 1 : -1;
      const safeMinX =
        awayDir === 1 ? FIELD_LEFT + PENALTY_W + 95 : FIELD_RIGHT - PENALTY_W - 95;
      targetX =
        awayDir === 1
          ? Math.max(safeMinX, p.homeX + 80)
          : Math.min(safeMinX, p.homeX - 80);
      targetY = p.homeY;
    } else if (isPassTarget || isFriendlyPassReceiver) {
      // Receptor corre automaticamente para o ponto exato de encontro do passe ou cruzamento para dominar!
      if (this.ball.isCrossBall) {
        targetX = this.ball.passTargetX;
        targetY = this.ball.passTargetY;
      } else {
        const ballSpd = Math.hypot(this.ball.vx, this.ball.vy);
        const leadT = ballSpd > 85 ? Math.min(0.32, distSelfToBall / 620) : 0;
        targetX = Math.max(
          FIELD_LEFT + 16,
          Math.min(FIELD_RIGHT - 16, this.ball.x + this.ball.vx * leadT)
        );
        targetY = Math.max(
          FIELD_TOP + 16,
          Math.min(FIELD_BOTTOM - 16, this.ball.y + this.ball.vy * leadT)
        );
      }
    } else if (isFriendlyLoosePass && this.ball.isCrossBall && (p.role === 'FWD' || p.role === 'MID')) {
      // Durante um cruzamento do time, atacantes e meias infiltram automaticamente na grande área!
      const boxTargetX = oppGoalX - attackDir * (p.role === 'FWD' ? 165 : 245);
      const laneOffsetY = (p.homeY - FIELD_CENTER_Y) * 0.55;
      targetX = boxTargetX;
      targetY = Math.max(FIELD_TOP + 110, Math.min(FIELD_BOTTOM - 110, FIELD_CENTER_Y + laneOffsetY));
    } else if (isLooseBallHunter) {
      // Bola solta / rebote em campo: corre direto para interceptar e dominar a bola!
      const leadT = Math.min(0.26, distSelfToBall / 700);
      targetX = Math.max(FIELD_LEFT + 18, Math.min(FIELD_RIGHT - 18, this.ball.x + this.ball.vx * leadT));
      targetY = Math.max(FIELD_TOP + 18, Math.min(FIELD_BOTTOM - 18, this.ball.y + this.ball.vy * leadT));
    } else if (isClosestChaser) {
      // Zagueiros e laterais fecham firmemente a linha de chute entre a bola e o próprio gol!
      const closeGoalBias = dangerNearOwnBox && isDefenderRole(p.role) ? 0.22 : 0.06;
      targetX = this.ball.x * (1 - closeGoalBias) + ownGoalX * closeGoalBias;
      targetY = this.ball.y * (1 - closeGoalBias) + FIELD_CENTER_Y * closeGoalBias;

      p.aiDecisionTimer -= dt;
      const distBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      const canAiDefend = !isHumanTeam || (dangerNearOwnBox && distBall < 54);
      if (
        canAiDefend &&
        p.aiDecisionTimer <= 0 &&
        distBall < 76 &&
        distBall > 18 &&
        this.ball.ownerId !== null &&
        !anyGkHasBall &&
        p.tackleCooldown <= 0
      ) {
        p.aiDecisionTimer = 0.42;
        const boxBoost = dangerNearOwnBox ? 0.14 : 0;
        if (Math.random() < profile.aiTackleRate + boxBoost) {
          const dx = this.ball.x - p.x;
          const dy = this.ball.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.facingX = dx / d;
          p.facingY = dy / d;
          if (distBall < 48 || isHumanTeam || Math.random() < 0.6) {
            this.performStandingSteal(p);
          } else {
            this.startSlideTackle(p);
          }
          return;
        }
      }
    } else {
      // Movimentação tática por função: ZAG protege o miolo, LAT dá amplitude e ultrapassa pelas pontas, MEI organiza, ATA infiltra!
      const roleShiftFactor =
        p.role === 'ZAG' || p.role === 'DEF'
          ? 0.44
          : p.role === 'LAT'
            ? 0.60
            : p.role === 'MID'
              ? 0.68
              : 0.80;
      const ballShiftX = (this.ball.x - FIELD_CENTER_X) * roleShiftFactor;
      const ballShiftY =
        (this.ball.y - FIELD_CENTER_Y) * (p.role === 'LAT' ? 0.22 : p.role === 'ZAG' ? 0.38 : 0.48);
      const attackPush = teamHasBall
        ? attackDir * (p.role === 'FWD' ? 275 : p.role === 'LAT' ? 230 : p.role === 'MID' ? 165 : 70)
        : -attackDir * (p.role === 'ZAG' && dangerNearOwnBox ? 145 : p.role === 'LAT' ? 110 : 85);
      // Laterais abrem ainda mais próximo à linha lateral quando o time tem a bola
      const wingSpreadY =
        p.role === 'LAT' && teamHasBall ? (p.homeY < FIELD_CENTER_Y ? -75 : 75) : 0;
      targetX = Math.max(FIELD_LEFT + 85, Math.min(FIELD_RIGHT - 85, p.homeX + ballShiftX + attackPush));
      targetY = Math.max(FIELD_TOP + 48, Math.min(FIELD_BOTTOM - 48, p.homeY + ballShiftY + wingSpreadY));
    }

    const dx = targetX - p.x;
    const dy = targetY - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 4) {
      const sp =
        isPassTarget || isFriendlyPassReceiver
          ? baseSpeed * (this.ball.isCrossBall ? 1.28 : 1.24)
          : isLooseBallHunter
            ? baseSpeed * 1.16
            : isClosestChaser
              ? baseSpeed * 1.08
              : Math.min(baseSpeed * 0.92, dist * 3.8);
      const accelRate = isPassTarget || isFriendlyPassReceiver ? 16 : 11;
      p.vx += ((dx / dist) * sp - p.vx) * Math.min(1, dt * accelRate);
      p.vy += ((dy / dist) * sp - p.vy) * Math.min(1, dt * accelRate);
      p.facingX = dx / dist;
      p.facingY = dy / dist;
    } else {
      p.vx *= 0.82;
      p.vy *= 0.82;
      const bdx = this.ball.x - p.x;
      const bdy = this.ball.y - p.y;
      const bd = Math.hypot(bdx, bdy) || 1;
      p.facingX = bdx / bd;
      p.facingY = bdy / bd;
    }

    p.stamina = Math.min(100, p.stamina + dt * 10);
    this.integratePlayerPosition(p, dt);
    if (!oppGkHasBall) {
      this.tryClaimLooseBall(p);
    }
  }

  private resolvePlayerSeparation(): void {
    const minDist = 20;
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i];
        const b = this.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01 && dist < minDist) {
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  // --- FÍSICA 3D DA BOLA (EIXO Z, TRAVES, REDES E REGRAS DE SAÍDA) ---
  private updateBallPhysics(dt: number, inGoalCelebration: boolean): void {
    const b = this.ball;

    if (b.ownerId) {
      const owner = this.players.find((p) => p.id === b.ownerId);
      if (owner) {
        const dribbleOffset = owner.role === 'GK' ? 12 : 14 + Math.sin(this.animTime * 16) * 2;
        b.x = owner.x + owner.facingX * dribbleOffset;
        b.y = owner.y + owner.facingY * dribbleOffset;
        b.z = owner.role === 'GK' ? 12 : 0;
        b.vx = owner.vx;
        b.vy = owner.vy;
        b.vz = 0;
        b.rotation += Math.hypot(owner.vx, owner.vy) * dt * 0.12;
        return;
      }
      b.ownerId = null;
    }

    // Guarda posição anterior para detecção contínua (anti-tunneling) do goleiro!
    const prevX = b.x;
    const prevY = b.y;
    const prevZ = b.z;

    // Gravidade e movimento 3D
    const GRAVITY = 560;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.vz -= GRAVITY * dt;

    // Efeito Magnus realista (curva perpendicular à trajetória da bola em cruzamentos e chutes colocados!)
    if (b.z > 4 && Math.abs(b.spin) > 0.1) {
      const horizSpeed = Math.hypot(b.vx, b.vy);
      if (horizSpeed > 60) {
        const perpX = -b.vy / horizSpeed;
        const perpY = b.vx / horizSpeed;
        const curveAccel = b.spin * 26;
        b.vx += perpX * curveAccel * dt;
        b.vy += perpY * curveAccel * dt;
      }
      b.spin *= Math.pow(0.72, dt);
    }

    // Correção magnética natural em passes rasteiros para a bola chegar quase perfeita nos pés do companheiro!
    if (b.passTargetId && !b.isCrossBall && !b.shotInFlight && b.z < 18) {
      const target = this.players.find((pl) => pl.id === b.passTargetId);
      if (target) {
        const tdx = target.x - b.x;
        const tdy = target.y - b.y;
        const tDist = Math.hypot(tdx, tdy);
        const speed = Math.hypot(b.vx, b.vy);
        if (tDist > 12 && tDist < 480 && speed > 110) {
          const dot = (tdx / tDist) * (b.vx / speed) + (tdy / tDist) * (b.vy / speed);
          if (dot > 0.5) {
            const desiredVx = (tdx / tDist) * speed;
            const desiredVy = (tdy / tDist) * speed;
            const blend = Math.min(1, dt * 4.2);
            b.vx += (desiredVx - b.vx) * blend;
            b.vy += (desiredVy - b.vy) * blend;
          } else {
            b.passTargetId = null;
          }
        }
      }
    }

    // Ajuste suave na descida do cruzamento para a bola cair redondinha no atacante na área!
    if (b.isCrossBall && !b.shotInFlight && b.z > 8 && b.vz < 55) {
      const target = b.passTargetId ? this.players.find((pl) => pl.id === b.passTargetId) : null;
      const aimTx = target ? target.x * 0.65 + b.passTargetX * 0.35 : b.passTargetX;
      const aimTy = target ? target.y * 0.65 + b.passTargetY * 0.35 : b.passTargetY;
      const tdx = aimTx - b.x;
      const tdy = aimTy - b.y;
      const tDist = Math.hypot(tdx, tdy);
      const speed = Math.hypot(b.vx, b.vy);
      if (tDist > 14 && tDist < 360 && speed > 90) {
        const dot = (tdx / tDist) * (b.vx / speed) + (tdy / tDist) * (b.vy / speed);
        if (dot > 0.35) {
          const desiredVx = (tdx / tDist) * speed;
          const desiredVy = (tdy / tDist) * speed;
          const blend = Math.min(1, dt * 2.2);
          b.vx += (desiredVx - b.vx) * blend;
          b.vy += (desiredVy - b.vy) * blend;
        }
      }
    }

    // Quique realista no gramado com física influenciada pelo clima (Sol / Chuva / Neve)
    if (b.z <= 0) {
      b.z = 0;
      if (Math.abs(b.vz) > 44) {
        const bounceFactor =
          this.weather === 'CHUVA' ? 0.44 : this.weather === 'NEVE' ? 0.38 : 0.52;
        const skidFactor = this.weather === 'CHUVA' ? 0.96 : this.weather === 'NEVE' ? 0.84 : 0.90;
        b.vz = -b.vz * bounceFactor;
        b.vx *= skidFactor;
        b.vy *= skidFactor;
        b.spin *= 0.6;
      } else {
        b.vz = 0;
        b.isCrossBall = false;
        b.spin *= Math.pow(0.25, dt);
        const groundDragBase =
          this.weather === 'CHUVA' ? 0.44 : this.weather === 'NEVE' ? 0.22 : 0.31;
        const friction = Math.pow(groundDragBase, dt);
        b.vx *= friction;
        b.vy *= friction;
        if (Math.hypot(b.vx, b.vy) < 40) {
          b.passTargetId = null;
        }
      }
    } else {
      const airDrag = Math.pow(0.88, dt);
      b.vx *= airDrag;
      b.vy *= airDrag;
    }

    b.rotation += Math.hypot(b.vx, b.vy) * dt * 0.08;

    // Colisão com as traves (postes verticais e travessão!)
    this.checkGoalPostCollisions();

    // Durante a comemoração, prende a bola dentro da rede balançando
    if (inGoalCelebration) {
      if (b.x < FIELD_LEFT - GOAL_DEPTH + 8) {
        b.x = FIELD_LEFT - GOAL_DEPTH + 8;
        b.vx = Math.abs(b.vx) * 0.2;
      }
      if (b.x > FIELD_RIGHT + GOAL_DEPTH - 8) {
        b.x = FIELD_RIGHT + GOAL_DEPTH - 8;
        b.vx = -Math.abs(b.vx) * 0.2;
      }
      if (b.y < GOAL_TOP + 6) {
        b.y = GOAL_TOP + 6;
        b.vy = Math.abs(b.vy) * 0.3;
      }
      if (b.y > GOAL_BOTTOM - 6) {
        b.y = GOAL_BOTTOM - 6;
        b.vy = -Math.abs(b.vy) * 0.3;
      }
      return;
    }

    // Checagem contínua de defesa do goleiro ANTES de testar linha do gol (zero bola atravessando a luva!)
    if (!inGoalCelebration && this.checkGoalkeeperSweptIntercept(prevX, prevY, prevZ)) {
      return;
    }

    // --- CHECAGEM DE GOL E SAÍDAS DE BOLA ---
    const inGoalMouthY = b.y > GOAL_TOP + 5 && b.y < GOAL_BOTTOM - 5;

    // Linha de fundo esquerda
    if (b.x < FIELD_LEFT - 4) {
      if (inGoalMouthY && b.z <= CROSSBAR_Z) {
        // GOL NO GOL ESQUERDO!
        const scoringTeam: 'home' | 'away' = this.homeAttackDir === -1 ? 'home' : 'away';
        this.registerGoal(scoringTeam, 'left');
        return;
      }
      // Saiu pela linha de fundo esquerda -> Tiro de Meta ou Escanteio
      const defendingTeam: 'home' | 'away' = this.homeAttackDir === 1 ? 'home' : 'away';
      this.handleEndlineOut('left', defendingTeam);
      return;
    }

    // Linha de fundo direita
    if (b.x > FIELD_RIGHT + 4) {
      if (inGoalMouthY && b.z <= CROSSBAR_Z) {
        // GOL NO GOL DIREITO!
        const scoringTeam: 'home' | 'away' = this.homeAttackDir === 1 ? 'home' : 'away';
        this.registerGoal(scoringTeam, 'right');
        return;
      }
      const defendingTeam: 'home' | 'away' = this.homeAttackDir === -1 ? 'home' : 'away';
      this.handleEndlineOut('right', defendingTeam);
      return;
    }

    // Linhas laterais (Topo / Base) -> LATERAL
    if (b.y < FIELD_TOP - 4 || b.y > FIELD_BOTTOM + 4) {
      const throwTeam: 'home' | 'away' = b.lastTouchTeam === 'home' ? 'away' : 'home';
      this.phase = 'THROW_IN';
      this.setPieceTeam = throwTeam;
      this.setPieceSpotX = Math.max(FIELD_LEFT + 35, Math.min(FIELD_RIGHT - 35, b.x));
      this.setPieceSpotY = b.y < FIELD_CENTER_Y ? FIELD_TOP - 2 : FIELD_BOTTOM + 2;
      this.setPieceWaitTimer = 0.75;
      b.x = this.setPieceSpotX;
      b.y = this.setPieceSpotY;
      b.z = 10;
      b.vx = 0;
      b.vy = 0;
      b.vz = 0;
      this.positionForSetPiece();
      this.referee.whistleTimer = 0.7;
      this.referee.signalTimer = 1.4;
      this.referee.signalDirX = this.getAttackDir(throwTeam);
      this.raiseNearestLinesmanFlag(this.setPieceSpotX, this.setPieceSpotY, this.getAttackDir(throwTeam), 1.6);
      this.showCallout(
        'LATERAL!',
        throwTeam === 'home' ? this.homeClub.shortName : this.awayClub.shortName,
        'setpiece',
        1.4
      );
      retroAudio.playWhistle('short');
      const teamName = throwTeam === 'home' ? this.homeClub.name : this.awayClub.name;
      const throwTaker = this.players.find((pl) => pl.id === this.setPieceTakerId);
      this.broadcast(
        throwTaker
          ? `Bola pela linha lateral! Arremesso para o ${teamName}, ${throwTaker.name} já vai para a cobrança.`
          : `Bola pela linha lateral! Arremesso para o ${teamName}.`,
        'normal',
        'calm',
        2.5
      );
    }
  }

  private checkGoalPostCollisions(): void {
    const b = this.ball;
    const posts = [
      { x: FIELD_LEFT, y: GOAL_TOP },
      { x: FIELD_LEFT, y: GOAL_BOTTOM },
      { x: FIELD_RIGHT, y: GOAL_TOP },
      { x: FIELD_RIGHT, y: GOAL_BOTTOM },
    ];

    for (const post of posts) {
      if (b.z > CROSSBAR_Z + 8) continue;
      const dx = b.x - post.x;
      const dy = b.y - post.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12 && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = post.x + nx * 13;
        b.y = post.y + ny * 13;
        const dot = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * dot * nx) * 0.78;
        b.vy = (b.vy - 2 * dot * ny) * 0.78;
        this.screenShake = 0.45;
        retroAudio.playPostHit();
        retroAudio.playCrowdOoh();
        const shooter = b.lastTouchPlayerName;
        this.showCallout('NA TRAVE!!', shooter ? `Quase gol de ${shooter}!` : 'Quase gol!', 'info', 1.2);
        const postLead = shooter
          ? `NA TRAAAAVE!! Que bomba de ${shooter}!! Explodiu no ferro! Haja coração!`
          : 'NA TRAAAAVE!! Haja coração, amigos! Explodiu no ferro!';
        const postAnalyst = this.nextCommentator();
        const postReply =
          postAnalyst === 'neto'
            ? `Pão! Olha essa bola na trave, Galvão! Se entra era o gol mais bonito do campeonato!`
            : postAnalyst === 'ronaldo'
              ? `Por um triz, Galvão! Que batida colocada, a trave salvou o goleiro!`
              : `Caramba, Galvão! Por centímetros não foi um golaço! A trave salvou o goleiro!`;
        this.broadcastDialogue(postLead, postReply, postAnalyst, 'high', 'excited', 4.8);
      }
    }

    const nearLeftLine = Math.abs(b.x - FIELD_LEFT) < 10;
    const nearRightLine = Math.abs(b.x - FIELD_RIGHT) < 10;
    if ((nearLeftLine || nearRightLine) && b.y > GOAL_TOP && b.y < GOAL_BOTTOM) {
      if (Math.abs(b.z - CROSSBAR_Z) < 8) {
        b.vx = -b.vx * 0.65;
        b.vz = Math.abs(b.vz) * 0.55 + 60;
        this.screenShake = 0.5;
        retroAudio.playPostHit();
        retroAudio.playCrowdOoh();
        const shooter = b.lastTouchPlayerName;
        this.showCallout('NO TRAVESSÃO!!', shooter ? `Pancada de ${shooter}!` : 'Bateu no ferro!', 'info', 1.3);
        const barLead = shooter
          ? `NO TRAVESSÃO!! Que pancada impressionante de ${shooter}!! Aguenta coração!`
          : 'NO TRAVESSÃO!! Aguenta coração, amigos! Que pancada impressionante!';
        const barAnalyst = this.nextCommentator();
        const barReply =
          barAnalyst === 'neto'
            ? `Ô Galvão, quase quebrou o travessão!! Baita paulada, você tá de brincadeira?!`
            : barAnalyst === 'casagrande'
              ? `Que bomba no travessão, Galvão! O goleiro só ficou olhando a bola explodir no ferro!`
              : `Que paulada no travessão, Galvão! Se entra essa bola, era gol de placa!`;
        this.broadcastDialogue(barLead, barReply, barAnalyst, 'high', 'excited', 4.8);
      }
    }
  }

  private registerGoal(scoringTeam: 'home' | 'away', goalSide: 'left' | 'right'): void {
    const prevHome = this.homeScore;
    const prevAway = this.awayScore;
    if (scoringTeam === 'home') this.homeScore++;
    else this.awayScore++;

    const scoringClub = scoringTeam === 'home' ? this.homeClub : this.awayClub;
    const isBicycleGoal = Boolean(this.ball.isBicycleShot);
    this.ball.isBicycleShot = false;

    let scorerName = this.ball.lastTouchPlayerName;
    let scorerNumber = this.ball.lastTouchPlayerNumber;
    const isOwnGoal = this.ball.lastTouchTeam !== scoringTeam && Boolean(scorerName);
    if (this.ball.lastTouchTeam !== scoringTeam || !scorerName) {
      const striker = scoringClub.squad[11] ?? scoringClub.squad[scoringClub.squad.length - 1];
      scorerName = this.ball.lastTouchPlayerName
        ? `${this.ball.lastTouchPlayerName} (GC)`
        : striker.name;
      scorerNumber = striker.number;
    }

    const cleanScorerName = scorerName.replace(' (GC)', '');
    const hasAssist =
      !isOwnGoal &&
      this.lastPasserTeam === scoringTeam &&
      Boolean(this.lastPasserName) &&
      this.lastPasserName !== cleanScorerName &&
      this.animTime - this.lastPasserTime < 6.5;
    const assistText = hasAssist ? ` Assistência primorosa de ${this.lastPasserName}!` : '';
    this.lastPasserName = null;
    this.lastPasserTeam = null;

    const minute = this.getMatchMinute();
    this.stats.goals.push({
      team: scoringTeam,
      scorerName: isBicycleGoal && !isOwnGoal ? `${scorerName} (Bicicleta)` : scorerName,
      scorerNumber,
      minute,
    });

    this.ball.lastTouchTeam = scoringTeam;
    this.ball.shotInFlight = false;
    this.phase = 'GOAL_CELEBRATION';
    this.phaseTimer = 2.15; // Celebração com show de fogos de artifício antes do Replay!
    this.replayGoalRecordTimer = 0.65;
    this.replayPendingConcedingTeam = scoringTeam === 'home' ? 'away' : 'home';
    this.replayMeta = {
      scorerName: cleanScorerName,
      scorerNumber,
      teamName: scoringClub.name,
      minute,
      isBicycleGoal,
    };
    this.screenShake = isBicycleGoal ? 1.15 : 0.85;
    this.crowdExcitement = 1;
    this.referee.whistleTimer = 1.4;
    this.referee.signalTimer = 2.0;
    this.referee.signalDirX = goalSide === 'right' ? -1 : 1;
    this.raiseNearestLinesmanFlag(this.ball.x, this.ball.y, this.referee.signalDirX, 2.2);

    if (isBicycleGoal && !isOwnGoal) {
      this.showCallout('GOLAÇO DE BICICLETA!!', `${cleanScorerName} #${scorerNumber} · Puskás!`, 'goal', 2.1);
    }

    this.netRipples.push({
      side: goalSide,
      impactY: this.ball.y,
      amplitude: isBicycleGoal ? 20 : 16,
      phase: 0,
    });

    // Solta fogos de artifício coloridos no estádio ao fazer o gol!
    this.triggerGoalFireworks(scoringClub);

    this.goalBanner = {
      scorerName: isBicycleGoal && !isOwnGoal ? `${scorerName} ★ BICICLETA` : scorerName,
      scorerNumber,
      teamName: scoringClub.name,
      teamColor: scoringClub.homeKit.primary,
    };

    // Torcida explode cantando o hino do clube + provocando a torcida rival!
    this.spawnCrowdAnthem(scoringTeam);
    this.spawnCrowdProvocation(scoringTeam, false);

    const scoreSummary = `${this.homeClub.name} ${this.homeScore}, ${this.awayClub.name} ${this.awayScore}!`;
    const isEqualizer = this.homeScore === this.awayScore;
    const isComeback =
      (scoringTeam === 'home' && prevHome === prevAway && prevHome > 0) ||
      (scoringTeam === 'away' && prevAway === prevHome && prevAway > 0);
    const contextTag = isEqualizer
      ? 'Tudo igual!'
      : isComeback
        ? 'Virada!'
        : `Aos ${minute} minutos!`;

    retroAudio.playGoalCheer();
    this.pendingCommentator = null;
    this.broadcast(
      isOwnGoal
        ? `GOOOOL DO ${scoringClub.name.toUpperCase()}! Gol contra de ${cleanScorerName}! ${scoreSummary}`
        : isBicycleGoal
          ? pick([
              `GOOOOOOOL DE BICICLETAAA!! É DO ${scoringClub.name.toUpperCase()}!! ${cleanScorerName}, camisa ${scorerNumber}, uma pintura acrobática no ar!${assistText} ${scoreSummary}`,
              `QUE GOLAÇO DE BICICLETA!! GOOOOOOOL DE ${cleanScorerName} PRO ${scoringClub.name.toUpperCase()}!! Gol de placa no cruzamento! Haja coração! ${scoreSummary}`,
            ])
          : pick([
              `GOOOOOOOL! É DO ${scoringClub.name.toUpperCase()}!! ${cleanScorerName}, camisa ${scorerNumber}!${assistText} Que beleza! ${scoreSummary}`,
              `OLHA O GOL, OLHA O GOL, GOOOOOOOL DO ${scoringClub.name.toUpperCase()}! ${cleanScorerName}! ${contextTag}${assistText} ${scoreSummary}`,
              `TÁ LÁ DENTRO!! GOOOOOOOL DE ${cleanScorerName} PRO ${scoringClub.name.toUpperCase()}!! Haja coração! ${scoreSummary}`,
            ]),
      'high',
      'goal',
      4.2,
      'galvao'
    );
  }

  private handleEndlineOut(side: 'left' | 'right', defendingTeam: 'home' | 'away'): void {
    const attackingTeam: 'home' | 'away' = defendingTeam === 'home' ? 'away' : 'home';
    const b = this.ball;

    if (b.lastTouchTeam === defendingTeam) {
      // ESCANTEIO!
      this.phase = 'CORNER';
      this.setPieceTeam = attackingTeam;
      this.setPieceSpotX = side === 'left' ? FIELD_LEFT + 6 : FIELD_RIGHT - 6;
      this.setPieceSpotY = b.y < FIELD_CENTER_Y ? FIELD_TOP + 6 : FIELD_BOTTOM - 6;
      this.setPieceWaitTimer = 0.85;
      b.x = this.setPieceSpotX;
      b.y = this.setPieceSpotY;
      b.z = 0;
      b.vx = 0;
      b.vy = 0;
      b.vz = 0;
      this.positionForSetPiece();
      this.referee.whistleTimer = 0.7;
      this.referee.signalTimer = 1.5;
      this.referee.signalDirX = side === 'left' ? -1 : 1;
      this.raiseNearestLinesmanFlag(this.setPieceSpotX, this.setPieceSpotY, side === 'left' ? -1 : 1, 1.8);
      this.showCallout(
        'ESCANTEIO!',
        attackingTeam === 'home' ? this.homeClub.shortName : this.awayClub.shortName,
        'setpiece',
        1.5
      );
      retroAudio.playWhistle('short');
      const attClub = attackingTeam === 'home' ? this.homeClub.name : this.awayClub.name;
      const cornerTaker = this.players.find((pl) => pl.id === this.setPieceTakerId);
      this.broadcast(
        cornerTaker
          ? `O bandeirinha levanta o pano! Escanteio perigoso para o ${attClub}, lá vai ${cornerTaker.name} para a cobrança na área!`
          : `O bandeirinha levanta o pano! Escanteio perigoso para o ${attClub}!`,
        'normal',
        'excited',
        2.8
      );
    } else {
      // TIRO DE META!
      this.phase = 'GOAL_KICK';
      this.setPieceTeam = defendingTeam;
      this.setPieceSpotX = side === 'left' ? FIELD_LEFT + 64 : FIELD_RIGHT - 64;
      this.setPieceSpotY = b.y < FIELD_CENTER_Y ? FIELD_CENTER_Y - 54 : FIELD_CENTER_Y + 54;
      this.setPieceWaitTimer = 0.85;
      b.x = this.setPieceSpotX;
      b.y = this.setPieceSpotY;
      b.z = 0;
      b.vx = 0;
      b.vy = 0;
      b.vz = 0;
      this.positionForSetPiece();
      this.referee.whistleTimer = 0.6;
      this.referee.signalTimer = 1.4;
      this.referee.signalDirX = side === 'left' ? 1 : -1;
      this.raiseNearestLinesmanFlag(this.setPieceSpotX, this.setPieceSpotY, side === 'left' ? 1 : -1, 1.5);
      this.showCallout(
        'TIRO DE META!',
        defendingTeam === 'home' ? this.homeClub.shortName : this.awayClub.shortName,
        'setpiece',
        1.5
      );
      retroAudio.playWhistle('short');
      const defClub = defendingTeam === 'home' ? this.homeClub.name : this.awayClub.name;
      const gkTaker = this.players.find((pl) => pl.id === this.setPieceTakerId);
      this.broadcast(
        gkTaker
          ? `Tiro de meta para o goleiro ${gkTaker.name}, do ${defClub}, repor a bola em jogo.`
          : `Tiro de meta para o goleiro do ${defClub} repor a bola em jogo.`,
        'normal',
        'calm',
        2.5
      );
    }
  }

  private positionForSetPiece(): void {
    const team = this.setPieceTeam;
    const attackDir = this.getAttackDir(team);

    let taker: FieldPlayer;
    if (this.phase === 'GOAL_KICK') {
      taker = this.players.find((p) => p.team === team && p.role === 'GK')!;
    } else {
      const outfield = this.players
        .filter((p) => p.team === team && p.role !== 'GK')
        .sort(
          (a, b) =>
            Math.hypot(a.x - this.setPieceSpotX, a.y - this.setPieceSpotY) -
            Math.hypot(b.x - this.setPieceSpotX, b.y - this.setPieceSpotY)
        );
      taker = outfield[0];
    }

    this.setPieceTakerId = taker.id;
    taker.x = this.setPieceSpotX - attackDir * 10;
    taker.y = this.setPieceSpotY;
    taker.vx = 0;
    taker.vy = 0;
    taker.facingX = attackDir;
    taker.facingY = this.setPieceSpotY < FIELD_CENTER_Y ? 0.5 : -0.5;
    taker.isCharging = false;
    taker.chargePower = 0;

    if (team === 'home' && taker.role !== 'GK') this.p1SelectedId = taker.id;
    if (this.config.controlMode === '1P_2P' && team === 'away' && taker.role !== 'GK') {
      this.p2SelectedId = taker.id;
    }

    // Posiciona companheiros e adversários de forma realista (área no escanteio, barreira na falta)
    let wallCount = 0;
    for (const p of this.players) {
      if (p.id === taker.id) continue;
      p.vx = 0;
      p.vy = 0;
      p.tackleTimer = 0;
      p.stunTimer = 0;

      if (this.phase === 'CORNER' && p.role !== 'GK') {
        const boxX = attackDir === 1 ? FIELD_RIGHT - 135 : FIELD_LEFT + 135;
        if (p.team === team) {
          p.x = boxX + (Math.random() - 0.5) * 120;
          p.y = FIELD_CENTER_Y + (p.index - 6) * 34;
        } else {
          p.x = boxX + attackDir * 28 + (Math.random() - 0.5) * 75;
          p.y = FIELD_CENTER_Y + (p.index - 6) * 32;
        }
      } else if (this.phase === 'GOAL_KICK' && p.role !== 'GK') {
        const homePos = this.computeHomePosition(p.team, p.index);
        p.x = homePos.x;
        p.y = homePos.y;
      } else if (this.phase === 'FREE_KICK' && p.team !== team && p.role !== 'GK') {
        const d = Math.hypot(p.x - this.setPieceSpotX, p.y - this.setPieceSpotY);
        if (wallCount < 2) {
          // Barreira defensiva entre a bola e o gol
          const goalX = attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT;
          const dx = goalX - this.setPieceSpotX;
          const dy = FIELD_CENTER_Y - this.setPieceSpotY;
          const dist = Math.hypot(dx, dy) || 1;
          p.x = this.setPieceSpotX + (dx / dist) * 84;
          p.y = this.setPieceSpotY + (dy / dist) * 84 + (wallCount === 0 ? -13 : 13);
          wallCount++;
        } else if (d < 90) {
          p.x += attackDir * 90;
        }
      } else if (p.team !== team) {
        const d = Math.hypot(p.x - this.setPieceSpotX, p.y - this.setPieceSpotY);
        if (d < 85) {
          p.x = this.setPieceSpotX + (p.x >= this.setPieceSpotX ? 90 : -90);
        }
      }
    }
  }

  private updateSetPiece(dt: number, p1Input: PlayerInputState, p2Input: PlayerInputState): void {
    this.setPieceWaitTimer -= dt;
    const taker = this.players.find((p) => p.id === this.setPieceTakerId);
    if (!taker) {
      this.phase = 'PLAYING';
      return;
    }

    const isHuman =
      this.setPieceTeam === 'home' ||
      (this.config.controlMode === '1P_2P' && this.setPieceTeam === 'away');
    const input = this.setPieceTeam === 'home' ? p1Input : p2Input;
    const attackDir = this.getAttackDir(this.setPieceTeam);

    // Permite girar a mira na bola parada
    if (isHuman && (Math.abs(input.dx) > 0.1 || Math.abs(input.dy) > 0.1)) {
      const len = Math.hypot(input.dx, input.dy);
      taker.facingX = input.dx / len;
      taker.facingY = input.dy / len;
    }

    const executeSetPiece = (useLob: boolean, useShot: boolean) => {
      const aimX =
        isHuman && (Math.abs(input.dx) > 0.1 || Math.abs(input.dy) > 0.1)
          ? input.dx
          : this.phase === 'CORNER'
            ? -Math.sign(this.setPieceSpotX - FIELD_CENTER_X) * 0.7
            : attackDir;
      const aimY =
        isHuman && (Math.abs(input.dx) > 0.1 || Math.abs(input.dy) > 0.1)
          ? input.dy
          : this.phase === 'THROW_IN'
            ? this.setPieceSpotY < FIELD_CENTER_Y
              ? 0.85
              : -0.85
            : this.phase === 'CORNER'
              ? this.setPieceSpotY < FIELD_CENTER_Y
                ? 0.85
                : -0.85
              : (Math.random() - 0.5) * 0.5;

      if (useShot && this.phase === 'FREE_KICK') {
        this.performShot(taker, 0.75, aimX, aimY);
      } else if (this.phase === 'GOAL_KICK') {
        // Tiro de meta usa distribuição dedicada: Passe (Z) toca curto, Lançar/Chute (C/X) manda longo!
        this.distributeFromGoalkeeper(taker, aimX, aimY, useLob || useShot);
      } else {
        this.performPass(taker, aimX, aimY, useLob || this.phase === 'CORNER');
      }
      this.phase = 'PLAYING';
      this.setPieceTakerId = null;
    };

    if (isHuman) {
      // Cobrança humana super responsiva (libera após ~0.25s de preparação visual)
      if (this.setPieceWaitTimer <= 0.62) {
        if (input.passJustPressed) executeSetPiece(false, false);
        else if (input.lobJustPressed) executeSetPiece(true, false);
        else if (input.shootJustPressed) executeSetPiece(false, true);
      }
      if (this.setPieceWaitTimer <= -3.5) {
        executeSetPiece(this.phase !== 'THROW_IN', false);
      }
    } else if (this.setPieceWaitTimer <= 0) {
      const isCloseFreeKick =
        this.phase === 'FREE_KICK' &&
        Math.abs((attackDir === 1 ? FIELD_RIGHT : FIELD_LEFT) - this.setPieceSpotX) < 420;
      executeSetPiece(this.phase === 'CORNER' || this.phase === 'GOAL_KICK', isCloseFreeKick);
    }
  }

  private updateCamera(dt: number): void {
    const leadX = Math.max(-95, Math.min(95, this.ball.vx * 0.16));
    const leadY = Math.max(-58, Math.min(58, this.ball.vy * 0.13));
    const targetX = this.ball.x + leadX;
    const targetY = this.ball.y + leadY;

    this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 6.5);
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 6.5);
  }

  public getHUDSnapshot(): MatchSnapshotHUD {
    const p1 = this.players.find((p) => p.id === this.p1SelectedId) ?? this.players[11];
    const p2 =
      this.config.controlMode === '1P_2P'
        ? (this.players.find((p) => p.id === this.p2SelectedId) ?? this.players[23])
        : null;

    const ratio = Math.min(1, this.elapsedRealSeconds / Math.max(1, this.totalRealSeconds));
    const totalMatchSecs = Math.floor(ratio * 90 * 60);
    const clockMinutes = Math.floor(totalMatchSecs / 60);
    const clockSeconds = totalMatchSecs % 60;

    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      clockMinutes,
      clockSeconds,
      half: this.half,
      phase: this.phase,
      p1PlayerName: p1?.name ?? '',
      p1PlayerNumber: p1?.number ?? 10,
      p1Stamina: p1?.stamina ?? 100,
      p1Charge: p1?.isCharging ? p1.chargePower : 0,
      p1ChargeType: p1?.chargeType ?? 'shot',
      p2PlayerName: p2?.name ?? null,
      p2PlayerNumber: p2?.number ?? null,
      p2Stamina: p2?.stamina ?? 100,
      p2Charge: p2?.isCharging ? p2.chargePower : 0,
      p2ChargeType: p2?.chargeType ?? 'shot',
      callout: this.callout,
      broadcastLine: this.broadcastLine,
      broadcastSpeaker: this.broadcastSpeaker,
      broadcastPartner: this.broadcastPartner,
      goalBanner: this.goalBanner,
      replayInfo:
        this.phase === 'GOAL_REPLAY' && this.replayMeta
          ? {
              active: true,
              progress: Math.min(
                1,
                this.replayCursor / Math.max(1, this.replayPlaybackFrames.length)
              ),
              scorerName: this.replayMeta.scorerName,
              scorerNumber: this.replayMeta.scorerNumber,
              teamName: this.replayMeta.teamName,
              minute: this.replayMeta.minute,
            }
          : null,
      isPaused: this.isPaused,
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      homeFormation: this.homeFormation,
      awayFormation: this.awayFormation,
      homeSubsUsed: this.homeSubsUsed,
      awaySubsUsed: this.awaySubsUsed,
      maxSubs: this.maxSubs,
    };
  }
}
