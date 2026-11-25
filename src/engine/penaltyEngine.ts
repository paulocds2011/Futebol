import { retroAudio } from '../audio/retroAudio';
import { getClubById, resolveMatchKits } from '../data/clubs';
import {
  Club,
  Difficulty,
  Kit,
  PenaltyAttemptResult,
  PenaltyHUDState,
  PlayerControlMode,
  PlayerInputState,
} from '../types/game';

export interface PenaltyResult {
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
  homeHistory: PenaltyAttemptResult[];
  awayHistory: PenaltyAttemptResult[];
}

export class PenaltyEngine {
  public readonly homeClub: Club;
  public readonly awayClub: Club;
  public readonly homeKit: Kit;
  public readonly awayKit: Kit;
  public readonly controlMode: PlayerControlMode;
  public readonly difficulty: Difficulty;

  public homeScore = 0;
  public awayScore = 0;
  public homeHistory: PenaltyAttemptResult[] = [];
  public awayHistory: PenaltyAttemptResult[] = [];

  public kickingTeam: 'home' | 'away' = 'home';
  public phase: PenaltyHUDState['phase'] = 'AIMING';
  public animTime = 0;
  public crowdExcitement = 0.2;

  // Mira (-1 = esquerda, 0 = centro, 1 = direita) e elevação (0 = rasteiro, 1 = ângulo)
  public aimX = 0;
  public aimY = 0.35;
  public power = 0;
  public powerDir = 1;

  // Posição do goleiro na visão frontal de pênalti (x em -1..1, salto y)
  public keeperX = 0;
  public keeperDiveTarget = 0; // -1, 0, 1
  public keeperDiveHeight = 0.3;
  public keeperDiveProgress = 0;

  // Bola na visão frontal de pênalti (t de 0=marca do pênalti até 1=linha do gol)
  public ballT = 0;
  public ballX = 0; // -1.3..1.3
  public ballY = 0; // 0=chão, 1=travessão
  public ballTargetX = 0;
  public ballTargetY = 0.35;
  public kickerRunT = 0;

  public netRipple = 0;
  public netRippleX = 0;

  public message = '';
  public subMessage = '';
  public winner: 'home' | 'away' | null = null;

  private phaseTimer = 0;
  private aiThinkTimer = 0.9;
  private humanKeeperChoice: number | null = null;
  private humanKeeperHeight = 0.44;
  private lastResult: PenaltyAttemptResult | null = null;
  private onFinish?: (res: PenaltyResult) => void;
  private finishedEmitted = false;

  constructor(
    homeClubId: string,
    awayClubId: string,
    controlMode: PlayerControlMode,
    difficulty: Difficulty,
    onFinish?: (res: PenaltyResult) => void
  ) {
    this.homeClub = getClubById(homeClubId);
    this.awayClub = getClubById(awayClubId);
    const kits = resolveMatchKits(this.homeClub, this.awayClub);
    this.homeKit = kits.homeKit;
    this.awayKit = kits.awayKit;
    this.controlMode = controlMode;
    this.difficulty = difficulty;
    this.onFinish = onFinish;

    this.prepareNextKick(true);
    retroAudio.playWhistle('short');
    const firstKicker = this.getCurrentKicker();
    const firstKeeper = this.getCurrentKeeper();
    retroAudio.narrate(
      `Haja coração, amigo! Começa a disputa de pênaltis entre ${this.homeClub.name} e ${this.awayClub.name}! Primeira cobrança com ${firstKicker.name}, camisa ${firstKicker.number}, contra o goleiro ${firstKeeper.name}!`,
      'high',
      'excited'
    );
  }

  public isHumanKicker(): boolean {
    if (this.kickingTeam === 'home') return true;
    return this.controlMode === '1P_2P';
  }

  public isHumanKeeper(): boolean {
    if (this.kickingTeam === 'away') return true;
    return this.controlMode === '1P_2P';
  }

  private getCurrentKicker() {
    const club = this.kickingTeam === 'home' ? this.homeClub : this.awayClub;
    const kicksTaken =
      this.kickingTeam === 'home' ? this.homeHistory.length : this.awayHistory.length;
    // Ordem: atacantes -> meias -> laterais -> zagueiros -> goleiro (12 jogadores)
    const order = [11, 10, 9, 8, 7, 6, 5, 4, 1, 3, 2, 0];
    return club.squad[order[kicksTaken % order.length]];
  }

  private getCurrentKeeper() {
    const club = this.kickingTeam === 'home' ? this.awayClub : this.homeClub;
    return club.squad[0];
  }

  private prepareNextKick(skipAnnounce = false): void {
    this.phase = 'AIMING';
    this.aimX = 0;
    this.aimY = 0.35;
    this.power = 0;
    this.powerDir = 1;
    this.keeperX = 0;
    this.keeperDiveTarget = 0;
    this.keeperDiveProgress = 0;
    this.ballT = 0;
    this.ballX = 0;
    this.ballY = 0;
    this.kickerRunT = 0;
    this.humanKeeperChoice = null;
    this.humanKeeperHeight = 0.44;
    this.lastResult = null;
    this.aiThinkTimer = 0.9 + Math.random() * 0.45;

    const kicker = this.getCurrentKicker();
    const keeper = this.getCurrentKeeper();
    const club = this.kickingTeam === 'home' ? this.homeClub : this.awayClub;
    this.message = this.isHumanKicker()
      ? `SUA COBRANÇA: ${kicker.name}`
      : `DEFENDA! ${kicker.name} (${club.shortName})`;
    this.subMessage = this.isHumanKicker()
      ? 'Mire com Direcional e segure CHUTE (X/G)'
      : 'Escolha canto + altura (Cima/Baixo) com Direcional + Z/X';

    if (!skipAnnounce) {
      retroAudio.narrate(
        `Lá vai ${kicker.name}, camisa ${kicker.number} do ${club.name}, bola na marca da cal contra ${keeper.name}!`,
        'normal',
        'calm'
      );
    }
  }

  public step(dt: number, p1: PlayerInputState, p2: PlayerInputState): void {
    this.animTime += dt;
    this.netRipple *= Math.pow(0.15, dt);
    const targetCrowd = this.phase === 'RESULT' && this.lastResult === 'GOAL' ? 1 : 0.2;
    this.crowdExcitement += (targetCrowd - this.crowdExcitement) * Math.min(1, dt * 4);

    if (this.phase === 'FINISHED') return;

    const kickerInput = this.kickingTeam === 'home' ? p1 : p2;
    const keeperInput = this.kickingTeam === 'home' ? p2 : p1;

    if (this.phase === 'AIMING' || this.phase === 'CHARGING') {
      // Captura escolha do goleiro humano (canto + altura!)
      if (this.isHumanKeeper()) {
        if (keeperInput.dx < -0.22) this.humanKeeperChoice = -1;
        else if (keeperInput.dx > 0.22) this.humanKeeperChoice = 1;
        else if (keeperInput.passJustPressed || keeperInput.shootJustPressed) {
          this.humanKeeperChoice = this.humanKeeperChoice ?? 0;
        }
        if (keeperInput.dy < -0.25) this.humanKeeperHeight = 0.76;
        else if (keeperInput.dy > 0.25) this.humanKeeperHeight = 0.18;
      }

      if (this.isHumanKicker()) {
        // Move a mira dentro do gol
        this.aimX = Math.max(-0.98, Math.min(0.98, this.aimX + kickerInput.dx * dt * 1.65));
        this.aimY = Math.max(0.08, Math.min(0.98, this.aimY - kickerInput.dy * dt * 1.4));

        if (this.phase === 'AIMING' && kickerInput.shootJustPressed) {
          this.phase = 'CHARGING';
          this.power = 0.18;
          this.powerDir = 1;
        } else if (this.phase === 'CHARGING') {
          if (kickerInput.shoot) {
            this.power += dt * 1.62 * this.powerDir;
            if (this.power >= 1) {
              this.power = 1;
              this.powerDir = -1;
            } else if (this.power <= 0.15) {
              this.power = 0.15;
              this.powerDir = 1;
            }
          } else {
            this.launchKick();
          }
        }
      } else {
        // CPU cobrando
        this.aiThinkTimer -= dt;
        if (this.aiThinkTimer <= 0) {
          const corners = [-0.82, -0.52, 0, 0.52, 0.82];
          this.aimX = corners[Math.floor(Math.random() * corners.length)] + (Math.random() - 0.5) * 0.14;
          this.aimY = 0.14 + Math.random() * 0.68;
          this.power = 0.52 + Math.random() * 0.36;
          this.launchKick();
        }
      }
      return;
    }

    if (this.phase === 'FLIGHT') {
      if (this.kickerRunT < 1) {
        // Permite ajuste de reflexo do goleiro humano durante a corrida do batedor!
        if (this.isHumanKeeper() && this.kickerRunT < 0.78) {
          if (keeperInput.dx < -0.22) this.keeperDiveTarget = -1;
          else if (keeperInput.dx > 0.22) this.keeperDiveTarget = 1;
          if (keeperInput.dy < -0.25) this.keeperDiveHeight = 0.76;
          else if (keeperInput.dy > 0.25) this.keeperDiveHeight = 0.18;
        }
        this.kickerRunT = Math.min(1, this.kickerRunT + dt * 3.2);
        if (this.kickerRunT >= 1) {
          retroAudio.playKick(this.power);
        }
        return;
      }

      this.ballT = Math.min(1, this.ballT + dt * (1.85 + this.power * 0.9));
      this.ballX = this.ballTargetX * this.ballT;
      // Arco parabólico leve
      const arc = Math.sin(this.ballT * Math.PI) * (0.14 + this.power * 0.16);
      this.ballY = this.ballTargetY * this.ballT + arc;

      // Goleiro salta com agilidade realista!
      this.keeperDiveProgress = Math.min(1, this.keeperDiveProgress + dt * 2.65);
      this.keeperX = this.keeperDiveTarget * 0.86 * Math.sin((this.keeperDiveProgress * Math.PI) / 2);

      if (this.ballT >= 1) {
        this.resolveKickOutcome();
      }
      return;
    }

    if (this.phase === 'RESULT') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        const winner = this.checkWinner();
        if (winner) {
          this.winner = winner;
          this.phase = 'FINISHED';
          const winClub = winner === 'home' ? this.homeClub : this.awayClub;
          this.message = `${winClub.name.toUpperCase()} VENCEU!`;
          this.subMessage = `Placar dos Pênaltis: ${this.homeScore} x ${this.awayScore}`;
          retroAudio.playGoalCheer();
          retroAudio.narrate(
            `ACABOU!! É VITÓRIA DO ${winClub.name.toUpperCase()} NOS PÊNALTIS por ${this.homeScore} a ${this.awayScore}!! Festa gigantesca na arquibancada!`,
            'high',
            'goal'
          );
          if (!this.finishedEmitted && this.onFinish) {
            this.finishedEmitted = true;
            this.onFinish({
              homeScore: this.homeScore,
              awayScore: this.awayScore,
              winner,
              homeHistory: [...this.homeHistory],
              awayHistory: [...this.awayHistory],
            });
          }
        } else {
          this.kickingTeam = this.kickingTeam === 'home' ? 'away' : 'home';
          this.prepareNextKick();
        }
      }
    }
  }

  private launchKick(): void {
    this.phase = 'FLIGHT';
    this.kickerRunT = 0;
    this.ballT = 0;

    // Excesso de força (> 0.92) pode isolar a bola por cima ou na trave!
    let spreadX = (Math.random() - 0.5) * 0.1;
    let extraY = 0;
    if (this.power > 0.91) {
      extraY = (this.power - 0.88) * 2.6;
      spreadX += (Math.random() - 0.5) * 0.35;
    }

    this.ballTargetX = this.aimX + spreadX;
    this.ballTargetY = this.aimY + extraY;

    // Define salto do goleiro
    if (this.isHumanKeeper()) {
      this.keeperDiveTarget = this.humanKeeperChoice ?? 0;
      this.keeperDiveHeight = this.humanKeeperHeight;
    } else {
      // IA do goleiro mais esperta e realista (lê cobranças mal colocadas e pula no canto certo com mais frequência)
      const isCentralShot = Math.abs(this.ballTargetX) < 0.28;
      const baseGuess =
        this.difficulty === 'FACIL' ? 0.34 : this.difficulty === 'MEDIO' ? 0.54 : 0.70;
      const guessChance = isCentralShot ? Math.min(0.88, baseGuess + 0.18) : baseGuess;
      if (Math.random() < guessChance) {
        this.keeperDiveTarget = Math.abs(this.ballTargetX) < 0.24 ? 0 : Math.sign(this.ballTargetX);
        this.keeperDiveHeight = Math.max(0.16, Math.min(0.86, this.ballTargetY + (Math.random() - 0.5) * 0.16));
      } else {
        const opts = [-1, 0, 1];
        this.keeperDiveTarget = opts[Math.floor(Math.random() * opts.length)];
        this.keeperDiveHeight = 0.28 + Math.random() * 0.48;
      }
    }
  }

  private resolveKickOutcome(): void {
    this.phase = 'RESULT';
    this.phaseTimer = 1.85;

    const outWide = Math.abs(this.ballTargetX) > 1.03;
    const overBar = this.ballTargetY > 1.04;
    const hitPost =
      (!outWide && Math.abs(this.ballTargetX) > 0.95) ||
      (!overBar && this.ballTargetY > 0.95 && this.ballTargetY <= 1.04);

    let outcome: PenaltyAttemptResult;

    const kicker = this.getCurrentKicker();
    const keeper = this.getCurrentKeeper();
    const kickingClub = this.kickingTeam === 'home' ? this.homeClub : this.awayClub;

    if (outWide || overBar) {
      outcome = 'MISS';
      this.message = 'PRA FORA!!';
      this.subMessage = overBar ? 'Isolou por cima do travessão!' : 'Passou tirando tinta da trave!';
      retroAudio.playCancel();
      retroAudio.narrate(
        overBar
          ? `PRA FOOOORA!! ${kicker.name} isolou por cima do gol de ${keeper.name}!`
          : `PRA FORA!! A cobrança de ${kicker.name} passou tirando tinta da trave!`,
        'high',
        'excited'
      );
    } else if (hitPost && Math.random() < 0.55) {
      outcome = 'MISS';
      this.message = 'NA TRAVE!!';
      this.subMessage = 'Explodiu no poste e saiu!';
      retroAudio.playPostHit();
      retroAudio.narrate(
        `NA TRAAAAVE!! A cobrança de ${kicker.name}, camisa ${kicker.number}, explodiu no ferro! Haja coração!`,
        'high',
        'excited'
      );
    } else {
      // Verifica se goleiro alcançou (envergadura realista para ambos os lados)
      const distX = Math.abs(this.keeperX - this.ballTargetX);
      const distY = Math.abs(this.keeperDiveHeight - this.ballTargetY);
      const saved =
        (distX < 0.31 && distY < 0.54) ||
        (Math.abs(this.ballTargetX) < 0.22 && this.keeperDiveTarget === 0 && distY < 0.68);

      if (saved) {
        outcome = 'SAVE';
        this.message = 'DEFENDEU!!';
        this.subMessage = `Grande defesa de ${keeper.name}!`;
        retroAudio.playSave();
        retroAudio.narrate(
          `DEFENDEEEEEU ${keeper.name.toUpperCase()}!! Buscou a cobrança de ${kicker.name}! Que paredão, amigo!`,
          'high',
          'excited'
        );
      } else {
        outcome = 'GOAL';
        this.netRipple = 1;
        this.netRippleX = this.ballTargetX;
        if (this.kickingTeam === 'home') this.homeScore++;
        else this.awayScore++;
        this.message = 'GOOOOL!!';
        this.subMessage = `${kicker.name} deslocou o goleiro!`;
        retroAudio.playGoalCheer();
        retroAudio.narrate(
          `GOOOOOOOL DE ${kicker.name.toUpperCase()}!! Camisa ${kicker.number} do ${kickingClub.name} deslocou o goleiro ${keeper.name}! ${this.homeClub.name} ${this.homeScore}, ${this.awayClub.name} ${this.awayScore}!`,
          'high',
          'goal'
        );
      }
    }

    this.lastResult = outcome;
    if (this.kickingTeam === 'home') this.homeHistory.push(outcome);
    else this.awayHistory.push(outcome);
  }

  private checkWinner(): 'home' | 'away' | null {
    const hTaken = this.homeHistory.length;
    const aTaken = this.awayHistory.length;

    // 5 cobranças regulamentares com encerramento antecipado se matematicamente impossível alcançar
    if (hTaken <= 5 && aTaken <= 5) {
      const hRem = 5 - hTaken;
      const aRem = 5 - aTaken;
      if (this.homeScore > this.awayScore + aRem) return 'home';
      if (this.awayScore > this.homeScore + hRem) return 'away';
      if (hTaken === 5 && aTaken === 5 && this.homeScore !== this.awayScore) {
        return this.homeScore > this.awayScore ? 'home' : 'away';
      }
      return null;
    }

    // Alternadas (morte súbita): só decide quando ambos cobraram o mesmo número de vezes
    if (hTaken === aTaken && this.homeScore !== this.awayScore) {
      return this.homeScore > this.awayScore ? 'home' : 'away';
    }
    return null;
  }

  public getHUDState(): PenaltyHUDState {
    const kicker = this.getCurrentKicker();
    const keeper = this.getCurrentKeeper();
    const maxTaken = Math.max(this.homeHistory.length, this.awayHistory.length);
    const isSuddenDeath = this.homeHistory.length >= 5 && this.awayHistory.length >= 5;

    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      homeHistory: [...this.homeHistory],
      awayHistory: [...this.awayHistory],
      roundNumber: Math.min(5, Math.floor((this.homeHistory.length + this.awayHistory.length) / 2) + 1),
      isSuddenDeath: isSuddenDeath || maxTaken > 5,
      kickingTeam: this.kickingTeam,
      kickerName: kicker.name,
      kickerNumber: kicker.number,
      keeperName: keeper.name,
      phase: this.phase,
      message: this.message,
      subMessage: this.subMessage,
      winner: this.winner,
      isHumanKicker: this.isHumanKicker(),
      isHumanKeeper: this.isHumanKeeper(),
    };
  }
}
