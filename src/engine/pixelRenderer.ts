import { CameraMode, FieldPlayer, Kit, LinesmanState, RefereeState } from '../types/game';
import { PenaltyEngine } from './penaltyEngine';
import {
  CROSSBAR_Z,
  FIELD_BOTTOM,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  FIELD_LEFT,
  FIELD_RIGHT,
  FIELD_TOP,
  GOALBOX_HALF_H,
  GOALBOX_W,
  GOAL_BOTTOM,
  GOAL_DEPTH,
  GOAL_HALF_H,
  GOAL_TOP,
  PENALTY_HALF_H,
  PENALTY_W,
  PITCH_H,
  PITCH_W,
  SoccerEngine,
} from './soccerEngine';

// Resolução HD Pixel Art 16-bit (1.5x mais nítida e detalhada, mantendo 60 FPS)
export const CANVAS_W = 960;
export const CANVAS_H = 540;

// 3 modos de câmera (TV Clássica, Perto Ação, Ampla Tática) com jogadores maiores e ultra-detalhados
const CAMERA_PRESETS: Record<CameraMode, { sx: number; sy: number; spriteScale: number }> = {
  TV: { sx: 0.84, sy: 0.67, spriteScale: 1.72 },
  PERTO: { sx: 1.16, sy: 0.90, spriteScale: 2.02 },
  AMPLA: { sx: 0.39, sy: 0.32, spriteScale: 1.22 },
};
const REPLAY_CAMERA_PRESET = { sx: 1.28, sy: 1.00, spriteScale: 2.12 };

let currentScaleX = CAMERA_PRESETS.TV.sx;
let currentScaleY = CAMERA_PRESETS.TV.sy;
let currentSpriteScale = CAMERA_PRESETS.TV.spriteScale;

function snap(v: number): number {
  return Math.round(v);
}

// --- CACHE DE TEXTURAS PROCEDURAIS (GRAMADO, CONCRETO E DESGASTE) ---

interface TextureCache {
  turfLight: CanvasPattern | null;
  turfDark: CanvasPattern | null;
  turfOuter: CanvasPattern | null;
}

let cachedTextures: TextureCache | null = null;

function createTurfTile(
  baseHex: string,
  bladeLight: string,
  bladeDark: string,
  speck: string
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = baseHex;
  g.fillRect(0, 0, 96, 96);

  // Micro-textura orgânica determinística de gramado profissional de arena
  let seed = baseHex.charCodeAt(1) * 131 + baseHex.charCodeAt(3) * 17 + baseHex.charCodeAt(5) * 31;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Trama sutil de rolo compressor e corte cruzado
  g.fillStyle = bladeLight;
  g.globalAlpha = 0.14;
  for (let y = 0; y < 96; y += 6) {
    g.fillRect(0, y, 96, 2);
  }
  g.fillStyle = bladeDark;
  g.globalAlpha = 0.1;
  for (let x = 0; x < 96; x += 12) {
    g.fillRect(x, 0, 2, 96);
  }

  // Subcamada de sombras de raiz da grama
  g.globalAlpha = 0.22;
  g.fillStyle = '#133d1b';
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(nextRand() * 94);
    const y = Math.floor(nextRand() * 94);
    g.fillRect(x, y, 2, 2);
  }

  // Fios de grama densos claros e escuros com variação natural de inclinação
  g.globalAlpha = 0.38;
  for (let i = 0; i < 520; i++) {
    const x = Math.floor(nextRand() * 95);
    const y = Math.floor(nextRand() * 95);
    const h = nextRand() > 0.55 ? 3 : 2;
    g.fillStyle = nextRand() > 0.46 ? bladeLight : bladeDark;
    g.fillRect(x, y, 1, h);
    if (nextRand() > 0.78) {
      g.fillRect(x + 1, Math.max(0, y - 1), 1, 1);
    }
  }

  // Brilho de orvalho / reflexo suave dos refletores na relva
  g.globalAlpha = 0.22;
  g.fillStyle = speck;
  for (let i = 0; i < 75; i++) {
    const x = Math.floor(nextRand() * 94);
    const y = Math.floor(nextRand() * 94);
    g.fillRect(x, y, 2, 1);
  }
  g.globalAlpha = 1;
  return c;
}

function getTextures(ctx: CanvasRenderingContext2D): TextureCache {
  if (cachedTextures) return cachedTextures;
  const lightTile = createTurfTile('#2c943c', '#45ba57', '#1f702d', '#86ef96');
  const darkTile = createTurfTile('#247e33', '#36a046', '#195d24', '#68d378');
  const outerTile = createTurfTile('#1b5c26', '#287735', '#13441b', '#439650');

  cachedTextures = {
    turfLight: ctx.createPattern(lightTile, 'repeat'),
    turfDark: ctx.createPattern(darkTile, 'repeat'),
    turfOuter: ctx.createPattern(outerTile, 'repeat'),
  };
  return cachedTextures;
}

// --- RENDERIZADOR DA PARTIDA PRINCIPAL (60 FPS) ---

export function renderMatchFrame(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  cameraMode: CameraMode = 'TV'
): void {
  ctx.imageSmoothingEnabled = false;
  const textures = getTextures(ctx);

  const isReplay = engine.phase === 'GOAL_REPLAY';
  const preset = isReplay
    ? REPLAY_CAMERA_PRESET
    : (CAMERA_PRESETS[cameraMode] ?? CAMERA_PRESETS.TV);
  const lerpRate = isReplay ? 0.22 : 0.14;
  currentScaleX += (preset.sx - currentScaleX) * lerpRate;
  currentScaleY += (preset.sy - currentScaleY) * lerpRate;
  currentSpriteScale += (preset.spriteScale - currentSpriteScale) * lerpRate;

  const scaleX = currentScaleX;
  const scaleY = currentScaleY;
  const spriteScale = currentSpriteScale;

  const viewWorldW = CANVAS_W / scaleX;
  const viewWorldH = CANVAS_H / scaleY;

  const minCamX = viewWorldW * 0.5 - 50;
  const maxCamX = PITCH_W - viewWorldW * 0.5 + 50;
  const minCamY = viewWorldH * 0.5 - 125; // Mostra a arquibancada completa + refletores
  const maxCamY = PITCH_H - viewWorldH * 0.5 + 65;

  let camX =
    minCamX <= maxCamX
      ? Math.max(minCamX, Math.min(maxCamX, engine.cameraX))
      : FIELD_CENTER_X;
  let camY =
    minCamY <= maxCamY
      ? Math.max(minCamY, Math.min(maxCamY, engine.cameraY))
      : FIELD_CENTER_Y - 22;

  if (engine.screenShake > 0.01) {
    camX += (Math.random() - 0.5) * engine.screenShake * 20;
    camY += (Math.random() - 0.5) * engine.screenShake * 16;
  }

  const toScreenX = (wx: number) => (wx - camX) * scaleX + CANVAS_W * 0.5;
  const toScreenY = (wy: number, wz = 0) =>
    (wy - camY) * scaleY + CANVAS_H * 0.5 - wz * (0.96 * (scaleY / 0.84));

  // 1. Fundo de gramado externo texturizado (expandido para cobrir o campo 3600x2120 sem bordas vazias)
  ctx.save();
  ctx.translate(snap(toScreenX(0)), snap(toScreenY(0)));
  ctx.fillStyle = textures.turfOuter ?? '#1e6129';
  ctx.fillRect(-3400, -2200, 10600, 6800);
  ctx.restore();

  // 2. Arquibancada Superior Animada (Torcida, Flashes, Bandeirões, Refletores e Placas)
  drawAnimatedStands(ctx, engine, scaleX, toScreenX, toScreenY);

  // 3. Gramado texturizado em faixas de dois tons + desgaste da área + linhas brancas
  drawPitchAndLines(ctx, engine, textures, scaleX, scaleY, toScreenX, toScreenY);

  // 3b. Alvo sutil no gramado para cruzamentos aéreos (ajuda a cronometrar o cabeceio)
  if (engine.ball.isCrossBall && !engine.ball.ownerId && engine.ball.z > 8) {
    const tx = toScreenX(engine.ball.passTargetX);
    const ty = toScreenY(engine.ball.passTargetY, 0);
    const pulse = 0.72 + Math.sin(engine.animTime * 14) * 0.28;
    const outerR = (13 + (1 - pulse) * 5) * scaleX;
    ctx.save();
    ctx.strokeStyle = `rgba(253, 224, 71, ${0.42 + pulse * 0.42})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(tx, ty, outerR, outerR * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(tx, ty, outerR * 0.48, outerR * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
    ctx.beginPath();
    ctx.ellipse(tx, ty, outerR * 0.86, outerR * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. Metade de trás dos gols (rede traseira + estrutura metálica + sombra interna)
  drawGoalBack(ctx, engine, 'left', toScreenX, toScreenY);
  drawGoalBack(ctx, engine, 'right', toScreenX, toScreenY);

  // 5. Ordenação de profundidade (Y-sort) para jogadores, árbitro, bandeirinhas e bola
  type DrawItem = { y: number; draw: () => void };
  const items: DrawItem[] = [];

  for (const p of engine.players) {
    items.push({
      y: p.y,
      draw: () => drawFieldPlayer(ctx, engine, p, spriteScale, toScreenX, toScreenY),
    });
  }

  // Árbitro principal em campo
  items.push({
    y: engine.referee.y,
    draw: () => drawReferee(ctx, engine, engine.referee, spriteScale, toScreenX, toScreenY),
  });

  // Bandeirinhas nas duas laterais
  for (const lm of engine.linesmen) {
    items.push({
      y: lm.y,
      draw: () => drawLinesman(ctx, engine, lm, spriteScale, toScreenX, toScreenY),
    });
  }

  // Cameramen de transmissão (tripé + Steadicam na lateral) e fotógrafos atrás dos gols
  addCameramanDrawItems(items, ctx, engine, spriteScale, toScreenX, toScreenY);

  items.push({
    y: engine.ball.y + 1,
    draw: () => drawBall(ctx, engine, spriteScale, toScreenX, toScreenY),
  });

  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    item.draw();
  }

  // 6. Traves dianteiras e rede superior (sobrepõe jogadores dentro do gol)
  drawGoalFront(ctx, engine, 'left', toScreenX, toScreenY);
  drawGoalFront(ctx, engine, 'right', toScreenX, toScreenY);

  // 7. Bandeirinhas de escanteio tremulando com sombra direcional
  drawCornerFlags(ctx, engine, toScreenX, toScreenY);

  // 8. Gritos animados da torcida flutuando da arquibancada
  drawCrowdChants(ctx, engine, toScreenX, toScreenY);

  // 9. Confete + Show de Fogos de Artifício ao fazer o gol!
  if (engine.phase === 'GOAL_CELEBRATION') {
    drawGoalConfetti(ctx, engine);
  }
  if (
    engine.fireworkRockets.length > 0 ||
    engine.fireworkSparks.length > 0 ||
    engine.fireworkFlash > 0.01
  ) {
    drawGoalFireworks(ctx, engine);
  }

  // 10. Clima (Sol, Chuva ou Neve) e Iluminação Dia / Noite do estádio
  drawWeatherEffects(ctx, engine);
  drawStadiumLighting(ctx, engine);

  // 11. Mureta inferior com painéis LED e torcida do anel inferior
  drawLowerBorderWall(ctx, engine, toScreenX, toScreenY);

  // 12. Durante Replay do Gol: moldura cinematográfica de transmissão TV; caso contrário: Radar
  if (isReplay) {
    drawReplayBroadcastFrame(ctx, engine);
  } else {
    drawRadar(ctx, engine);
  }
}

function drawAnimatedStands(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  scaleX: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const standBottomY = snap(toScreenY(FIELD_TOP - 32));
  if (standBottomY <= 0) return;

  const leftX = snap(toScreenX(FIELD_LEFT - 140));
  const rightX = snap(toScreenX(FIELD_RIGHT + 140));
  const totalW = rightX - leftX;
  const midX = toScreenX(FIELD_CENTER_X);

  // Pista lateral sintética/azul retrô entre a mureta e o gramado
  ctx.fillStyle = '#18372c';
  ctx.fillRect(0, standBottomY, CANVAS_W, snap(toScreenY(FIELD_TOP) - standBottomY));

  // Estrutura de concreto da arquibancada (mais clara de dia, dramática à noite)
  const isNight = engine.timeOfDay === 'NOITE';
  const gradStand = ctx.createLinearGradient(0, Math.max(0, standBottomY - 135), 0, standBottomY);
  if (isNight) {
    gradStand.addColorStop(0, '#070d1d');
    gradStand.addColorStop(0.4, '#15223b');
    gradStand.addColorStop(1, '#233457');
  } else if (engine.weather === 'CHUVA') {
    gradStand.addColorStop(0, '#27364c');
    gradStand.addColorStop(0.45, '#334663');
    gradStand.addColorStop(1, '#415575');
  } else if (engine.weather === 'NEVE') {
    gradStand.addColorStop(0, '#475569');
    gradStand.addColorStop(0.45, '#64748b');
    gradStand.addColorStop(1, '#526582');
  } else {
    gradStand.addColorStop(0, '#2a4168');
    gradStand.addColorStop(0.4, '#36507d');
    gradStand.addColorStop(1, '#415f91');
  }
  ctx.fillStyle = gradStand;
  ctx.fillRect(0, 0, CANVAS_W, standBottomY);

  // Degraus com profundidade e escadas de acesso amarelas
  for (let row = 0; row < 6; row++) {
    const ry = standBottomY - 18 - row * 19;
    if (ry < -25) continue;
    ctx.fillStyle = row % 2 === 0 ? '#1b2740' : '#253557';
    ctx.fillRect(0, ry, CANVAS_W, 18);
    ctx.fillStyle = '#0c1324';
    ctx.fillRect(0, ry + 16, CANVAS_W, 3);
  }

  // Escadas verticais + túneis de acesso da arquibancada
  for (let wx = FIELD_LEFT; wx <= FIELD_RIGHT; wx += 264) {
    const sx = snap(toScreenX(wx));
    if (sx < -24 || sx > CANVAS_W + 24) continue;
    ctx.fillStyle = '#334155';
    ctx.fillRect(sx - 7, Math.max(0, standBottomY - 132), 14, 118);
    // Corrimão central metálico
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(sx - 1, Math.max(0, standBottomY - 130), 2, 112);
    ctx.fillStyle = '#eab308';
    for (let st = 0; st < 16; st++) {
      ctx.fillRect(sx - 6, standBottomY - 20 - st * 7, 12, 2);
    }
    // Vomitorio / túnel de acesso escuro no meio da arquibancada
    const tunY = standBottomY - 82;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(sx - 9, tunY, 18, 22);
    ctx.fillStyle = '#475569';
    ctx.fillRect(sx - 10, tunY - 2, 20, 3);
  }

  // Torcedores detalhados e mais realistas com camisas listradas, cabeças arredondadas, cachecóis e sinalizadores
  const t = engine.animTime;
  const excitement = engine.crowdExcitement;
  const homeColors = engine.homeClub.crowdColors;
  const awayColors = engine.awayClub.crowdColors;

  const fanSpacing = 11;
  const startCol = Math.max(0, Math.floor((0 - leftX) / fanSpacing));
  const endCol = Math.min(
    Math.ceil(totalW / fanSpacing),
    Math.ceil((CANVAS_W - leftX) / fanSpacing) + 1
  );

  const fanSkins = ['#f3c9a6', '#e0a87b', '#c68456', '#8d5532', '#613820'];
  const fanHairs = ['#141414', '#2c1e16', '#4a311f', '#8a6234', '#d4d4d8'];

  for (let row = 0; row < 6; row++) {
    const baseY = standBottomY - 21 - row * 19;
    if (baseY < -18 || baseY > CANVAS_H) continue;
    const rowScale = 1 - row * 0.035;

    for (let col = startCol; col <= endCol; col++) {
      const fx = snap(leftX + col * fanSpacing + (row % 2) * 5);
      if (fx < -14 || fx > CANVAS_W + 14) continue;

      // Deixa o corredor da escada/túnel livre
      const isStair = Math.abs(((fx - toScreenX(FIELD_LEFT)) % Math.max(16, snap(264 * scaleX)))) < 11;
      if (isStair) continue;

      const seed = (col * 37 + row * 23) % 100;
      const isHomeSide = fx < midX;
      const palette = isHomeSide ? homeColors : awayColors;
      const shirtColor = palette[seed % palette.length];
      const trimColor = palette[(seed + 1) % palette.length];
      const accentColor = palette[(seed + 2) % palette.length];
      const skin = fanSkins[seed % fanSkins.length];
      const hair = fanHairs[(seed * 3) % fanHairs.length];

      const jumpFreq = 5.4 + excitement * 13.5;
      const jumpAmp = 2.0 + excitement * 7.8;
      // Onda sincronizada "OLA!" percorrendo a arquibancada
      const olaPhase = Math.sin(t * 2.5 - col * 0.14);
      const ola = olaPhase > 0.35 ? (olaPhase - 0.35) * (7.8 + excitement * 6.2) : 0;
      const jump = Math.max(0, Math.sin(t * jumpFreq + seed * 0.65)) * jumpAmp + ola;
      const fy = snap(baseY - jump);

      // Sombra do torcedor no degrau
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(fx, baseY + 6, 8, 2);

      // Ombros e camisa arredondada com padrão listrado/faixa do clube
      const bw = 8 * rowScale;
      const bh = 7 * rowScale;
      ctx.fillStyle = '#070b14';
      ctx.beginPath();
      ctx.roundRect(fx - 0.8, fy - 0.8, bw + 1.6, bh + 1.4, 2.5);
      ctx.fill();

      ctx.fillStyle = shirtColor;
      ctx.beginPath();
      ctx.roundRect(fx, fy, bw, bh, 2);
      ctx.fill();

      if (seed % 3 === 0) {
        // Listra vertical
        ctx.fillStyle = trimColor;
        ctx.fillRect(fx + 2.4, fy + 0.5, 2.8 * rowScale, bh - 1);
      } else if (seed % 3 === 1) {
        // Faixa horizontal no peito
        ctx.fillStyle = trimColor;
        ctx.fillRect(fx + 0.5, fy + 2.2, bw - 1, 2.1);
      } else {
        // Detalhe nos ombros + gola
        ctx.fillStyle = accentColor;
        ctx.fillRect(fx + 1.5, fy, bw - 3, 1.4);
      }

      // Pescoço e cabeça arredondada realista com cabelo e micro-expressão
      const hx = fx + bw * 0.5;
      const hy = fy - 2.6;
      ctx.fillStyle = '#070b14';
      ctx.beginPath();
      ctx.arc(hx, hy, 3.1 * rowScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(hx, hy + 0.2, 2.4 * rowScale, 0, Math.PI * 2);
      ctx.fill();

      // Cabelo ou boné do clube
      ctx.fillStyle = seed % 9 === 0 ? shirtColor : hair;
      ctx.beginPath();
      ctx.arc(hx, hy - 0.8, 2.4 * rowScale, Math.PI, Math.PI * 2);
      ctx.fill();
      if (seed % 9 === 0) {
        // Aba de boné
        ctx.fillStyle = trimColor;
        ctx.fillRect(hx - 2.6, hy - 1.2, 5.2, 1);
      }

      // Olhinhos sutis olhando para o gramado
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx - 1.1, hy + 0.2, 0.8, 0.8);
      ctx.fillRect(hx + 0.4, hy + 0.2, 0.8, 0.8);

      // Braços erguidos aplaudindo, agitando cachecol ou bandeirinha
      const waving = ola > 1.1 || (excitement > 0.22 && seed % 2 === 0) || seed % 5 === 0;
      if (waving) {
        const armPulse = Math.round(Math.sin(t * 14 + seed) * 1.5);
        ctx.fillStyle = shirtColor;
        ctx.fillRect(fx - 1.8, fy - 3.8 + armPulse, 2.1, 4.8);
        ctx.fillRect(fx + bw - 0.2, fy - 3.8 - armPulse, 2.1, 4.8);
        ctx.fillStyle = skin;
        ctx.fillRect(fx - 1.8, fy - 4.8 + armPulse, 2, 1.5);
        ctx.fillRect(fx + bw - 0.2, fy - 4.8 - armPulse, 2, 1.5);
        if (seed % 4 === 0 || ola > 1.8) {
          // Cachecol esticado nas cores do clube
          ctx.fillStyle = trimColor;
          ctx.fillRect(fx - 3, fy - 6.2 + armPulse, bw + 6, 2.2);
          ctx.fillStyle = shirtColor;
          ctx.fillRect(fx + 1, fy - 6.2 + armPulse, 3, 2.2);
        }
      }

      // Flashes de celular/câmera e sinalizadores acesos na arquibancada
      const flashTrig = Math.sin(t * 14 + seed * 11.3);
      if (flashTrig > (excitement > 0.45 ? 0.94 : 0.99)) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.beginPath();
        ctx.arc(hx, hy, 6.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Fumaça colorida / sinalizadores festivos das torcidas quando o clima esquenta ou sai gol!
  if (excitement > 0.34) {
    const smokeIntensity = Math.min(1, (excitement - 0.34) * 1.6);
    const flareSpots = [
      { wx: FIELD_LEFT + 320, col: homeColors[0] },
      { wx: FIELD_LEFT + 660, col: homeColors[1] },
      { wx: FIELD_RIGHT - 660, col: awayColors[0] },
      { wx: FIELD_RIGHT - 320, col: awayColors[1] },
    ];
    ctx.save();
    for (let i = 0; i < flareSpots.length; i++) {
      const fx = toScreenX(flareSpots[i].wx);
      if (fx < -70 || fx > CANVAS_W + 70) continue;
      for (let p = 0; p < 5; p++) {
        const rise = ((t * 24 + p * 18 + i * 11) % 72);
        const drift = Math.sin(t * 2.5 + p + i) * 14;
        const radius = 8 + rise * 0.32;
        const alpha = Math.max(0, (1 - rise / 72) * 0.28 * smokeIntensity);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = flareSpots[i].col;
        ctx.beginPath();
        ctx.arc(fx + drift, standBottomY - 22 - rise, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      // Ponto luminoso do sinalizador
      ctx.globalAlpha = 0.78 * smokeIntensity;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(fx, standBottomY - 22, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 6 Bandeirões gigantes ondulantes espalhados pelo estádio ampliado
  const flagPositions = [
    { wx: FIELD_LEFT + 180, team: 'home' as const },
    { wx: FIELD_LEFT + 480, team: 'home' as const },
    { wx: FIELD_LEFT + 780, team: 'home' as const },
    { wx: FIELD_RIGHT - 780, team: 'away' as const },
    { wx: FIELD_RIGHT - 480, team: 'away' as const },
    { wx: FIELD_RIGHT - 180, team: 'away' as const },
  ];

  for (let i = 0; i < flagPositions.length; i++) {
    const fp = flagPositions[i];
    const sx = snap(toScreenX(fp.wx));
    if (sx < -60 || sx > CANVAS_W + 60) continue;
    const baseY = standBottomY - 26;
    const colors = fp.team === 'home' ? homeColors : awayColors;
    const waveSpeed = 4.2 + excitement * 9;
    const sway = Math.sin(t * waveSpeed + i * 1.9) * (6 + excitement * 7);

    // Mastro metálico
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(sx - 1, baseY - 52, 3, 54);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx, baseY - 52, 1, 54);

    // Pano em 5 segmentos com sombreamento nas dobras
    for (let seg = 0; seg < 5; seg++) {
      const waveVal = Math.sin(t * waveSpeed + seg * 0.95 + i);
      const segY = baseY - 50 + Math.round(waveVal * 3.5);
      const segX = sx + 2 + seg * 9 + Math.round((sway * seg) / 5);
      ctx.fillStyle = colors[0];
      ctx.fillRect(segX, segY, 9, 10);
      ctx.fillStyle = colors[1];
      ctx.fillRect(segX, segY + 10, 9, 10);
      ctx.fillStyle = colors[2];
      ctx.fillRect(segX, segY + 20, 9, 8);
      if (waveVal < -0.25) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(segX, segY, 9, 28);
      }
    }
  }

  // Divisória do 2º anel (camarote / mureta intermediária com faixas de torcida)
  const tierDivY = standBottomY - 68;
  if (tierDivY > 0 && tierDivY < CANVAS_H) {
    ctx.fillStyle = '#0b1324';
    ctx.fillRect(0, tierDivY, CANVAS_W, 8);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, tierDivY, CANVAS_W, 1.5);

    // Faixas estendidas das torcidas organizadas no parapeito do 2º anel
    const bannerSpots = [
      { wx: FIELD_LEFT + 260, team: 'home' as const, label: engine.homeClub.shortName },
      { wx: FIELD_LEFT + 680, team: 'home' as const, label: engine.homeClub.name.toUpperCase().slice(0, 12) },
      { wx: FIELD_RIGHT - 680, team: 'away' as const, label: engine.awayClub.name.toUpperCase().slice(0, 12) },
      { wx: FIELD_RIGHT - 260, team: 'away' as const, label: engine.awayClub.shortName },
    ];
    ctx.font = 'bold 6.5px monospace';
    ctx.textAlign = 'center';
    for (const bn of bannerSpots) {
      const bx = snap(toScreenX(bn.wx));
      if (bx < -70 || bx > CANVAS_W + 70) continue;
      const pal = bn.team === 'home' ? homeColors : awayColors;
      ctx.fillStyle = pal[0];
      ctx.fillRect(bx - 42, tierDivY + 1, 84, 7);
      ctx.fillStyle = pal[1];
      ctx.fillRect(bx - 42, tierDivY + 1, 8, 7);
      ctx.fillRect(bx + 34, tierDivY + 1, 8, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(bn.label, bx, tierDivY + 6.5);
    }
    ctx.textAlign = 'left';
  }

  // Cabine VIP de Transmissão TV ("EFATÁ TV") centralizada no topo da arquibancada
  const cabinX = snap(toScreenX(FIELD_CENTER_X));
  const cabinY = Math.max(2, standBottomY - 122);
  if (cabinX > -90 && cabinX < CANVAS_W + 90 && cabinY < standBottomY - 30) {
    ctx.fillStyle = '#091121';
    ctx.fillRect(cabinX - 58, cabinY, 116, 26);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cabinX - 58, cabinY, 116, 26);
    // Janelas panorâmicas iluminadas com silhuetas dos narradores
    for (let w = 0; w < 3; w++) {
      const wx = cabinX - 52 + w * 36;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(wx, cabinY + 9, 32, 13);
      ctx.fillStyle = 'rgba(254, 249, 195, 0.25)';
      ctx.fillRect(wx + 2, cabinY + 10, 28, 4);
      // Silhueta do narrador/comentarista com fone
      ctx.fillStyle = '#0b1324';
      ctx.beginPath();
      ctx.arc(wx + 11, cabinY + 16, 2.4, 0, Math.PI * 2);
      ctx.arc(wx + 21, cabinY + 16, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(wx + 8, cabinY + 18.5, 6, 3.5);
      ctx.fillRect(wx + 18, cabinY + 18.5, 6, 3.5);
    }
    // Letreiro luminoso da cabine
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cabinX - 38, cabinY + 1, 76, 7);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 6.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EFATÁ TV · AO VIVO', cabinX, cabinY + 6.5);
    ctx.textAlign = 'left';
  }

  // Cobertura metálica superior + Céu Dia/Noite + Refletores do Estádio
  const roofH = Math.max(0, standBottomY - 122);
  if (roofH > 0) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, roofH);
    if (isNight) {
      skyGrad.addColorStop(0, '#030816');
      skyGrad.addColorStop(1, '#0d1a34');
    } else if (engine.weather === 'CHUVA') {
      skyGrad.addColorStop(0, '#334155');
      skyGrad.addColorStop(1, '#475569');
    } else if (engine.weather === 'NEVE') {
      skyGrad.addColorStop(0, '#94a3b8');
      skyGrad.addColorStop(1, '#cbd5e1');
    } else {
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(1, '#7dd3fc');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, roofH);

    // Estrelas sutis no céu noturno sem chuva
    if (isNight && engine.weather !== 'CHUVA') {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let st = 0; st < 28; st++) {
        const sx = (st * 97 + 19) % CANVAS_W;
        const sy = (st * 43 + 7) % Math.max(6, roofH - 4);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }

    // Borda da cobertura (com camada de neve no clima NEVE!)
    ctx.fillStyle = engine.weather === 'NEVE' ? '#e2e8f0' : '#334155';
    ctx.fillRect(0, roofH - 3, CANVAS_W, 3);
  }
  const floodlightsOn = isNight || engine.weather !== 'SOL';
  for (let wx = FIELD_LEFT + 140; wx <= FIELD_RIGHT - 140; wx += 380) {
    const lx = snap(toScreenX(wx));
    if (lx < -40 || lx > CANVAS_W + 40) continue;
    const ly = Math.max(4, standBottomY - 128);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(lx - 18, ly, 36, 10);
    ctx.fillStyle = floodlightsOn ? '#fef9c3' : '#94a3b8';
    for (let b = 0; b < 4; b++) {
      ctx.fillRect(lx - 15 + b * 8, ly + 2, 6, 5);
    }
    if (floodlightsOn) {
      const halo = ctx.createRadialGradient(lx, ly + 5, 3, lx, ly + 5, isNight ? 66 : 42);
      halo.addColorStop(0, isNight ? 'rgba(254, 249, 195, 0.65)' : 'rgba(254, 249, 195, 0.34)');
      halo.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(lx - 66, ly - 24, 132, 95);
    }
  }

  // Painéis de LED digitais ao redor da lateral superior (EFATÁ SOCCER 26 + EFATÁ GAMESTUDIO)
  const adTexts = [
    { text: 'EFATÁ SOCCER 26', bg: '#0b1d45', fg: '#facc15', glow: 'rgba(250, 204, 21, 0.16)' },
    { text: 'EFATÁ GAMESTUDIO', bg: '#14532d', fg: '#ffffff', glow: 'rgba(74, 222, 128, 0.16)' },
    {
      text: `${engine.homeClub.shortName} × ${engine.awayClub.shortName}`,
      bg: '#7f1d1d',
      fg: '#fde047',
      glow: 'rgba(248, 113, 113, 0.16)',
    },
    { text: 'COPA BRASIL 26', bg: '#111827', fg: '#38bdf8', glow: 'rgba(56, 189, 248, 0.16)' },
  ];

  const boardW = 114;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, standBottomY - 14, CANVAS_W, 16);
  let idx = 0;
  const ledPulse = 0.86 + Math.sin(t * 4) * 0.14;
  for (let bx = leftX; bx < rightX; bx += boardW) {
    idx++;
    if (bx + boardW < 0 || bx > CANVAS_W) continue;
    const ad = adTexts[idx % adTexts.length];
    const rx = snap(bx);
    ctx.fillStyle = ad.bg;
    ctx.fillRect(rx + 1, standBottomY - 12, boardW - 3, 12);
    ctx.fillStyle = ad.fg;
    ctx.globalAlpha = ledPulse;
    ctx.fillRect(rx + 1, standBottomY - 12, boardW - 3, 1.3);
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ad.text, rx + boardW * 0.5, standBottomY - 3);
    ctx.globalAlpha = 1;
    // Reflexo sutil do painel de LED sobre a pista externa
    ctx.fillStyle = ad.glow;
    ctx.fillRect(rx + 2, standBottomY + 2, boardW - 5, 5);
  }
  ctx.textAlign = 'left';

  // Bancos de reservas com cobertura acrílica, jogadores reservas sentados e técnicos na beira do campo
  const benchLeftX = snap(toScreenX(FIELD_CENTER_X - 185));
  const benchRightX = snap(toScreenX(FIELD_CENTER_X + 110));
  const benchY = standBottomY + 2;
  [benchLeftX, benchRightX].forEach((bx, bi) => {
    const kit = bi === 0 ? engine.homeKit : engine.awayKit;
    // Sombra projetada do banco de reservas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fillRect(bx + 5, benchY + 12, 74, 5);
    // Estrutura e cobertura translúcida do banco
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx, benchY, 72, 14);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fillRect(bx + 2, benchY + 1, 68, 4);
    ctx.fillStyle = kit.primary;
    ctx.fillRect(bx + 2, benchY + 5, 68, 2.5);
    // 5 reservas sentados com colete
    for (let sub = 0; sub < 5; sub++) {
      const subX = bx + 9 + sub * 13;
      ctx.fillStyle = bi === 0 ? '#facc15' : '#38bdf8';
      ctx.fillRect(subX - 2, benchY + 8, 5, 4);
      ctx.fillStyle = sub % 2 === 0 ? '#e5b28a' : '#8d5532';
      ctx.beginPath();
      ctx.arc(subX + 0.5, benchY + 6.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Técnico em pé na área técnica gesticulando (com sombra)
    const coachX = bi === 0 ? bx + 78 : bx - 9;
    const coachY = benchY + 10 + Math.sin(t * 5 + bi) * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(coachX + 3.5, coachY + 5.5, 5.2, 2.2, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(coachX - 2.5, coachY - 2, 5, 7);
    ctx.fillStyle = '#e5b28a';
    ctx.beginPath();
    ctx.arc(coachX, coachY - 4, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bi === 0 ? '#334155' : '#cbd5e1';
    ctx.fillRect(coachX - 2, coachY - 6.3, 4, 1.5);
  });

  // Sombra projetada da mureta e leve sombra da cobertura do estádio junto à linha lateral superior
  const roofShadeH = Math.max(10, snap(toScreenY(FIELD_TOP + 28) - standBottomY));
  const roofGrad = ctx.createLinearGradient(0, standBottomY, 0, standBottomY + roofShadeH);
  roofGrad.addColorStop(0, 'rgba(3, 10, 22, 0.34)');
  roofGrad.addColorStop(0.45, 'rgba(3, 10, 22, 0.14)');
  roofGrad.addColorStop(1, 'rgba(3, 10, 22, 0)');
  ctx.fillStyle = roofGrad;
  ctx.fillRect(0, standBottomY + 2, CANVAS_W, roofShadeH);
}

function drawLowerBorderWall(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const wallY = snap(toScreenY(FIELD_BOTTOM + 36));
  if (wallY >= CANVAS_H) return;

  // Sombra projetada para dentro da pista antes da mureta
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, wallY - 5, CANVAS_W, 5);

  ctx.fillStyle = '#090f1d';
  ctx.fillRect(0, wallY, CANVAS_W, CANVAS_H - wallY);

  const midX = toScreenX(FIELD_CENTER_X);
  const step = 96;
  const startX = snap(toScreenX(FIELD_LEFT - 140));
  const endX = snap(toScreenX(FIELD_RIGHT + 140));
  const t = engine.animTime;
  let bIdx = 0;

  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  for (let x = startX; x < endX; x += step) {
    bIdx++;
    if (x + step < 0 || x > CANVAS_W) continue;
    const pal = x < midX ? engine.homeClub.crowdColors : engine.awayClub.crowdColors;
    const rx = snap(x);
    ctx.fillStyle = bIdx % 2 === 0 ? '#0b1d45' : pal[0];
    ctx.fillRect(rx + 2, wallY + 2, step - 4, 10);
    ctx.fillStyle = bIdx % 2 === 0 ? '#facc15' : pal[1];
    ctx.fillRect(rx + 2, wallY + 2, step - 4, 1.3);
    ctx.fillStyle = bIdx % 2 === 0 ? '#fde047' : '#ffffff';
    ctx.fillText(
      bIdx % 2 === 0 ? 'EFATÁ SOCCER 26' : 'EFATÁ GAMESTUDIO',
      rx + step * 0.5,
      wallY + 9.5
    );
  }
  ctx.textAlign = 'left';

  // Silhuetas animadas de torcedores da primeira fila do anel inferior vibrando
  const fanRowY = wallY + 18;
  if (fanRowY < CANVAS_H + 6) {
    const ex = engine.crowdExcitement;
    for (let sx = 6; sx < CANVAS_W; sx += 16) {
      const seed = (sx * 13) % 73;
      const pal = sx < midX ? engine.homeClub.crowdColors : engine.awayClub.crowdColors;
      const bounce = Math.max(0, Math.sin(t * (5.5 + ex * 11) + seed)) * (1.8 + ex * 5);
      const fy = snap(fanRowY - bounce);
      ctx.fillStyle = '#050811';
      ctx.beginPath();
      ctx.roundRect(sx - 5, fy, 10, 12, 3);
      ctx.fill();
      ctx.fillStyle = pal[seed % pal.length];
      ctx.fillRect(sx - 4, fy + 2, 8, 8);
      ctx.fillStyle = '#070b14';
      ctx.beginPath();
      ctx.arc(sx, fy - 2.5, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPitchAndLines(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  textures: TextureCache,
  scaleX: number,
  scaleY: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const fl = snap(toScreenX(FIELD_LEFT));
  const fr = snap(toScreenX(FIELD_RIGHT));
  const ft = snap(toScreenY(FIELD_TOP));
  const fb = snap(toScreenY(FIELD_BOTTOM));

  // 20 faixas verticais com textura real de grama cortada para o campo ampliado (2200x1160)
  const stripeCount = 20;
  const stripeWorldW = (FIELD_RIGHT - FIELD_LEFT) / stripeCount;

  ctx.save();
  ctx.beginPath();
  ctx.rect(fl, ft, fr - fl, fb - ft);
  ctx.clip();

  const originX = snap(toScreenX(FIELD_LEFT));
  const originY = snap(toScreenY(FIELD_TOP));

  for (let i = 0; i < stripeCount; i++) {
    const sx1 = snap(toScreenX(FIELD_LEFT + i * stripeWorldW));
    const sx2 = snap(toScreenX(FIELD_LEFT + (i + 1) * stripeWorldW));
    ctx.save();
    ctx.translate(originX, originY);
    ctx.fillStyle = (i % 2 === 0 ? textures.turfLight : textures.turfDark) ?? '#2f913e';
    ctx.fillRect(sx1 - originX, ft - originY, sx2 - sx1 + 2, fb - ft);
    ctx.restore();
  }

  // Faixas horizontais bem sutis de corte cruzado (efeito arena profissional)
  const hStripes = 6;
  const hStep = (fb - ft) / hStripes;
  for (let j = 0; j < hStripes; j++) {
    if (j % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
      ctx.fillRect(fl, snap(ft + j * hStep), fr - fl, snap(hStep));
    }
  }

  // Desgaste realista de gramado nas pequenas áreas e círculo central
  const drawWornPatch = (wx: number, wy: number, rx: number, ry: number, alpha = 0.14) => {
    const px = toScreenX(wx);
    const py = toScreenY(wy);
    const grad = ctx.createRadialGradient(px, py, 2, px, py, rx);
    grad.addColorStop(0, `rgba(148, 122, 70, ${alpha})`);
    grad.addColorStop(1, 'rgba(148, 122, 70, 0)');
    ctx.fillStyle = grad;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawWornPatch(FIELD_LEFT + 30, FIELD_CENTER_Y, 52, 78, 0.2);
  drawWornPatch(FIELD_RIGHT - 30, FIELD_CENTER_Y, 52, 78, 0.2);
  drawWornPatch(FIELD_LEFT + 268, FIELD_CENTER_Y, 18, 14, 0.14);
  drawWornPatch(FIELD_RIGHT - 268, FIELD_CENTER_Y, 18, 14, 0.14);
  drawWornPatch(FIELD_CENTER_X, FIELD_CENTER_Y, 68, 54, 0.09);

  // Adaptação visual do gramado ao clima (Neve gelada / Chuva molhada / Sol vibrante)
  if (engine.weather === 'NEVE') {
    ctx.fillStyle = 'rgba(230, 242, 255, 0.28)';
    ctx.fillRect(fl, ft, fr - fl, fb - ft);
  } else if (engine.weather === 'CHUVA') {
    ctx.fillStyle = 'rgba(12, 42, 68, 0.16)';
    ctx.fillRect(fl, ft, fr - fl, fb - ft);
  }

  // Reflexo sutil dos refletores / luz solar no centro do gramado
  const turfSheen = ctx.createRadialGradient(
    toScreenX(FIELD_CENTER_X),
    toScreenY(FIELD_CENTER_Y - 60),
    30,
    toScreenX(FIELD_CENTER_X),
    toScreenY(FIELD_CENTER_Y),
    Math.max(fr - fl, 400) * 0.52
  );
  turfSheen.addColorStop(
    0,
    engine.timeOfDay === 'DIA' && engine.weather === 'SOL'
      ? 'rgba(255, 250, 195, 0.12)'
      : 'rgba(255, 255, 220, 0.075)'
  );
  turfSheen.addColorStop(0.6, 'rgba(255, 255, 220, 0.02)');
  turfSheen.addColorStop(1, 'rgba(0, 20, 8, 0.11)');
  ctx.fillStyle = turfSheen;
  ctx.fillRect(fl, ft, fr - fl, fb - ft);

  // Pintura no gramado do círculo central: "EFATA GAMESTUDIO" arredondado seguindo o círculo do meio-campo!
  drawCenterCircleEfataLogo(
    ctx,
    toScreenX(FIELD_CENTER_X),
    toScreenY(FIELD_CENTER_Y),
    144 * scaleX,
    144 * scaleY
  );
  ctx.restore();

  // Áreas técnicas pontilhadas em frente aos bancos de reservas (fora da linha lateral superior)
  ctx.save();
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 3]);
  const techTop = snap(toScreenY(FIELD_TOP - 22));
  const techH = Math.max(8, snap(toScreenY(FIELD_TOP - 4) - techTop));
  ctx.strokeRect(snap(toScreenX(FIELD_CENTER_X - 200)), techTop, snap(105 * scaleX), techH);
  ctx.strokeRect(snap(toScreenX(FIELD_CENTER_X + 95)), techTop, snap(105 * scaleX), techH);
  ctx.restore();

  // Linhas brancas de cal com leve sombra abaixo para contraste nítido
  const drawLines = (strokeColor: string, offsetY: number, width: number) => {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width;
    ctx.strokeRect(fl, ft + offsetY, fr - fl, fb - ft);

    const cx = snap(toScreenX(FIELD_CENTER_X));
    const cy = snap(toScreenY(FIELD_CENTER_Y)) + offsetY;
    ctx.beginPath();
    ctx.moveTo(cx, ft + offsetY);
    ctx.lineTo(cx, fb + offsetY);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy, snap(144 * scaleX), snap(144 * scaleY), 0, 0, Math.PI * 2);
    ctx.stroke();

    // Grandes áreas
    const penW = snap(PENALTY_W * scaleX);
    const penTop = snap(toScreenY(FIELD_CENTER_Y - PENALTY_HALF_H)) + offsetY;
    const penBot = snap(toScreenY(FIELD_CENTER_Y + PENALTY_HALF_H)) + offsetY;
    ctx.strokeRect(fl, penTop, penW, penBot - penTop);
    ctx.strokeRect(fr - penW, penTop, penW, penBot - penTop);

    // Pequenas áreas
    const gbW = snap(GOALBOX_W * scaleX);
    const gbTop = snap(toScreenY(FIELD_CENTER_Y - GOALBOX_HALF_H)) + offsetY;
    const gbBot = snap(toScreenY(FIELD_CENTER_Y + GOALBOX_HALF_H)) + offsetY;
    ctx.strokeRect(fl, gbTop, gbW, gbBot - gbTop);
    ctx.strokeRect(fr - gbW, gbTop, gbW, gbBot - gbTop);

    // Meia-luas da área (proporcionais ao campo 3600x2120 com PENALTY_W = 390)
    const lpX = snap(toScreenX(FIELD_LEFT + 268));
    const rpX = snap(toScreenX(FIELD_RIGHT - 268));
    ctx.beginPath();
    ctx.ellipse(lpX, cy, snap(146 * scaleX), snap(146 * scaleY), 0, -0.58, 0.58);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(
      rpX,
      cy,
      snap(146 * scaleX),
      snap(146 * scaleY),
      0,
      Math.PI - 0.58,
      Math.PI + 0.58
    );
    ctx.stroke();

    // Arcos de escanteio
    const crX = snap(32 * scaleX);
    const crY = snap(32 * scaleY);
    ctx.beginPath();
    ctx.ellipse(fl, ft + offsetY, crX, crY, 0, 0, Math.PI * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(fr, ft + offsetY, crX, crY, 0, Math.PI * 0.5, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(fl, fb + offsetY, crX, crY, 0, -Math.PI * 0.5, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(fr, fb + offsetY, crX, crY, 0, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  };

  drawLines('rgba(0, 35, 10, 0.28)', 2, 3);
  drawLines(engine.weather === 'NEVE' ? '#ffffff' : '#f8fafc', 0, 2.5);

  // Marcas centrais e de pênalti (alinhadas às meias-luas)
  const cx = snap(toScreenX(FIELD_CENTER_X));
  const cy = snap(toScreenY(FIELD_CENTER_Y));
  const lpX = snap(toScreenX(FIELD_LEFT + 268));
  const rpX = snap(toScreenX(FIELD_RIGHT - 268));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 3, cy - 2, 6, 4);
  ctx.fillRect(lpX - 3, cy - 2, 5, 4);
  ctx.fillRect(rpX - 2, cy - 2, 5, 4);
}

// Pintura curva no gramado: "EFATA" no arco superior e "GAMESTUDIO" no arco inferior do círculo central
function drawCenterCircleEfataLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): void {
  if (rx < 28 || ry < 20) return;

  ctx.save();
  // Faixa circular interna bem sutil de corte de grama contrastado
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = Math.max(1.2, ry * 0.025);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();

  const textRx = rx * 0.84;
  const textRy = ry * 0.84;
  const fontSize = Math.max(9, Math.min(18, Math.round(rx * 0.165)));

  const drawCurvedArcText = (text: string, isBottom: boolean, spanRad: number) => {
    const chars = text.split('');
    const count = chars.length;
    ctx.font = `900 ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? i / (count - 1) - 0.5 : 0;
      const theta = isBottom
        ? Math.PI * 0.5 - frac * spanRad
        : -Math.PI * 0.5 + frac * spanRad;

      const gx = cx + Math.cos(theta) * textRx;
      const gy = cy + Math.sin(theta) * textRy;
      // Tangente exata da elipse em perspectiva para acompanhar o círculo central
      const dx = -Math.sin(theta) * textRx;
      const dy = Math.cos(theta) * textRy;
      const tangentAngle = Math.atan2(dy, dx) + (isBottom ? Math.PI : 0);

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(tangentAngle);
      // Sombra suave pintada na grama
      ctx.fillStyle = 'rgba(10, 42, 16, 0.48)';
      ctx.fillText(chars[i], 1, 1.4);
      // Tinta branca de gramado (nitidez sem atrapalhar a bola)
      ctx.fillStyle = 'rgba(248, 250, 252, 0.56)';
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }
  };

  drawCurvedArcText('EFATA', false, 1.32);
  drawCurvedArcText('GAMESTUDIO', true, 2.06);

  // Pequenas estrelas laterais acompanhando o anel do círculo central
  const starSize = Math.max(2, rx * 0.032);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.beginPath();
  ctx.arc(cx - textRx, cy, starSize, 0, Math.PI * 2);
  ctx.arc(cx + textRx, cy, starSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function getNetRippleOffset(engine: SoccerEngine, side: 'left' | 'right', worldY: number): number {
  let offset = 0;
  for (const r of engine.netRipples) {
    if (r.side !== side) continue;
    const distY = Math.abs(worldY - r.impactY);
    const influence = Math.max(0, 1 - distY / (GOAL_HALF_H * 1.4));
    offset += Math.sin(r.phase) * r.amplitude * 1.35 * influence;
  }
  return offset;
}

function drawGoalBack(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  side: 'left' | 'right',
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const lineX = side === 'left' ? FIELD_LEFT : FIELD_RIGHT;
  const backX = side === 'left' ? FIELD_LEFT - GOAL_DEPTH : FIELD_RIGHT + GOAL_DEPTH;
  const stanchionX = side === 'left' ? backX - 11 : backX + 11;
  const dir = side === 'left' ? -1 : 1;

  const topGroundY = toScreenY(GOAL_TOP, 0);
  const botGroundY = toScreenY(GOAL_BOTTOM, 0);
  const topBarY = toScreenY(GOAL_TOP, CROSSBAR_Z);
  const botBarY = toScreenY(GOAL_BOTTOM, CROSSBAR_Z);

  const sxLine = toScreenX(lineX);
  const sxBack = toScreenX(backX);
  const sxStanchion = toScreenX(stanchionX);

  // 1. Profundidade de sombra interna do gol + sombra direcional das traves/travessão no gramado
  const depthGrad = ctx.createLinearGradient(sxLine, 0, sxBack, 0);
  depthGrad.addColorStop(0, 'rgba(6, 15, 10, 0.14)');
  depthGrad.addColorStop(0.65, 'rgba(5, 12, 9, 0.34)');
  depthGrad.addColorStop(1, 'rgba(3, 8, 6, 0.44)');
  ctx.fillStyle = depthGrad;
  ctx.fillRect(
    Math.min(sxLine, sxBack),
    snap(topGroundY),
    Math.abs(sxBack - sxLine),
    snap(botGroundY - topGroundY)
  );

  // Sombra projetada dos postes e travessão pelos refletores (ângulo diagonal inferior-direito)
  const postShX = 24;
  const postShY = 12;
  ctx.save();
  ctx.strokeStyle = 'rgba(4, 14, 8, 0.28)';
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sxLine, topGroundY);
  ctx.lineTo(sxLine + postShX, topGroundY + postShY);
  ctx.lineTo(sxLine + postShX, botGroundY + postShY);
  ctx.lineTo(sxLine, botGroundY);
  ctx.stroke();
  ctx.restore();

  // 2. Base metálica de ancoragem no chão (barra de ferro inferior da rede)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sxLine, topGroundY);
  ctx.lineTo(sxBack, topGroundY);
  ctx.lineTo(sxBack, botGroundY);
  ctx.lineTo(sxLine, botGroundY);
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(sxLine, topGroundY);
  ctx.lineTo(sxBack, topGroundY);
  ctx.lineTo(sxBack, botGroundY);
  ctx.lineTo(sxLine, botGroundY);
  ctx.stroke();

  // 3. Escoras metálicas traseiras estilo estádio europeu/brasileiro + cabos de tensão
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(sxStanchion, topGroundY - 3);
  ctx.lineTo(sxStanchion, topBarY - 6);
  ctx.moveTo(sxStanchion, botGroundY + 3);
  ctx.lineTo(sxStanchion, botBarY - 6);
  ctx.stroke();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(sxStanchion, topGroundY - 3);
  ctx.lineTo(sxStanchion, topBarY - 6);
  ctx.moveTo(sxStanchion, botGroundY + 3);
  ctx.lineTo(sxStanchion, botBarY - 6);
  ctx.stroke();

  // Cabos de aço tensionando a rede traseira nos postes de sustentação
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.72)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sxStanchion, topBarY - 5);
  ctx.lineTo(sxBack, topBarY);
  ctx.moveTo(sxStanchion, botBarY - 5);
  ctx.lineTo(sxBack, botBarY);
  ctx.moveTo(sxStanchion, topBarY - 5);
  ctx.lineTo(sxLine, topBarY);
  ctx.moveTo(sxStanchion, botBarY - 5);
  ctx.lineTo(sxLine, botBarY);
  ctx.stroke();

  // Base de fixação no solo das escoras
  ctx.fillStyle = '#334155';
  ctx.fillRect(snap(sxStanchion - 3), snap(topGroundY - 5), 6, 4);
  ctx.fillRect(snap(sxStanchion - 3), snap(botGroundY + 1), 6, 4);

  // 4. Rede traseira ultra-detalhada em malha fina para o gol ampliado (sombra + fios de náilon + losangos)
  const hSegs = 20;
  const zSegs = 10;

  const drawBackNetPass = (color: string, width: number, offsetX: number, offsetY: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    // Fios verticais seguindo a ondulação do gol
    for (let i = 0; i <= hSegs; i++) {
      const wy = GOAL_TOP + ((GOAL_BOTTOM - GOAL_TOP) * i) / hSegs;
      const ripple = getNetRippleOffset(engine, side, wy) * dir;
      ctx.beginPath();
      for (let j = 0; j <= zSegs; j++) {
        const fracZ = j / zSegs;
        const z = CROSSBAR_Z * fracZ;
        const sag = Math.sin(fracZ * Math.PI) * 2.2 * dir;
        const px = sxBack + ripple * (0.45 + 0.55 * fracZ) + sag + offsetX;
        const py = toScreenY(wy, z) + offsetY;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Fios horizontais com curvatura natural
    for (let j = 0; j <= zSegs; j++) {
      const fracZ = j / zSegs;
      const z = CROSSBAR_Z * fracZ;
      const sag = Math.sin(fracZ * Math.PI) * 2.2 * dir;
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const wy = GOAL_TOP + ((GOAL_BOTTOM - GOAL_TOP) * s) / 12;
        const ripple = getNetRippleOffset(engine, side, wy) * dir * (0.45 + 0.55 * fracZ);
        const px = sxBack + ripple + sag + offsetX;
        const py = toScreenY(wy, z) + offsetY;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Trama diagonal sutil estilo rede hexagonal/losangular de estádio
    for (let i = 0; i < hSegs; i += 2) {
      const wy0 = GOAL_TOP + ((GOAL_BOTTOM - GOAL_TOP) * i) / hSegs;
      const wy1 = GOAL_TOP + ((GOAL_BOTTOM - GOAL_TOP) * Math.min(hSegs, i + 2)) / hSegs;
      const r0 = getNetRippleOffset(engine, side, wy0) * dir * 0.72;
      const r1 = getNetRippleOffset(engine, side, wy1) * dir * 0.72;
      ctx.beginPath();
      ctx.moveTo(sxBack + r0 + offsetX, toScreenY(wy0, CROSSBAR_Z) + offsetY);
      ctx.lineTo(sxBack + r1 + offsetX, toScreenY(wy1, 0) + offsetY);
      ctx.stroke();
    }
  };

  drawBackNetPass('rgba(15, 23, 42, 0.32)', 1.3, 0.8, 0.8);
  drawBackNetPass('rgba(241, 245, 249, 0.76)', 0.95, 0, 0);

  // 5. Redes laterais (superior e inferior do gol) com malha cruzada
  const sideDepthSegs = 5;
  const sideZSegs = 6;
  ctx.lineWidth = 0.9;
  for (const wallY of [GOAL_TOP, GOAL_BOTTOM]) {
    const rWall = getNetRippleOffset(engine, side, wallY) * dir * 0.5;
    // Linhas verticais laterais
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.64)';
    for (let d = 1; d <= sideDepthSegs; d++) {
      const t = d / (sideDepthSegs + 1);
      const mx = sxLine + (sxBack - sxLine) * t + rWall * t;
      ctx.beginPath();
      ctx.moveTo(mx, toScreenY(wallY, CROSSBAR_Z));
      ctx.lineTo(mx, toScreenY(wallY, 0));
      ctx.stroke();
    }
    // Linhas horizontais laterais
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.58)';
    for (let j = 1; j < sideZSegs; j++) {
      const z = (CROSSBAR_Z * j) / sideZSegs;
      const yZ = toScreenY(wallY, z);
      ctx.beginPath();
      ctx.moveTo(sxLine, yZ);
      ctx.lineTo(sxBack + rWall, yZ);
      ctx.stroke();
    }
  }
}

function drawGoalFront(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  side: 'left' | 'right',
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const lineX = side === 'left' ? FIELD_LEFT : FIELD_RIGHT;
  const backX = side === 'left' ? FIELD_LEFT - GOAL_DEPTH : FIELD_RIGHT + GOAL_DEPTH;
  const dir = side === 'left' ? -1 : 1;

  const sxLine = snap(toScreenX(lineX));
  const sxBack = snap(toScreenX(backX));
  const topGroundY = snap(toScreenY(GOAL_TOP, 0));
  const botGroundY = snap(toScreenY(GOAL_BOTTOM, 0));
  const topBarY = snap(toScreenY(GOAL_TOP, CROSSBAR_Z));
  const botBarY = snap(toScreenY(GOAL_BOTTOM, CROSSBAR_Z));

  // 1. Rede superior (teto do gol ampliado) com trama detalhada e efeito de balanço
  const roofLines = 18;
  ctx.lineWidth = 0.95;
  for (let i = 1; i < roofLines; i++) {
    const wy = GOAL_TOP + ((GOAL_BOTTOM - GOAL_TOP) * i) / roofLines;
    const ripple = getNetRippleOffset(engine, side, wy) * dir * 0.85;
    const yBar = toScreenY(wy, CROSSBAR_Z);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.moveTo(sxLine, yBar + 0.8);
    ctx.lineTo(sxBack + ripple, yBar + 0.8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.68)';
    ctx.beginPath();
    ctx.moveTo(sxLine, yBar);
    ctx.lineTo(sxBack + ripple, yBar);
    ctx.stroke();
  }

  // Fios transversais do teto da rede
  for (let d = 1; d <= 4; d++) {
    const t = d / 5;
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.56)';
    ctx.beginPath();
    for (let s = 0; s <= 10; s++) {
      const wy = GOAL_TOP + ((GOAL_BOTTOM - GOAL_TOP) * s) / 10;
      const ripple = getNetRippleOffset(engine, side, wy) * dir * 0.85 * t;
      const mx = sxLine + (sxBack - sxLine) * t + ripple;
      const my = toScreenY(wy, CROSSBAR_Z);
      if (s === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.stroke();
  }

  // Barra superior traseira que sustenta o teto da rede
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(sxLine, topBarY);
  ctx.lineTo(sxBack, topBarY);
  ctx.lineTo(sxBack, botBarY);
  ctx.lineTo(sxLine, botBarY);
  ctx.stroke();

  // 2. Sapatas metálicas de fixação no chão das duas traves
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(sxLine - 4, topGroundY - 2, 8, 4);
  ctx.fillRect(sxLine - 4, botGroundY - 2, 8, 4);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(sxLine - 3, topGroundY - 1, 6, 2);
  ctx.fillRect(sxLine - 3, botGroundY - 1, 6, 2);

  // 3. Travessão e postes cilíndricos 3D com sombreamento metálico multi-camada
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Contorno externo escuro das traves cilíndricas reforçadas
  ctx.lineWidth = 8.4;
  ctx.strokeStyle = '#090d16';
  ctx.beginPath();
  ctx.moveTo(sxLine, topGroundY);
  ctx.lineTo(sxLine, topBarY);
  ctx.lineTo(sxLine, botBarY);
  ctx.lineTo(sxLine, botGroundY);
  ctx.stroke();

  // Sombra cilíndrica metálica
  ctx.lineWidth = 6.0;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(sxLine + 0.5, topGroundY);
  ctx.lineTo(sxLine + 0.5, topBarY);
  ctx.lineTo(sxLine + 0.5, botBarY);
  ctx.lineTo(sxLine + 0.5, botGroundY);
  ctx.stroke();

  // Corpo branco perolado
  ctx.lineWidth = 4.4;
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(sxLine - 0.3, topGroundY);
  ctx.lineTo(sxLine - 0.3, topBarY);
  ctx.lineTo(sxLine - 0.3, botBarY);
  ctx.lineTo(sxLine - 0.3, botGroundY);
  ctx.stroke();

  // Reflexo especular nítido do alumínio pintado de branco
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(sxLine - 1.3, topGroundY);
  ctx.lineTo(sxLine - 1.3, topBarY);
  ctx.lineTo(sxLine - 1.3, botBarY);
  ctx.lineTo(sxLine - 1.3, botGroundY);
  ctx.stroke();

  // 4. Cantoneiras reforçadas nos ângulos (forquilhas) do gol
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(sxLine, topBarY, 3.9, 0, Math.PI * 2);
  ctx.arc(sxLine, botBarY, 3.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sxLine - 0.6, topBarY - 0.4, 2.3, 0, Math.PI * 2);
  ctx.arc(sxLine - 0.6, botBarY - 0.4, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // 5. Ganchos / presilhas metálicas que prendem a rede ao longo do travessão e postes
  ctx.fillStyle = '#475569';
  const clipCount = 11;
  for (let i = 1; i < clipCount; i++) {
    const cy = topBarY + ((botBarY - topBarY) * i) / clipCount;
    ctx.fillRect(sxLine + dir * 2.4, snap(cy) - 1, 2.2, 1.8);
  }
  for (let p = 1; p <= 4; p++) {
    const pyTop = topBarY + ((topGroundY - topBarY) * p) / 5;
    const pyBot = botBarY + ((botGroundY - botBarY) * p) / 5;
    ctx.fillRect(sxLine + dir * 2.2, snap(pyTop), 2.2, 1.6);
    ctx.fillRect(sxLine + dir * 2.2, snap(pyBot), 2.2, 1.6);
  }
}

function drawCornerFlags(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const corners = [
    [FIELD_LEFT, FIELD_TOP],
    [FIELD_RIGHT, FIELD_TOP],
    [FIELD_LEFT, FIELD_BOTTOM],
    [FIELD_RIGHT, FIELD_BOTTOM],
  ];
  const wave = Math.round(Math.sin(engine.animTime * 8) * 2.5);
  for (const [cx, cy] of corners) {
    const sx = snap(toScreenX(cx));
    const sy = snap(toScreenY(cy));
    // Sombra direcional longa da haste e da bandeirinha no gramado
    ctx.strokeStyle = 'rgba(4, 15, 8, 0.34)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 14, sy + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(4, 15, 8, 0.24)';
    ctx.fillRect(sx + 10, sy + 4, 7, 3);
    // Haste branca
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx - 1, sy - 18, 3, 18);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx, sy - 18, 1, 18);
    // Bandeirinha xadrez vibrante
    ctx.fillStyle = '#facc15';
    ctx.fillRect(sx + 1, sy - 18, 8, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(sx + 5, sy - 17 + (wave > 0 ? 1 : 0), 5, 4);
  }
}

function drawGoalConfetti(ctx: CanvasRenderingContext2D, engine: SoccerEngine): void {
  const colors = [
    ...engine.homeClub.crowdColors,
    ...engine.awayClub.crowdColors,
    '#facc15',
    '#ffffff',
  ];
  const t = engine.animTime;
  for (let i = 0; i < 48; i++) {
    const px = ((i * 83 + t * (90 + (i % 5) * 28)) % (CANVAS_W + 40)) - 20;
    const py = ((i * 57 + t * (120 + (i % 4) * 35)) % (CANVAS_H + 30)) - 15;
    ctx.fillStyle = colors[i % colors.length];
    const w = i % 2 === 0 ? 5 : 4;
    const h = i % 3 === 0 ? 3 : 5;
    ctx.fillRect(snap(px), snap(py), w, h);
  }
}

function drawGoalFireworks(ctx: CanvasRenderingContext2D, engine: SoccerEngine): void {
  ctx.save();

  // Clarão luminoso no topo do estádio quando um foguete estoura!
  if (engine.fireworkFlash > 0.01) {
    const flashGrad = ctx.createRadialGradient(
      CANVAS_W * 0.5,
      CANVAS_H * 0.16,
      20,
      CANVAS_W * 0.5,
      CANVAS_H * 0.25,
      CANVAS_W * 0.62
    );
    flashGrad.addColorStop(0, `rgba(254, 249, 195, ${engine.fireworkFlash * 0.34})`);
    flashGrad.addColorStop(1, 'rgba(254, 249, 195, 0)');
    ctx.fillStyle = flashGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.65);
  }

  // Foguetes subindo com rastro brilhante
  for (const r of engine.fireworkRockets) {
    if (r.trail.length > 1) {
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < r.trail.length; i++) {
        const pt = r.trail[i];
        const sx = pt.x * CANVAS_W;
        const sy = pt.y * CANVAS_H;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    const rx = r.x * CANVAS_W;
    const ry = r.y * CANVAS_H;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Explosões de faíscas coloridas cintilantes!
  for (const sp of engine.fireworkSparks) {
    const alpha = Math.max(0, Math.min(1, sp.life / sp.maxLife));
    const flicker = 0.65 + 0.35 * Math.sin(sp.twinkle);
    const sx = sp.x * CANVAS_W;
    const sy = sp.y * CANVAS_H;
    const rad = sp.size * (0.45 + alpha * 0.55);

    // Halo colorido
    ctx.globalAlpha = alpha * flicker * 0.42;
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 2.3, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo brilhante
    ctx.globalAlpha = alpha * flicker;
    ctx.fillStyle = alpha > 0.65 ? '#ffffff' : sp.color;
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWeatherEffects(ctx: CanvasRenderingContext2D, engine: SoccerEngine): void {
  const t = engine.animTime;

  if (engine.weather === 'SOL') {
    if (engine.timeOfDay === 'DIA') {
      // Raios solares diagonais dourados suaves no topo direito
      ctx.save();
      const sunGrad = ctx.createRadialGradient(
        CANVAS_W * 0.88,
        -20,
        15,
        CANVAS_W * 0.86,
        30,
        CANVAS_W * 0.55
      );
      sunGrad.addColorStop(0, 'rgba(254, 243, 199, 0.22)');
      sunGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.07)');
      sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
    return;
  }

  if (engine.weather === 'CHUVA') {
    ctx.save();
    // Atmosfera nublada de chuva
    ctx.fillStyle =
      engine.timeOfDay === 'NOITE' ? 'rgba(10, 22, 46, 0.22)' : 'rgba(51, 78, 104, 0.16)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Gotas inclinadas em 2 camadas de velocidade
    ctx.strokeStyle =
      engine.timeOfDay === 'NOITE' ? 'rgba(186, 230, 253, 0.42)' : 'rgba(224, 242, 254, 0.48)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const layer = i % 2;
      const speedY = layer === 0 ? 740 : 520;
      const windX = layer === 0 ? -145 : -100;
      const len = layer === 0 ? 15 : 10;
      const rx = ((i * 73.1 + t * windX + 40000) % (CANVAS_W + 80)) - 40;
      const ry = ((i * 41.7 + t * speedY) % (CANVAS_H + 40)) - 20;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - len * 0.22, ry + len);
    }
    ctx.stroke();

    // Respingos sutis batendo no gramado molhado
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.32)';
    ctx.lineWidth = 1;
    for (let s = 0; s < 26; s++) {
      const cycle = (t * 2.6 + s * 0.37) % 1;
      const sx = ((s * 137 + Math.floor(t * 2.6 + s * 0.37) * 59) % (CANVAS_W - 60)) + 30;
      const sy = ((s * 89 + Math.floor(t * 2.6 + s * 0.37) * 31) % (CANVAS_H - 120)) + 95;
      const r = 1.5 + cycle * 4.5;
      ctx.globalAlpha = (1 - cycle) * 0.45;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (engine.weather === 'NEVE') {
    ctx.save();
    // Véu frio de inverno
    ctx.fillStyle =
      engine.timeOfDay === 'NOITE' ? 'rgba(186, 215, 255, 0.10)' : 'rgba(226, 240, 255, 0.14)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Flocos de neve em 3 tamanhos com balanço senoidal do vento
    for (let i = 0; i < 120; i++) {
      const depth = i % 3;
      const speedY = 42 + depth * 26;
      const driftX = Math.sin(t * (1.2 + depth * 0.4) + i * 0.9) * (16 + depth * 8);
      const sx = ((i * 89.3 + t * (-18 - depth * 8) + driftX + 40000) % (CANVAS_W + 30)) - 15;
      const sy = ((i * 53.7 + t * speedY) % (CANVAS_H + 20)) - 10;
      const radius = depth === 0 ? 1.4 : depth === 1 ? 2.2 : 3.0;
      ctx.globalAlpha = depth === 0 ? 0.55 : depth === 1 ? 0.78 : 0.92;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawStadiumLighting(ctx: CanvasRenderingContext2D, engine?: SoccerEngine): void {
  const isNight = engine ? engine.timeOfDay === 'NOITE' : true;
  ctx.save();

  if (isNight) {
    // Noite: vinheta profunda + cones suaves dos refletores no gramado!
    const rad = ctx.createRadialGradient(
      CANVAS_W * 0.5,
      CANVAS_H * 0.52,
      CANVAS_W * 0.18,
      CANVAS_W * 0.5,
      CANVAS_H * 0.5,
      CANVAS_W * 0.66
    );
    rad.addColorStop(0, 'rgba(255, 255, 235, 0.05)');
    rad.addColorStop(0.55, 'rgba(8, 18, 42, 0.14)');
    rad.addColorStop(1, 'rgba(3, 8, 22, 0.48)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Fachos diagonais dos refletores do estádio noturno
    for (const bx of [CANVAS_W * 0.22, CANVAS_W * 0.5, CANVAS_W * 0.78]) {
      const cone = ctx.createLinearGradient(bx, 0, bx, CANVAS_H * 0.65);
      cone.addColorStop(0, 'rgba(254, 249, 195, 0.08)');
      cone.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(bx - 16, 0);
      ctx.lineTo(bx + 16, 0);
      ctx.lineTo(bx + 130, CANVAS_H * 0.65);
      ctx.lineTo(bx - 130, CANVAS_H * 0.65);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Dia: iluminação clara e viva com leve moldura natural
    const rad = ctx.createRadialGradient(
      CANVAS_W * 0.5,
      CANVAS_H * 0.46,
      CANVAS_W * 0.30,
      CANVAS_W * 0.5,
      CANVAS_H * 0.5,
      CANVAS_W * 0.74
    );
    rad.addColorStop(0, 'rgba(255, 255, 240, 0.05)');
    rad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
    rad.addColorStop(1, 'rgba(10, 24, 42, 0.16)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  ctx.restore();
}

// --- SPRITES PIXEL ART DETALHADOS COM SOMBREAMENTO 16-BIT ---

function drawPatternedShirt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kit: Kit,
  isGK: boolean
): void {
  if (isGK) {
    ctx.fillStyle = kit.gkShirt;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y + 3, w, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(x + w - 2, y, 2, h);
    return;
  }

  ctx.fillStyle = kit.primary;
  ctx.fillRect(x, y, w, h);

  switch (kit.pattern) {
    case 'hoops':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x, y + 2, w, 3);
      ctx.fillRect(x, y + 7, w, 3);
      break;
    case 'stripes':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x + 2, y, 3, h);
      ctx.fillRect(x + 7, y, 3, h);
      break;
    case 'tricolor-v':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x + 2, y, 3, h);
      ctx.fillStyle = kit.tertiary ?? '#ffffff';
      ctx.fillRect(x + 5, y, 2, h);
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x + 7, y, 3, h);
      break;
    case 'tricolor-h':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x, y + 3, w, 3);
      ctx.fillStyle = kit.tertiary ?? '#ffffff';
      ctx.fillRect(x, y + 6, w, 2);
      break;
    case 'sash':
      ctx.fillStyle = kit.secondary;
      for (let i = 0; i < Math.min(w, h); i++) {
        ctx.fillRect(x + i, y + Math.floor((i * h) / w), 3, 2);
      }
      break;
    case 'chest-bands':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x, y + 3, w, 2);
      ctx.fillStyle = kit.tertiary ?? kit.secondary;
      ctx.fillRect(x, y + 6, w, 2);
      break;
    case 'chest-detail':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x, y, w, 3);
      if (kit.tertiary) {
        ctx.fillStyle = kit.tertiary;
        ctx.fillRect(x + 3, y + 4, w - 6, 3);
      }
      break;
    case 'solid':
      ctx.fillStyle = kit.secondary;
      ctx.fillRect(x + 3, y, w - 6, 2);
      break;
  }

  // Sombreamento volumétrico suave (luz de refletor à esquerda + dobra de tecido à direita)
  const shadeGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  shadeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
  shadeGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.03)');
  shadeGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.08)');
  shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(x, y, w, h);
}

// Helper para desenhar cápsula arredondada (pernas, braços, chuteiras e troncos anatômicos)
function fillCapsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
  ctx.fill();
}

type LikenessHair =
  | 'classic'
  | 'fade'
  | 'buzz'
  | 'curly'
  | 'mohawk'
  | 'braids'
  | 'wavy'
  | 'slick'
  | 'bald'
  | 'bleached_top';

type LikenessBeard = 'none' | 'stubble' | 'short_beard' | 'full_beard' | 'goatee' | 'mustache';

interface PlayerLikeness {
  hairStyle: LikenessHair;
  hairColor?: string;
  beard: LikenessBeard;
  headband?: string;
  eyeColor?: string;
  jawWidth?: number;
}

// Banco de traços reais dos principais astros do Brasileirão 2026
const PLAYER_LIKENESSES: Record<string, PlayerLikeness> = {
  neymar: { hairStyle: 'bleached_top', hairColor: '#e8d08a', beard: 'goatee', eyeColor: '#4b3621' },
  gabigol: { hairStyle: 'bleached_top', hairColor: '#e6dcc0', beard: 'short_beard', eyeColor: '#2b1f17' },
  memphis: { hairStyle: 'braids', hairColor: '#1a1512', beard: 'full_beard', headband: '#f8fafc', jawWidth: 1.06 },
  'memphis depay': { hairStyle: 'braids', hairColor: '#1a1512', beard: 'full_beard', headband: '#f8fafc', jawWidth: 1.06 },
  pedro: { hairStyle: 'slick', hairColor: '#1c1816', beard: 'short_beard', jawWidth: 1.04 },
  arrascaeta: { hairStyle: 'wavy', hairColor: '#4a3323', beard: 'stubble', eyeColor: '#3b4d38' },
  'lucas paqueta': { hairStyle: 'fade', hairColor: '#1b1715', beard: 'stubble' },
  paqueta: { hairStyle: 'fade', hairColor: '#1b1715', beard: 'stubble' },
  jorginho: { hairStyle: 'classic', hairColor: '#3d2c1e', beard: 'short_beard' },
  rossi: { hairStyle: 'slick', hairColor: '#2d2219', beard: 'full_beard' },
  'leo ortiz': { hairStyle: 'wavy', hairColor: '#3a281d', beard: 'short_beard' },
  'gustavo gomez': { hairStyle: 'buzz', hairColor: '#1c1816', beard: 'full_beard', jawWidth: 1.08 },
  gomez: { hairStyle: 'buzz', hairColor: '#1c1816', beard: 'full_beard', jawWidth: 1.08 },
  'vitor roque': { hairStyle: 'fade', hairColor: '#181412', beard: 'none' },
  paulinho: { hairStyle: 'fade', hairColor: '#1a1512', beard: 'goatee' },
  'andreas pereira': { hairStyle: 'wavy', hairColor: '#6b4f32', beard: 'stubble', eyeColor: '#4b6b52' },
  piquerez: { hairStyle: 'wavy', hairColor: '#5c4228', beard: 'stubble' },
  'carlos miguel': { hairStyle: 'buzz', hairColor: '#1a1614', beard: 'short_beard', jawWidth: 1.08 },
  'yuri alberto': { hairStyle: 'fade', hairColor: '#5e432b', beard: 'stubble' },
  'rodrigo garro': { hairStyle: 'wavy', hairColor: '#3b2b1e', beard: 'short_beard' },
  garro: { hairStyle: 'wavy', hairColor: '#3b2b1e', beard: 'short_beard' },
  'jesse lingard': { hairStyle: 'fade', hairColor: '#161311', beard: 'goatee' },
  lingard: { hairStyle: 'fade', hairColor: '#161311', beard: 'goatee' },
  'hugo souza': { hairStyle: 'curly', hairColor: '#151210', beard: 'short_beard', jawWidth: 1.05 },
  'philippe coutinho': { hairStyle: 'classic', hairColor: '#261c15', beard: 'stubble' },
  coutinho: { hairStyle: 'classic', hairColor: '#261c15', beard: 'stubble' },
  cebolinha: { hairStyle: 'fade', hairColor: '#1c1714', beard: 'goatee' },
  'everton cebolinha': { hairStyle: 'fade', hairColor: '#1c1714', beard: 'goatee' },
  hulk: { hairStyle: 'buzz', hairColor: '#1a1614', beard: 'full_beard', jawWidth: 1.1 },
  scarpa: { hairStyle: 'wavy', hairColor: '#3f2e1f', beard: 'short_beard' },
  'gustavo scarpa': { hairStyle: 'wavy', hairColor: '#3f2e1f', beard: 'short_beard' },
  'lucas moura': { hairStyle: 'bald', hairColor: '#221c18', beard: 'short_beard' },
  calleri: { hairStyle: 'wavy', hairColor: '#2e2118', beard: 'full_beard' },
  luciano: { hairStyle: 'fade', hairColor: '#1c1714', beard: 'short_beard' },
  vegetti: { hairStyle: 'slick', hairColor: '#b79458', beard: 'full_beard', jawWidth: 1.06 },
  cassio: { hairStyle: 'wavy', hairColor: '#241c16', beard: 'full_beard', jawWidth: 1.08 },
  'matheus pereira': { hairStyle: 'fade', hairColor: '#261c15', beard: 'short_beard' },
  'thiago silva': { hairStyle: 'buzz', hairColor: '#1d1a18', beard: 'short_beard' },
  cano: { hairStyle: 'slick', hairColor: '#38291d', beard: 'full_beard' },
  arias: { hairStyle: 'fade', hairColor: '#171412', beard: 'stubble' },
  'alan patrick': { hairStyle: 'classic', hairColor: '#261c15', beard: 'stubble' },
  borre: { hairStyle: 'fade', hairColor: '#1a1512', beard: 'short_beard' },
  braithwaite: { hairStyle: 'buzz', hairColor: '#1c1816', beard: 'short_beard' },
  'everton ribeiro': { hairStyle: 'classic', hairColor: '#2c2119', beard: 'short_beard' },
  savarino: { hairStyle: 'mohawk', hairColor: '#1a1512', beard: 'goatee' },
  'igor jesus': { hairStyle: 'fade', hairColor: '#171412', beard: 'stubble' },
  viveros: { hairStyle: 'braids', hairColor: '#161311', beard: 'stubble' },
  'kevin viveros': { hairStyle: 'braids', hairColor: '#161311', beard: 'stubble' },
};

function normalizeLikenessKey(name?: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolvePlayerLikeness(name: string | undefined, hairStyleIdx: number): PlayerLikeness {
  const key = normalizeLikenessKey(name);
  if (key && PLAYER_LIKENESSES[key]) {
    return PLAYER_LIKENESSES[key];
  }
  // Busca parcial para nomes compostos (ex: "G. Gómez", "P. Coutinho")
  if (key) {
    for (const [k, v] of Object.entries(PLAYER_LIKENESSES)) {
      if (key.includes(k) || k.includes(key)) {
        return v;
      }
    }
  }
  // Fallback determinístico rico baseado no nome do jogador
  let hash = hairStyleIdx * 31;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33 + key.charCodeAt(i)) % 997;
  }
  const styles: LikenessHair[] = ['classic', 'fade', 'buzz', 'curly', 'wavy', 'slick', 'mohawk'];
  const beards: LikenessBeard[] = ['none', 'stubble', 'short_beard', 'goatee', 'none', 'full_beard'];
  return {
    hairStyle: styles[hash % styles.length],
    beard: beards[(hash >> 2) % beards.length],
    eyeColor: hash % 5 === 0 ? '#3b5a40' : '#261b14',
    jawWidth: 0.96 + (hash % 10) * 0.014,
  };
}

// Desenha cabeça realista detalhada com traços faciais (maxilar, nariz, olhos com íris, boca, barba e corte fiel ao jogador real)
function drawSculptedHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  skin: string,
  hair: string,
  facingX: number,
  hairStyle: number,
  isCelebrating = false,
  playerName?: string
): void {
  const likeness = resolvePlayerLikeness(playerName, hairStyle);
  const actualHair = likeness.hairColor ?? hair;
  const dir = facingX >= 0 ? 1 : -1;
  const lookOff = facingX > 0.22 ? 1.15 : facingX < -0.22 ? -1.15 : 0;
  const jaw = likeness.jawWidth ?? 1;

  // Pescoço anatômico com sombra sob o queixo
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, cx - 2.3, cy + 2.8, 4.6, 3.6, 1.5);
  ctx.fillStyle = skin;
  fillCapsule(ctx, cx - 1.7, cy + 3.0, 3.4, 3.0, 1.2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(cx - 1.6, cy + 3.1, 3.2, 1.1);

  // Orelha detalhada no lado oposto ao olhar
  const earX = cx - dir * 4.5 * jaw;
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(earX, cy + 0.1, 1.65, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(earX + dir * 0.15, cy + 0.1, 1.05, 1.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(60, 25, 10, 0.28)';
  ctx.fillRect(earX - 0.3, cy - 0.3, 0.7, 0.9);

  // Contorno esculpido da cabeça e linha do queixo/maxilar
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 0.6, 5.25 * jaw, 5.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Base de pele facial com formato anatômico (testa + bochechas + queixo)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 0.6, 4.4 * jaw, 4.75, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iluminação realista na testa e maçãs do rosto + contorno sombreado da mandíbula
  ctx.fillStyle = 'rgba(255, 250, 240, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx - 1.1, cy - 2.1, 2.2, 1.7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 120, 100, 0.14)';
  ctx.beginPath();
  ctx.ellipse(cx - 1.8 + lookOff * 0.4, cy + 0.7, 1.1, 0.7, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 1.8 + lookOff * 0.4, cy + 0.7, 1.1, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 2.0 * jaw, cy + 0.5, 1.7, 3.2, 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Barba / cavanhaque / bigode desenhados na anatomia do maxilar
  const beardColor = likeness.hairStyle === 'bleached_top' ? '#2c221b' : actualHair;
  if (likeness.beard === 'stubble') {
    ctx.fillStyle = 'rgba(25, 18, 14, 0.24)';
    ctx.beginPath();
    ctx.ellipse(cx + lookOff * 0.35, cy + 2.35, 3.3 * jaw, 1.85, 0, 0.1, Math.PI - 0.1);
    ctx.fill();
  } else if (likeness.beard === 'short_beard') {
    ctx.fillStyle = beardColor;
    ctx.globalAlpha = 0.74;
    ctx.beginPath();
    ctx.ellipse(cx + lookOff * 0.35, cy + 2.25, 3.65 * jaw, 2.15, 0, 0.05, Math.PI - 0.05);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (likeness.beard === 'full_beard') {
    ctx.fillStyle = beardColor;
    ctx.beginPath();
    ctx.ellipse(cx + lookOff * 0.35, cy + 2.3, 4.0 * jaw, 2.55, 0, -0.05, Math.PI + 0.05);
    ctx.fill();
    // Contorno mais escuro na ponta da barba
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(cx - 2.2 + lookOff * 0.4, cy + 3.7, 4.4, 0.9);
  } else if (likeness.beard === 'goatee') {
    ctx.fillStyle = beardColor;
    ctx.beginPath();
    ctx.ellipse(cx + lookOff * 0.55, cy + 2.95, 1.55, 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 1.2 + lookOff * 0.55, cy + 1.35, 2.4, 0.65);
  } else if (likeness.beard === 'mustache') {
    ctx.fillStyle = beardColor;
    ctx.fillRect(cx - 1.5 + lookOff * 0.55, cy + 1.25, 3.0, 0.8);
  }

  // Sobrancelhas expressivas arqueadas
  const ex1 = cx - 1.7 + lookOff;
  const ex2 = cx + 1.45 + lookOff;
  ctx.fillStyle = likeness.hairStyle === 'bleached_top' ? '#2c221b' : actualHair;
  ctx.fillRect(ex1 - 0.7, cy - 1.9, 2.0, 0.65);
  ctx.fillRect(ex2 - 0.5, cy - 1.9, 2.0, 0.65);

  // Olhos desenhados: pálpebra superior, esclera branca, íris colorida, pupila e ponto de brilho especular
  ctx.fillStyle = '#090d16';
  ctx.fillRect(ex1 - 0.5, cy - 1.15, 1.75, 0.45);
  ctx.fillRect(ex2 - 0.4, cy - 1.15, 1.75, 0.45);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(ex1 - 0.45, cy - 0.8, 1.6, 1.35);
  ctx.fillRect(ex2 - 0.35, cy - 0.8, 1.6, 1.35);
  ctx.fillStyle = likeness.eyeColor ?? '#261b14';
  ctx.fillRect(ex1 + (dir > 0 ? 0.1 : -0.2), cy - 0.7, 0.95, 1.2);
  ctx.fillRect(ex2 + (dir > 0 ? 0.1 : -0.2), cy - 0.7, 0.95, 1.2);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(ex1 + (dir > 0 ? 0.3 : -0.05), cy - 0.45, 0.55, 0.7);
  ctx.fillRect(ex2 + (dir > 0 ? 0.3 : -0.05), cy - 0.45, 0.55, 0.7);
  // Reflexo branco nos olhos (olhar vivo 16-bit HD)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ex1 + (dir > 0 ? 0.15 : -0.15), cy - 0.65, 0.35, 0.35);
  ctx.fillRect(ex2 + (dir > 0 ? 0.15 : -0.15), cy - 0.65, 0.35, 0.35);

  // Nariz esculpido com ponte luminosa e sombra suave na base
  const noseX = cx + lookOff * 0.85;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(noseX - 0.25, cy - 0.5, 0.55, 1.4);
  ctx.fillStyle = 'rgba(70, 30, 15, 0.38)';
  ctx.fillRect(noseX - 0.6, cy + 0.85, 1.3, 0.55);

  // Lábios / Boca expressiva
  if (isCelebrating) {
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(cx + lookOff * 0.6, cy + 2.25, 1.45, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dentes brancos no grito de gol
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 0.85 + lookOff * 0.6, cy + 1.6, 1.7, 0.55);
  } else {
    ctx.fillStyle = 'rgba(95, 38, 28, 0.72)';
    ctx.fillRect(cx - 0.95 + lookOff * 0.6, cy + 2.05, 2.0, 0.65);
    ctx.fillStyle = 'rgba(255, 210, 195, 0.28)';
    ctx.fillRect(cx - 0.65 + lookOff * 0.6, cy + 2.65, 1.3, 0.35);
  }

  // Cabelo esculpido com corte fiel ao atleta real
  const hStyle = likeness.hairStyle;
  ctx.fillStyle = actualHair;
  if (hStyle === 'classic') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3.7, 4.5 * jaw, 2.35, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    fillCapsule(ctx, cx - 4.3 * jaw, cy - 4.2, 8.6 * jaw, 2.1, 1.1);
    fillCapsule(ctx, dir >= 0 ? cx - 4.4 * jaw : cx + 2.4 * jaw, cy - 2.7, 2.0, 3.1, 0.8);
  } else if (hStyle === 'fade') {
    // Lateral baixa sombreada + topo texturizado moderno
    ctx.fillStyle = 'rgba(20, 16, 14, 0.45)';
    fillCapsule(ctx, dir >= 0 ? cx - 4.3 * jaw : cx + 2.7 * jaw, cy - 2.6, 1.5, 2.5, 0.6);
    ctx.fillStyle = actualHair;
    ctx.beginPath();
    ctx.ellipse(cx + dir * 0.35, cy - 4.3, 4.0 * jaw, 2.25, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hStyle === 'bleached_top') {
    // Lateral escura raspada + topo descolorido/platinado (Neymar / Gabigol)
    ctx.fillStyle = '#1f1916';
    fillCapsule(ctx, dir >= 0 ? cx - 4.3 * jaw : cx + 2.6 * jaw, cy - 2.8, 1.6, 2.6, 0.6);
    ctx.fillStyle = actualHair;
    ctx.beginPath();
    ctx.ellipse(cx + dir * 0.3, cy - 4.45, 3.85 * jaw, 2.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.fillRect(cx - 2.1, cy - 5.3, 3.6, 1.0);
  } else if (hStyle === 'buzz') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3.6, 4.15 * jaw, 1.75, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (hStyle === 'bald') {
    // Brilho natural na cabeça raspada (ex: Lucas Moura)
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - 1.0, cy - 3.6, 1.8, 0.9, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (hStyle === 'curly') {
    ctx.beginPath();
    ctx.arc(cx - 2.5, cy - 4.1, 2.2, 0, Math.PI * 2);
    ctx.arc(cx, cy - 4.8, 2.45, 0, Math.PI * 2);
    ctx.arc(cx + 2.5, cy - 4.1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    fillCapsule(ctx, dir >= 0 ? cx - 4.5 * jaw : cx + 2.2 * jaw, cy - 3.1, 2.2, 3.3, 0.9);
  } else if (hStyle === 'wavy') {
    // Cabelo ondulado com franja fluida (Arrascaeta, Garro, Calleri)
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4.1, 4.65 * jaw, 2.55, 0, Math.PI * 0.92, Math.PI * 2.08);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + dir * 1.4, cy - 3.4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    fillCapsule(ctx, dir >= 0 ? cx - 4.6 * jaw : cx + 2.4 * jaw, cy - 2.9, 2.1, 3.5, 0.9);
  } else if (hStyle === 'slick') {
    // Penteado para trás elegante (Pedro, Vegetti, Rossi)
    ctx.beginPath();
    ctx.ellipse(cx - dir * 0.35, cy - 4.2, 4.45 * jaw, 2.25, -dir * 0.14, 0, Math.PI * 2);
    ctx.fill();
    fillCapsule(ctx, dir >= 0 ? cx - 4.4 * jaw : cx + 2.4 * jaw, cy - 2.8, 1.9, 2.8, 0.8);
  } else if (hStyle === 'mohawk') {
    ctx.beginPath();
    ctx.ellipse(cx + dir * 0.2, cy - 5.1, 2.2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hStyle === 'braids') {
    // Tranças / dreads curtos (Memphis Depay, Kevin Viveros)
    for (let b = -3; b <= 3; b++) {
      fillCapsule(ctx, cx + b * 1.25 - 0.55, cy - 5.8 + Math.abs(b) * 0.28, 1.2, 3.1, 0.55);
    }
    fillCapsule(ctx, dir >= 0 ? cx - 4.5 * jaw : cx + 2.4 * jaw, cy - 3.1, 2.0, 3.4, 0.8);
  }

  // Faixa de cabeça (ex: Memphis Depay)
  if (likeness.headband) {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 4.4 * jaw, cy - 3.35, 8.8 * jaw, 1.6);
    ctx.fillStyle = likeness.headband;
    ctx.fillRect(cx - 4.2 * jaw, cy - 3.1, 8.4 * jaw, 1.1);
  }

  // Brilho suave no topo do cabelo
  if (hStyle !== 'bald' && hStyle !== 'bleached_top') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(cx - 2.0, cy - 4.9, 3.4, 0.9);
  }
}

// Desenha perna articulada ultra-detalhada (coxa musculosa, patela do joelho, caneleira sob o meião, esparadrapo no tornozelo e chuteira com língua, cadarço e travas)
function drawArticulatedLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  skin: string,
  sockColor: string,
  bootAccent: string,
  dir: number
): void {
  const dx = footX - hipX;
  const dy = footY - hipY;
  const legSpan = Math.hypot(dx, dy);
  // Flexão natural do joelho
  const flex = Math.max(0, 9.6 - legSpan) * 0.42 + Math.min(2.2, Math.abs(dx) * 0.16);
  const kneeX = hipX + dx * 0.47 + dir * (0.9 + flex);
  const kneeY = hipY + dy * 0.46 - flex * 0.25;

  // Coxa arredondada com contorno e volume muscular (quadríceps)
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 4.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.stroke();

  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.3;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.stroke();

  // Brilho muscular no quadríceps e patela do joelho
  ctx.strokeStyle = 'rgba(255, 250, 235, 0.28)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(hipX + dir * 0.4, hipY + 0.6);
  ctx.lineTo(kneeX + dir * 0.4, kneeY - 0.4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.arc(kneeX + dir * 0.45, kneeY, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Canela / Meião esportivo com relevo de caneleira e dobra superior
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY);
  ctx.lineTo(footX, footY + 1.4);
  ctx.stroke();

  ctx.strokeStyle = sockColor;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY + 0.4);
  ctx.lineTo(footX, footY + 1.4);
  ctx.stroke();

  // Volume da caneleira sob o meião (brilho frontal)
  const midShinX = (kneeX + footX) * 0.5 + dir * 0.4;
  const midShinY = (kneeY + footY) * 0.5 + 0.6;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(midShinX - 0.5, midShinY - 1.1, 1.0, 2.2);

  // Faixa dupla esportiva no topo do meião
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(kneeX - 1.5, kneeY + 0.2, 3.0, 0.9);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.fillRect(kneeX - 1.5, kneeY + 1.1, 3.0, 0.45);

  // Esparadrapo branco profissional no tornozelo (acima da chuteira)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(footX - 1.35, footY - 0.2, 2.7, 1.3);

  // Chuteira contornada angulada com língua, cadarço, friso e travas
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const bootTilt = Math.max(-0.42, Math.min(0.42, (shinAngle - Math.PI * 0.5) * 0.35));
  ctx.save();
  ctx.translate(footX, footY + 1.8);
  ctx.rotate(bootTilt);
  const bootLocalX = dir >= 0 ? -1.7 : -3.7;
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, bootLocalX - 0.6, -1.1, 6.5, 3.8, 1.4);
  ctx.fillStyle = '#18181b';
  fillCapsule(ctx, bootLocalX, -0.6, 5.3, 2.7, 1.1);
  // Língua e cadarço branco da chuteira
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(bootLocalX + (dir >= 0 ? 2.1 : 1.5), -1.0, 1.4, 0.7);
  // Friso lateral aerodinâmico na chuteira
  ctx.fillStyle = bootAccent;
  ctx.fillRect(bootLocalX + (dir >= 0 ? 1.5 : 0.8), 0.0, 2.5, 0.95);
  // 3 travas metálicas na sola
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(bootLocalX + 0.5, 1.85, 0.95, 0.85);
  ctx.fillRect(bootLocalX + 2.1, 1.85, 0.85, 0.85);
  ctx.fillRect(bootLocalX + 3.5, 1.85, 0.95, 0.85);
  ctx.restore();
}

function drawFieldPlayer(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  p: FieldPlayer,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const sx = snap(toScreenX(p.x));
  const sy = snap(toScreenY(p.y));
  if (sx < -80 || sx > CANVAS_W + 80 || sy < -90 || sy > CANVAS_H + 80) return;

  const kit = p.team === 'home' ? engine.homeKit : engine.awayKit;
  const isP1 = p.id === engine.p1SelectedId;
  const isP2 = engine.config.controlMode === '1P_2P' && p.id === engine.p2SelectedId;
  const isBallOwner = engine.ball.ownerId === p.id;
  const speed = Math.hypot(p.vx, p.vy);
  const isMoving = speed > 18;
  const isSprinting = speed > 215;
  const dir = p.facingX >= 0 ? 1 : -1;
  const hairStyle = p.number % 4;
  const bootAccent = p.number % 3 === 0 ? '#facc15' : p.number % 3 === 1 ? '#38bdf8' : '#f8fafc';

  // Animação de pulo na comemoração de gol, cabeçada aérea ou BICICLETA acrobática!
  const celebrateJump = p.celebrating
    ? Math.abs(Math.sin(engine.animTime * 11 + p.number * 0.7)) * 9.5
    : 0;
  const headerJump =
    p.headerAnimTimer > 0
      ? Math.sin((1 - p.headerAnimTimer / 0.42) * Math.PI) * 14.5
      : 0;
  const bicycleJump =
    p.bicycleAnimTimer > 0
      ? Math.sin((1 - p.bicycleAnimTimer / 0.66) * Math.PI) * 23.0
      : 0;
  const totalJump = celebrateJump + headerJump + bicycleJump;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(spriteScale, spriteScale);

  // Marcador de controle sob os pés (P1 amarelo ouro / P2 ciano)
  if (isP1 || isP2) {
    const ringColor = isP1 ? '#facc15' : '#38bdf8';
    ctx.strokeStyle = 'rgba(4, 9, 20, 0.72)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 6.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 6.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Seta discreta acima da cabeça
    const arrowY = -43 - totalJump + Math.round(Math.sin(engine.animTime * 9) * 1.5);
    ctx.fillStyle = '#040914';
    ctx.beginPath();
    ctx.moveTo(-4.8, arrowY);
    ctx.lineTo(4.8, arrowY);
    ctx.lineTo(0, arrowY + 5.6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = ringColor;
    ctx.beginPath();
    ctx.moveTo(-3.4, arrowY + 0.9);
    ctx.lineTo(3.4, arrowY + 0.9);
    ctx.lineTo(0, arrowY + 4.4);
    ctx.closePath();
    ctx.fill();
  }

  // Aura de força pulsando sob as chuteiras (verde TOQUE / azul CRUZ / amarelo-vermelho CHUTE)
  if (p.isCharging && p.chargePower > 0.04) {
    const pulseR = 11.5 + p.chargePower * 7.5;
    ctx.strokeStyle =
      p.chargeType === 'pass'
        ? 'rgba(34, 197, 94, 0.88)'
        : p.chargeType === 'cross'
          ? 'rgba(56, 189, 248, 0.90)'
          : p.chargePower > 0.8
            ? 'rgba(239, 68, 68, 0.88)'
            : 'rgba(250, 204, 21, 0.84)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 2, pulseR, pulseR * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Anel de impacto ao tomar bola (bote limpo)
  if (p.stealAnimTimer > 0) {
    const prog = 1 - p.stealAnimTimer / 0.28;
    ctx.strokeStyle = `rgba(45, 212, 191, ${Math.max(0, 0.9 - prog * 0.85)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(dir * 6, 1, 9 + prog * 11, 4.5 + prog * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Sombra realista dupla: sombra projetada pelos refletores (alongada diagonalmente) + sombra de contato sob as chuteiras
  const shadowShrink = Math.max(0.48, 1 - totalJump * 0.036);
  const wideShadow = p.diveTimer > 0 || p.tackleTimer > 0 || p.bicycleAnimTimer > 0;
  const jumpShiftX = totalJump * 0.48;
  const jumpShiftY = totalJump * 0.22;

  // Sombra direcional longa projetada pelos refletores do estádio
  ctx.fillStyle = `rgba(3, 12, 8, ${Math.max(0.12, 0.24 * shadowShrink)})`;
  ctx.beginPath();
  ctx.ellipse(
    7.5 + jumpShiftX,
    4.6 + jumpShiftY,
    (wideShadow ? 22 : 13.8) * shadowShrink,
    (wideShadow ? 5.6 : 4.8) * shadowShrink,
    0.26,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Sombra de contato nítida logo abaixo das chuteiras
  ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.18, 0.40 * shadowShrink)})`;
  ctx.beginPath();
  ctx.ellipse(0, 2, (wideShadow ? 14.5 : 7.8) * shadowShrink, 3.1 * shadowShrink, 0, 0, Math.PI * 2);
  ctx.fill();

  // Poeira e tufos de grama ao correr em sprint ou fazer corte brusco de direção!
  const velAlign = speed > 105 ? (p.vx * p.facingX + p.vy * p.facingY) / speed : 1;
  const isSharpCut = speed > 135 && velAlign < 0.72 && p.tackleTimer <= 0 && !p.celebrating;
  if ((isSprinting || isSharpCut) && p.tackleTimer <= 0 && !p.celebrating) {
    const dustPhase = Math.floor(engine.animTime * 18) % 2;
    ctx.fillStyle = isSharpCut ? 'rgba(241, 245, 249, 0.72)' : 'rgba(235, 248, 225, 0.58)';
    ctx.beginPath();
    ctx.arc(-p.facingX * 9, -2 - dustPhase, isSharpCut ? 2.6 : 2.0, 0, Math.PI * 2);
    ctx.arc(-p.facingX * 14.5, -3.8 + dustPhase, isSharpCut ? 2.0 : 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-p.facingX * 11, -1.5 - dustPhase * 2, 1.9, 1.9);
    if (isSharpCut) {
      ctx.fillRect(-p.facingX * 15, -5.2 + dustPhase, 1.8, 1.8);
    }
  }

  // Flash de espalmar bola forte do goleiro!
  if (p.role === 'GK' && p.gkNoCatchTimer > 0.36) {
    const pAlpha = Math.min(1, (p.gkNoCatchTimer - 0.36) / 0.24);
    ctx.strokeStyle = `rgba(254, 240, 138, ${pAlpha * 0.9})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(dir * 10, -18, 8 + (1 - pAlpha) * 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Caso 1: Goleiro saltando (ponte elástica detalhada com arco no ar, joelho dobrado e luvas de látex)
  if (p.role === 'GK' && p.diveTimer > 0) {
    const prog = Math.max(0, Math.min(1, 1 - p.diveTimer / 0.48));
    const diveArc = Math.sin(prog * Math.PI) * 11;
    const diveFace = Math.abs(p.diveDirX) > 0.25 ? (p.diveDirX >= 0 ? 1 : -1) : p.team === 'home' ? 1 : -1;
    const stretchY = p.diveDirY >= 0 ? 1 : -1;
    const tiltRad = diveFace * (stretchY * 0.22 - 0.1 * Math.cos(prog * Math.PI));

    // Sombra esticada no gramado sob o salto aéreo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 16.5, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tufos de grama e rastros cinéticos do impulso
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.beginPath();
    ctx.arc(-diveFace * 15, -3.5, 2.8, 0, Math.PI * 2);
    ctx.arc(-diveFace * 21, -6.0, 2.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-diveFace * 14, -7.5, 2.0, 2.0);
    ctx.fillRect(-diveFace * 19, -4.5, 1.8, 1.8);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-diveFace * 22, -13 - diveArc * 0.7);
    ctx.lineTo(-diveFace * 11, -13 - diveArc * 0.7);
    ctx.moveTo(-diveFace * 20, -8 - diveArc * 0.5);
    ctx.lineTo(-diveFace * 12, -8 - diveArc * 0.5);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -13 - diveArc);
    ctx.rotate(tiltRad);
    ctx.scale(diveFace, 1);

    // Perna traseira flexionada (impulso atlético) + perna frontal estendida
    drawArticulatedLeg(ctx, -6.5, 2.4, -15.5, 5.2, p.skin, kit.socks, '#facc15', -1);
    drawArticulatedLeg(ctx, -5.5, -1.6, -16.8, -0.4, p.skin, kit.socks, '#facc15', -1);

    // Braço de trás esticado no limite com manga acolchoada e luva de látex
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 5.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6.5, -4.2);
    ctx.lineTo(15.2, -6.2 + stretchY * 2.6);
    ctx.stroke();
    ctx.strokeStyle = kit.gkShirt;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(6.5, -4.2);
    ctx.lineTo(14.8, -6.0 + stretchY * 2.6);
    ctx.stroke();

    // Tronco esticado horizontalmente com gola, ombreiras e sombreamento
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, -9.8, -6.2, 20.4, 12.2, 4.6);
    ctx.fillStyle = kit.gkShirt;
    fillCapsule(ctx, -8.6, -5.0, 18.0, 9.8, 3.8);
    // Friso esportivo + brilho muscular no peito
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    fillCapsule(ctx, -7.8, -4.6, 16.4, 3.0, 1.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    fillCapsule(ctx, -7.8, 1.6, 16.4, 2.6, 1.2);
    // Ombreira / detalhe da manga
    ctx.fillStyle = kit.secondary;
    ctx.fillRect(4.2, -4.8, 2.4, 9.4);
    // Calção do goleiro
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, -9.6, -5.4, 7.6, 10.6, 2.8);
    ctx.fillStyle = kit.shorts;
    fillCapsule(ctx, -8.7, -4.5, 5.8, 8.8, 2.2);
    // Número nas costas/lateral
    ctx.font = 'bold 5px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(String(p.number), -1.5, 2.0);

    // Braço frontal totalmente estendido alcançando a bola
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 5.6;
    ctx.beginPath();
    ctx.moveTo(6.2, 1.6);
    ctx.lineTo(16.6, -1.2 + stretchY * 3.6);
    ctx.stroke();
    ctx.strokeStyle = kit.gkShirt;
    ctx.lineWidth = 3.7;
    ctx.beginPath();
    ctx.moveTo(6.2, 1.6);
    ctx.lineTo(16.0, -1.0 + stretchY * 3.6);
    ctx.stroke();

    // Função auxiliar local para desenhar cada luva profissional de látex com detalhes dos dedos e munhequeira
    const drawProGlove = (gx: number, gy: number) => {
      // Munhequeira / tira de velcro colorida
      ctx.fillStyle = '#090d16';
      fillCapsule(ctx, gx - 2.6, gy - 2.8, 3.4, 5.6, 1.2);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(gx - 2.0, gy - 2.2, 2.0, 4.4);
      // Palma branca acolchoada + dedos abertos
      ctx.fillStyle = '#090d16';
      fillCapsule(ctx, gx - 0.6, gy - 3.6, 7.2, 7.2, 2.8);
      ctx.fillStyle = '#ffffff';
      fillCapsule(ctx, gx + 0.2, gy - 2.8, 5.6, 5.6, 2.2);
      // Detalhe no dorso + divisórias dos dedos
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(gx + 0.6, gy - 1.6, 2.0, 3.2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(gx + 3.4, gy - 1.6);
      ctx.lineTo(gx + 5.4, gy - 1.6);
      ctx.moveTo(gx + 3.4, gy);
      ctx.lineTo(gx + 5.6, gy);
      ctx.moveTo(gx + 3.4, gy + 1.6);
      ctx.lineTo(gx + 5.4, gy + 1.6);
      ctx.stroke();
    };

    // Ambas as luvas abertas em defesa elástica!
    drawProGlove(14.5, -6.2 + stretchY * 2.6);
    drawProGlove(16.0, -1.0 + stretchY * 3.6);

    // Cabeça focada na bola com rosto detalhado
    drawSculptedHead(ctx, 8.2, -7.8, p.skin, p.hair, 1, hairStyle, false, p.name);

    ctx.restore();
    ctx.restore();
    return;
  }

  // Caso 2: Carrinho escorregando com poeira, grama e pernas articuladas simétricas (esq/dir)
  if (p.tackleTimer > 0) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.beginPath();
    ctx.arc(-dir * 14, -2.5, 3.6, 0, Math.PI * 2);
    ctx.arc(-dir * 20, -4.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-dir * 13, -8, 2, 2);
    ctx.fillRect(-dir * 19, -9, 2, 2);

    // Perna de apoio recolhida atrás + perna estendida à frente no carrinho
    drawArticulatedLeg(ctx, -dir * 1, -7.5, dir * 5.5, -2.5, p.skin, kit.socks, bootAccent, dir);
    drawArticulatedLeg(ctx, dir * 2.5, -8.5, dir * 14.5, -4.0, p.skin, kit.socks, bootAccent, dir);

    // Tronco inclinado simétrico para direita ou esquerda
    const bodyLeft = dir > 0 ? -11.5 : -9.5;
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, bodyLeft, -16, 21, 11.5, 4.5);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bodyLeft + 1.3, -14.8, 18.4, 9.2, 3.5);
    ctx.clip();
    drawPatternedShirt(ctx, bodyLeft + 1.3, -14.8, 18.4, 9.2, kit, false);
    ctx.restore();
    ctx.fillStyle = kit.shorts;
    fillCapsule(ctx, dir > 0 ? 0.5 : -8.2, -14.2, 7.8, 7.8, 2.4);

    drawSculptedHead(ctx, -dir * 10.5, -16.5, p.skin, p.hair, dir, hairStyle, false, p.name);
    ctx.restore();
    return;
  }

  // Caso 2B: BICICLETA ACROBÁTICA NO AR (jogador invertido de cabeça para baixo pedalando no ar!)
  if (p.bicycleAnimTimer > 0) {
    const prog = Math.max(0, Math.min(1, 1 - p.bicycleAnimTimer / 0.66));
    const scissorSwing = Math.sin(prog * Math.PI);

    // Rastro de impacto luminoso da bicicleta (arco dourado + ciano no ar!)
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.94)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(
      dir * 4,
      -26 - bicycleJump * 0.75,
      14.5,
      dir > 0 ? -Math.PI * 0.85 : -Math.PI * 0.15,
      dir > 0 ? Math.PI * 0.15 : -Math.PI * 1.15,
      dir < 0
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(
      dir * 4,
      -26 - bicycleJump * 0.75,
      11.0,
      dir > 0 ? -Math.PI * 0.78 : -Math.PI * 0.22,
      dir > 0 ? Math.PI * 0.08 : -Math.PI * 1.08,
      dir < 0
    );
    ctx.stroke();

    // Faíscas estelares no ponto do chute acrobático!
    const sparkX = dir * 11;
    const sparkY = -36 - bicycleJump * 0.8;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(sparkX - 1.5, sparkY - 4.5, 3, 9);
    ctx.fillRect(sparkX - 4.5, sparkY - 1.5, 9, 3);
    ctx.restore();

    ctx.save();
    ctx.translate(0, -18 - bicycleJump);
    // Gira o corpo para trás no ar (~135 graus invertido!)
    const backflipAngle = -dir * (1.85 + scissorSwing * 0.45);
    ctx.rotate(backflipAngle);

    // Perna de apoio dobrada na tesoura + perna de chute chicoteando para o alto!
    drawArticulatedLeg(
      ctx,
      -2.5,
      -9.5,
      -dir * (5.5 + scissorSwing * 4.0),
      -1.5 + scissorSwing * 3.0,
      p.skin,
      kit.socks,
      bootAccent,
      -dir
    );
    drawArticulatedLeg(
      ctx,
      2.5,
      -10.5,
      dir * (8.5 + scissorSwing * 6.5),
      -11.5 - scissorSwing * 5.0,
      p.skin,
      kit.socks,
      '#facc15',
      dir
    );

    // Calção no ar
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, -6.8, -14.8, 13.6, 6.8, 2.2);
    ctx.fillStyle = kit.shorts;
    fillCapsule(ctx, -5.8, -14.0, 11.6, 5.2, 1.8);

    // Tronco arqueado na bicicleta
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, -7.2, -26.8, 14.4, 13.6, 3.6);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-6.2, -26.0, 12.4, 12.0, 2.8);
    ctx.clip();
    drawPatternedShirt(ctx, -6.2, -26.0, 12.4, 12.0, kit, false);
    ctx.restore();

    // Braços abertos equilibrando o voo acrobático
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6.2, -23.0);
    ctx.lineTo(-13.5, -18.5);
    ctx.moveTo(6.2, -23.0);
    ctx.lineTo(13.5, -18.5);
    ctx.stroke();
    ctx.strokeStyle = p.skin;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-6.2, -23.0);
    ctx.lineTo(-13.5, -18.5);
    ctx.moveTo(6.2, -23.0);
    ctx.lineTo(13.5, -18.5);
    ctx.stroke();

    // Cabeça invertida olhando para a bola
    drawSculptedHead(ctx, 0, -31.5, p.skin, p.hair, dir, hairStyle, true, p.name);
    ctx.restore();
    ctx.restore();

    // Etiqueta dourada vibrante "BICICLETA!!" acima do jogador!
    ctx.font = 'bold 8.5px monospace';
    ctx.textAlign = 'center';
    const bikeLabel = '★ BICICLETA!! ★';
    const bw = ctx.measureText(bikeLabel).width + 10;
    const bTagY = snap(sy - (64 + bicycleJump * 0.7) * spriteScale);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(snap(sx - bw / 2), bTagY, snap(bw), 12);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(snap(sx - bw / 2), bTagY, snap(bw), 12);
    ctx.fillStyle = '#fde047';
    ctx.fillText(bikeLabel, sx, bTagY + 9);
    ctx.textAlign = 'left';
    return;
  }

  // Caso 3: Jogador em pé / correndo / chutando / tocando / tomando bola / comemorando
  // Passada contínua em cadência real (p.animTimer completa 1 ciclo a cada 6 unidades -> Math.PI / 3 rad/u)
  const speedRatio = isMoving ? Math.min(1.22, speed / 205) : 0;
  const runPhase = p.animTimer * (Math.PI / 3) + p.number * 0.45;
  const horizFactor = Math.max(0.45, Math.abs(p.facingX));
  const stride = isMoving ? Math.sin(runPhase) * 5.6 * horizFactor * speedRatio : 0;
  const vertStride = isMoving ? Math.sin(runPhase) * 2.2 * p.facingY * speedRatio : 0;
  const leftFootLift = isMoving ? -Math.max(0, Math.cos(runPhase)) * 3.2 * speedRatio : 0;
  const rightFootLift = isMoving ? -Math.max(0, -Math.cos(runPhase)) * 3.2 * speedRatio : 0;

  // Distância da bola para postura de prontidão do goleiro
  const ballDistToGk = p.role === 'GK' ? Math.hypot(engine.ball.x - p.x, engine.ball.y - p.y) : 9999;
  const isGkAlert = p.role === 'GK' && ballDistToGk < 480 && !p.celebrating && p.stunTimer <= 0;

  let bob = isMoving
    ? -Math.abs(Math.sin(runPhase)) * (isSprinting ? 2.05 : 1.3) * Math.min(1, speedRatio)
    : Math.sin(engine.animTime * 4.2 + p.number) * 0.35;

  if (p.role === 'GK' && !isMoving && !p.celebrating) {
    bob = isGkAlert ? 2.1 + Math.sin(engine.animTime * 9.5) * 0.95 : Math.sin(engine.animTime * 6.5) * 0.9;
  }

  let leanX = 0;
  if (isSprinting && !p.celebrating) leanX = dir * 2.75;
  else if (isMoving && !p.celebrating) leanX = dir * (1.25 * Math.min(1, speedRatio));
  else if (isGkAlert) leanX = dir * 1.1;

  if (p.stunTimer > 0) {
    leanX += Math.sin(engine.animTime * 34) * (p.role === 'GK' ? 3.2 : 1.9);
    if (p.role === 'GK') bob += 2.2;
  }

  // Animação de Pedalada / Elástico / Giro (ginga rápida de corpo e pés!)
  let skillFootL = 0;
  let skillFootR = 0;
  let skillLiftL = 0;
  let skillLiftR = 0;
  if (p.skillMoveTimer > 0) {
    const wave = Math.sin(engine.animTime * 44);
    const cosWave = Math.cos(engine.animTime * 44);
    if (p.skillMoveType === 'pedalada') {
      skillFootL = wave * 5.2;
      skillFootR = -wave * 5.2;
      skillLiftL = Math.max(0, wave) * -3.6;
      skillLiftR = Math.max(0, -wave) * -3.6;
      leanX += wave * 2.4;
    } else if (p.skillMoveType === 'elastico') {
      skillFootR = dir * (4.8 + wave * 3.8);
      skillLiftR = -2.2;
      leanX += cosWave * 3.0;
    } else {
      // Giro 360° (roleta)
      skillFootL = cosWave * 4.6;
      skillFootR = -cosWave * 4.6;
      skillLiftL = -1.8;
      leanX += wave * 2.8;
    }
  }

  let kickLegOffsetX = 0;
  let kickLegOffsetY = 0;
  let lungeX = 0;
  let raiseBackArm = false;
  const isGkRush = p.role === 'GK' && p.gkRushActive;
  const raiseBothArms = p.celebrating || p.stunTimer > 0;

  if (p.headerAnimTimer > 0) {
    const hSwing = Math.sin((p.headerAnimTimer / 0.42) * Math.PI);
    leanX = dir * (4.4 * hSwing);
    raiseBackArm = true;
  } else if (p.isCharging) {
    kickLegOffsetX = -dir * (3.4 + p.chargePower * 4.2);
    kickLegOffsetY = -1.8 - p.chargePower * 1.1;
    leanX = -dir * (1.5 + p.chargePower * 0.9);
    raiseBackArm = true;
  } else if (p.kickAnimTimer > 0 && p.kickType === 'shot') {
    const swing = Math.sin((p.kickAnimTimer / 0.36) * Math.PI);
    kickLegOffsetX = dir * (7.4 * swing);
    kickLegOffsetY = -4.3 * swing;
    leanX = dir * (2.8 * swing + 0.8);
    raiseBackArm = true;
  } else if (p.passAnimTimer > 0) {
    const dur = p.kickType === 'lob' || p.kickType === 'cross' ? 0.34 : 0.26;
    const swing = Math.sin((p.passAnimTimer / dur) * Math.PI);
    if (p.kickType === 'cross') {
      // Cruzamento com efeito / trivela ampla
      kickLegOffsetX = dir * (7.0 * swing);
      kickLegOffsetY = -4.4 * swing;
      leanX = -dir * 2.2;
      raiseBackArm = true;
    } else if (p.kickType === 'lob') {
      kickLegOffsetX = dir * (5.8 * swing);
      kickLegOffsetY = -4.8 * swing;
      leanX = -dir * 1.8;
      raiseBackArm = true;
    } else {
      kickLegOffsetX = dir * (5.4 * swing);
      kickLegOffsetY = -1.8 * swing;
      leanX = dir * 1.4;
    }
  } else if (p.stealAnimTimer > 0) {
    const lunge = Math.sin((p.stealAnimTimer / 0.28) * Math.PI);
    lungeX = dir * (4.8 * lunge);
    kickLegOffsetX = dir * (6.8 * lunge);
    kickLegOffsetY = -1.5 * lunge;
    leanX = dir * 3.0;
    bob += 1.5 * lunge;
  } else if (isGkRush) {
    // Goleiro saindo do gol para abafar o chute (postura baixa e pronta)
    bob += 1.9;
    leanX = dir * 2.1;
  }

  const baseY = -totalJump;

  // Efeitos visuais de pedalada / drible mágico nos pés
  if (p.skillMoveTimer > 0) {
    const spin = engine.animTime * 18;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.92)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(dir * 5, baseY - 2.5, 11.5, 4.6, 0, spin, spin + Math.PI * 1.35);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(dir * 5, baseY - 2.5, 8.2, 3.2, 0, -spin, -spin + Math.PI * 1.15);
    ctx.stroke();
  }

  // Efeitos visuais de impacto de chute / cruzamento com curva / lançamento / passe / cabeçada
  if (p.headerAnimTimer > 0.16) {
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(dir * 7, baseY - 32, 6.8, dir > 0 ? -0.85 : Math.PI - 0.85, dir > 0 ? 0.85 : Math.PI + 0.85);
    ctx.stroke();
  } else if (p.kickAnimTimer > 0.16 && p.kickType === 'shot') {
    const fx = dir * 10.5;
    const fy = -3;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + dir * 7.5, fy - 4.2);
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + dir * 8.5, fy);
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + dir * 6.5, fy + 4.2);
    ctx.stroke();
  } else if (p.passAnimTimer > 0.1 && p.kickType === 'cross') {
    // Arco de efeito no cruzamento para a área
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(dir * 8, -7, 8.2, dir > 0 ? -1.45 : Math.PI - 0.2, dir > 0 ? 0.25 : Math.PI + 1.45);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(dir * 8, -7, 5.4, dir > 0 ? -1.2 : Math.PI - 0.1, dir > 0 ? 0.15 : Math.PI + 1.2);
    ctx.stroke();
  } else if (p.passAnimTimer > 0.12 && p.kickType === 'lob') {
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(dir * 7, -5, 6.2, dir > 0 ? -1.2 : Math.PI - 0.5, dir > 0 ? 0.3 : Math.PI + 1.2);
    ctx.stroke();
  } else if (p.passAnimTimer > 0.12 && p.kickType === 'pass') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(dir * 7, -2, 5.2, -0.7, 0.7);
    ctx.stroke();
  }

  // --- PERNAS ARTICULADAS, MEIÕES COM FAIXA E CHUTEIRAS ESCULPIDAS ---
  // Perna de chute/passe/desarme sempre aplicada à perna dianteira (simétrica para esquerda/direita)
  // e perna de trás desenhada antes da perna da frente para perspectiva anatômica limpa
  const hipSway = isMoving ? Math.sin(runPhase) * 0.75 * Math.min(1, speedRatio) : 0;
  const hipX = leanX * 0.45 + lungeX * 0.5 + hipSway;
  const hipY = baseY - 11.5 + bob;
  const gkStanceSpread = isGkRush ? 2.1 : isGkAlert && !isMoving ? 1.8 : 0;
  const lKickX = dir < 0 ? kickLegOffsetX : 0;
  const rKickX = dir >= 0 ? kickLegOffsetX : 0;
  const lKickY = dir < 0 ? kickLegOffsetY : 0;
  const rKickY = dir >= 0 ? kickLegOffsetY : 0;
  const lFootX = -3.6 + stride + lKickX + lungeX * (dir < 0 ? 0.6 : 0.38) + skillFootL - gkStanceSpread;
  const rFootX = 3.6 - stride + rKickX + lungeX * (dir >= 0 ? 0.6 : 0.38) + skillFootR + gkStanceSpread;
  const lFootY = baseY - 3.6 + leftFootLift + vertStride + lKickY + skillLiftL;
  const rFootY = baseY - 3.6 + rightFootLift - vertStride + rKickY + skillLiftR;

  if (dir >= 0) {
    drawArticulatedLeg(ctx, hipX - 3.2, hipY, lFootX, lFootY, p.skin, kit.socks, bootAccent, dir);
    drawArticulatedLeg(ctx, hipX + 3.2, hipY, rFootX, rFootY, p.skin, kit.socks, bootAccent, dir);
  } else {
    drawArticulatedLeg(ctx, hipX + 3.2, hipY, rFootX, rFootY, p.skin, kit.socks, bootAccent, dir);
    drawArticulatedLeg(ctx, hipX - 3.2, hipY, lFootX, lFootY, p.skin, kit.socks, bootAccent, dir);
  }

  // --- CALÇÃO ESPORTIVO COM FRISO LATERAL E SOMBRA ---
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, hipX - 7.0, baseY - 15.8 + bob, 14.0, 6.8, 2.2);
  ctx.fillStyle = kit.shorts;
  fillCapsule(ctx, hipX - 6.0, baseY - 15.0 + bob, 12.0, 5.2, 1.8);
  // Divisória central do calção + listra lateral esportiva
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(hipX - 0.5, baseY - 11.6 + bob, 1.0, 2.0);
  ctx.fillRect(hipX + 3.0, baseY - 14.8 + bob, 2.8, 4.8);
  ctx.fillStyle = kit.secondary;
  ctx.fillRect(hipX - 5.6, baseY - 14.6 + bob, 1.2, 4.4);

  // --- BRAÇO DE TRÁS ---
  const torsoX = leanX + lungeX * 0.65;
  const torsoY = baseY - 27.5 + bob;
  const armSwing = isMoving ? Math.sin(runPhase) * (isSprinting ? 4.3 : 2.5) * Math.min(1.1, speedRatio) : 0;
  const sleeveColor = p.role === 'GK' ? kit.gkShirt : kit.primary;

  const drawArm = (side: -1 | 1, raised: boolean, pump = 0) => {
    const shX = torsoX + side * 6.4;
    const shY = torsoY + 2.4;
    const swingDir = side < 0 ? armSwing : -armSwing;
    let elX = raised ? shX + side * 2.5 : shX + side * 1.45 + swingDir * 0.36;
    let elY = raised ? shY - 4.2 + pump : shY + 3.5 + swingDir * 0.45;
    let hdX = raised ? elX + side * 1.2 : elX + side * 0.75 + swingDir * 0.52 + (isMoving ? dir * 1.1 : 0);
    let hdY = raised
      ? elY - 4.2 + pump
      : elY + 3.5 + swingDir * 0.32 - (isSprinting ? 1.4 : 0) + (p.role === 'GK' && !isMoving ? -3.2 : 0);

    // Goleiro saindo do gol abafando: braços bem abertos em postura de parede ("estrela")
    if (isGkRush) {
      elX = shX + side * 4.5;
      elY = shY + 0.5;
      hdX = elX + side * 3.9;
      hdY = elY - 1.5;
    } else if (isGkAlert && !isMoving && !raised) {
      // Postura de alerta: luvas prontas à frente do corpo esperando o chute
      elX = shX + side * 2.8;
      elY = shY + 2.5;
      hdX = elX + dir * 2.6 + side * 1.0;
      hdY = elY - 1.2;
    }

    // Manga arredondada com punho na cor secundária e braçadeira de capitão no camisa 10!
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elX, elY);
    ctx.stroke();

    ctx.strokeStyle = sleeveColor;
    ctx.lineWidth = 3.3;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elX, elY);
    ctx.stroke();

    // Punho da manga + Braçadeira de Capitão dourada no camisa 10 (braço esquerdo)
    const cuffX = shX + (elX - shX) * 0.82;
    const cuffY = shY + (elY - shY) * 0.82;
    ctx.fillStyle = kit.secondary;
    ctx.fillRect(cuffX - 1.1, cuffY - 0.6, 2.2, 1.1);
    if (p.number === 10 && side === -1) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(shX + (elX - shX) * 0.45 - 1.3, shY + (elY - shY) * 0.45 - 0.7, 2.6, 1.3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(shX + (elX - shX) * 0.45 - 1.1, shY + (elY - shY) * 0.45 - 0.2, 2.2, 0.35);
    }

    // Antebraço de pele com definição muscular e munhequeira esportiva branca
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3.7;
    ctx.beginPath();
    ctx.moveTo(elX, elY);
    ctx.lineTo(hdX, hdY);
    ctx.stroke();

    ctx.strokeStyle = p.skin;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(elX, elY);
    ctx.lineTo(hdX, hdY);
    ctx.stroke();

    if (p.role !== 'GK' && (p.number === 10 || p.number === 9 || p.number === 7 || p.number === 11)) {
      const wristX = elX + (hdX - elX) * 0.78;
      const wristY = elY + (hdY - elY) * 0.78;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(wristX - 0.9, wristY - 0.6, 1.8, 1.1);
    }

    // Mão ou Luva profissional acolchoada do goleiro
    if (p.role === 'GK') {
      const gloveR = isGkRush ? 3.2 : isGkAlert ? 2.8 : 2.6;
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(hdX, hdY, gloveR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hdX, hdY, gloveR - 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(hdX - 1.3, hdY - 1.2, 2.6, 0.9);
    } else {
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(hdX, hdY, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const pump = p.celebrating ? Math.sin(engine.animTime * 16) * 1.8 : p.stunTimer > 0 ? Math.sin(engine.animTime * 26) * 1.5 : 0;
  const leftUp = raiseBothArms || (raiseBackArm && dir > 0);
  const rightUp = raiseBothArms || (raiseBackArm && dir < 0);

  // Braço oposto à direção fica levemente atrás do tronco
  drawArm(dir > 0 ? -1 : 1, dir > 0 ? leftUp : rightUp, dir > 0 ? pump : -pump);

  // --- TRONCO ATLÉTICO / CAMISA COM PADRÃO DO CLUBE, GOLA V, DOBRAS DE TECIDO E NÚMERO ---
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, torsoX - 7.4, torsoY - 0.9, 14.8, 14.2, 3.7);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(torsoX - 6.4, torsoY, 12.8, 12.5, 2.9);
  ctx.clip();
  drawPatternedShirt(ctx, torsoX - 6.4, torsoY, 12.8, 12.5, kit, p.role === 'GK');
  // Dobras sutis de tecido e definição peitoral/dorsal
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(torsoX - 5.2, torsoY + 1.2, 1.4, 9.5);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(torsoX + 3.8, torsoY + 1.5, 1.5, 9.5);
  ctx.fillRect(torsoX - 3.2, torsoY + 10.6, 6.4, 0.9);
  ctx.restore();

  // Gola esportiva em V com borda + escudo detalhado no peito
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.moveTo(torsoX - 3.1, torsoY - 0.2);
  ctx.lineTo(torsoX + 3.1, torsoY - 0.2);
  ctx.lineTo(torsoX, torsoY + 3.1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = kit.secondary;
  ctx.beginPath();
  ctx.moveTo(torsoX - 2.5, torsoY);
  ctx.lineTo(torsoX + 2.5, torsoY);
  ctx.lineTo(torsoX, torsoY + 2.5);
  ctx.closePath();
  ctx.fill();

  // Escudo bordado no peito esquerdo com contorno dourado
  ctx.fillStyle = '#090d16';
  ctx.fillRect(torsoX + 1.9, torsoY + 2.1, 2.4, 2.6);
  ctx.fillStyle = kit.tertiary ?? '#facc15';
  ctx.fillRect(torsoX + 2.2, torsoY + 2.4, 1.8, 2.0);

  // Número nítido com contorno de alto contraste na camisa
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  const isLightShirt =
    kit.primary.toLowerCase() === '#ffffff' ||
    kit.primary.toLowerCase() === '#f8fafc' ||
    kit.primary.toLowerCase() === '#facc15';
  const numColor = isLightShirt ? '#0f172a' : '#ffffff';
  const numOutline = isLightShirt ? 'rgba(255,255,255,0.85)' : 'rgba(9,13,22,0.88)';
  ctx.fillStyle = numOutline;
  ctx.fillText(String(p.number), torsoX - 0.1, torsoY + 10.1);
  ctx.fillText(String(p.number), torsoX - 0.9, torsoY + 9.3);
  ctx.fillStyle = numColor;
  ctx.fillText(String(p.number), torsoX - 0.5, torsoY + 9.7);
  ctx.textAlign = 'left';

  // Braço frontal sobre o lado do tronco
  drawArm(dir > 0 ? 1 : -1, dir > 0 ? rightUp : leftUp, dir > 0 ? -pump : pump);

  // --- CABEÇA ESCULPIDA COM ROSTO REALISTA DO JOGADOR ---
  const headX = torsoX + (isSprinting ? dir * 0.9 : 0) + (p.headerAnimTimer > 0 ? dir * 2.1 : 0);
  const headY = torsoY - 5.4;
  drawSculptedHead(ctx, headX, headY, p.skin, p.hair, p.facingX, hairStyle, p.celebrating, p.name);

  // Estrelinhas girando quando o goleiro ou marcador cai no drible!
  if (p.stunTimer > 0.08) {
    const orbit = engine.animTime * 10;
    for (let s = 0; s < 3; s++) {
      const ang = orbit + (s * Math.PI * 2) / 3;
      const sxStar = headX + Math.cos(ang) * 7.2;
      const syStar = headY - 7.5 + Math.sin(ang) * 2.2;
      ctx.fillStyle = s % 2 === 0 ? '#facc15' : '#38bdf8';
      ctx.fillRect(sxStar - 1.1, syStar - 1.1, 2.2, 2.2);
    }
  }

  ctx.restore();

  // Etiqueta flutuante de Bicicleta Armada ou Pedalada / Elástico / Giro
  if (p.queuedBicycle) {
    const armLabel = '★ BICICLETA ARMADA! ★';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    const aw = ctx.measureText(armLabel).width + 8;
    const aTagY = snap(sy - 56 * spriteScale);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(snap(sx - aw / 2), aTagY, snap(aw), 11);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(snap(sx - aw / 2), aTagY, snap(aw), 11);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(armLabel, sx, aTagY + 8.5);
    ctx.textAlign = 'left';
  } else if (p.skillMoveTimer > 0) {
    const skillLabel =
      p.skillMoveType === 'pedalada'
        ? 'PEDALADA!'
        : p.skillMoveType === 'elastico'
        ? 'ELÁSTICO!'
        : 'GIRO!';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    const sw = ctx.measureText(skillLabel).width + 8;
    const sTagY = snap(sy - 56 * spriteScale);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(snap(sx - sw / 2), sTagY, snap(sw), 11);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.strokeRect(snap(sx - sw / 2), sTagY, snap(sw), 11);
    ctx.fillStyle = '#fde047';
    ctx.fillText(skillLabel, sx, sTagY + 8.5);
    ctx.textAlign = 'left';
  }

  // Barra de força flutuante colorida para TOQUE (verde), CRUZAMENTO (azul) e CHUTE (amarelo->vermelho)
  if (p.isCharging && p.chargePower > 0.02) {
    const bw = 36;
    const bx = snap(sx - bw / 2);
    const by = snap(sy - 51 * spriteScale);
    const barLabel =
      p.chargeType === 'pass' ? 'TOQUE' : p.chargeType === 'cross' ? 'CRUZ' : 'CHUTE';
    const barColor =
      p.chargeType === 'pass'
        ? p.chargePower < 0.7
          ? '#22c55e'
          : '#4ade80'
        : p.chargeType === 'cross'
          ? p.chargePower < 0.72
            ? '#38bdf8'
            : '#60a5fa'
          : p.chargePower < 0.55
            ? '#22c55e'
            : p.chargePower < 0.85
              ? '#facc15'
              : '#ef4444';

    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(4, 9, 20, 0.85)';
    ctx.fillRect(bx - 1, by - 9, bw + 2, 16);
    ctx.fillStyle = barColor;
    ctx.fillText(barLabel, sx, by - 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, bw, 5);
    const fillW = Math.max(2, Math.round(bw * p.chargePower));
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, fillW, 5);
    ctx.textAlign = 'left';
  }

  // Etiqueta discreta e compacta de nome sob o jogador ativo ou com a bola
  if (isP1 || isP2 || isBallOwner) {
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    const label = p.name.length > 10 ? p.name.slice(0, 10) : p.name;
    const tw = ctx.measureText(label).width + 5;
    const tagY = snap(sy + 8 * spriteScale);
    ctx.fillStyle = 'rgba(4, 9, 20, 0.7)';
    ctx.fillRect(snap(sx - tw / 2), tagY, snap(tw), 10);
    ctx.fillStyle = isP1 ? '#fde047' : isP2 ? '#7dd3fc' : '#ffffff';
    ctx.fillText(label, sx, tagY + 8);
    ctx.textAlign = 'left';
  }
}

// --- RENDERIZAÇÃO DO ÁRBITRO PRINCIPAL (JUIZ) ---
function drawReferee(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  ref: RefereeState,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const sx = snap(toScreenX(ref.x));
  const sy = snap(toScreenY(ref.y));
  if (sx < -60 || sx > CANVAS_W + 60 || sy < -70 || sy > CANVAS_H + 60) return;

  const speed = Math.hypot(ref.vx, ref.vy);
  const isMoving = speed > 14;
  const dir = ref.facingX >= 0 ? 1 : -1;
  const refPhase = ref.animTimer * (Math.PI / 3);
  const stride = isMoving ? Math.sin(refPhase) * 4.4 : 0;
  const lLift = isMoving ? -Math.max(0, Math.cos(refPhase)) * 2.1 : 0;
  const rLift = isMoving ? -Math.max(0, -Math.cos(refPhase)) * 2.1 : 0;
  const bob = isMoving ? -Math.abs(Math.sin(refPhase)) * 1.4 : 0;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(spriteScale * 0.96, spriteScale * 0.96);

  // Sombra direcional dos refletores + contato
  ctx.fillStyle = 'rgba(3, 12, 8, 0.24)';
  ctx.beginPath();
  ctx.ellipse(6.5, 4.2, 12.2, 4.4, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 7.6, 3.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas com meião preto + chuteiras pretas (passada fluida contínua)
  drawArticulatedLeg(ctx, -3, -11 + bob, -3.2 + stride, -3.5 + lLift, '#e8b994', '#111827', '#facc15', dir);
  drawArticulatedLeg(ctx, 3, -11 + bob, 3.2 - stride, -3.5 + rLift, '#e8b994', '#111827', '#facc15', dir);

  // Calção preto FIFA
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, -6.5, -15.5 + bob, 13, 6.4, 2);
  ctx.fillStyle = '#18181b';
  fillCapsule(ctx, -5.6, -14.7 + bob, 11.2, 4.8, 1.6);

  // Camisa oficial amarelo-limão com gola/bolsos pretos
  const torsoY = -27 + bob;
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, -6.8, torsoY - 0.8, 13.6, 13.2, 3.2);
  ctx.fillStyle = '#eab308';
  fillCapsule(ctx, -5.8, torsoY, 11.6, 11.6, 2.5);
  // Gola preta + bolsos frontais de cartão
  ctx.fillStyle = '#111827';
  ctx.fillRect(-2.4, torsoY, 4.8, 2.2);
  ctx.fillRect(-4.4, torsoY + 3.2, 2.8, 3.2);
  ctx.fillRect(1.6, torsoY + 3.2, 2.8, 3.2);
  // Sombreamento lateral
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(3.0, torsoY, 2.8, 11.4);

  // Braços (apontando bola parada ou erguendo cartão amarelo!)
  const pointing = ref.signalTimer > 0;
  const showingCard = ref.cardTimer > 0;

  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, torsoY + 2.5);
  ctx.lineTo(-8.5, torsoY + 7 + stride * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#e8b994';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6.8, torsoY + 4.5);
  ctx.lineTo(-8.5, torsoY + 7 + stride * 0.4);
  ctx.stroke();

  if (showingCard) {
    // Braço erguido mostrando CARTÃO AMARELO brilhante!
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(6, torsoY + 2.5);
    ctx.lineTo(8.5, torsoY - 8.5);
    ctx.stroke();
    ctx.strokeStyle = '#e8b994';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(6.6, torsoY + 0.5);
    ctx.lineTo(8.5, torsoY - 8.5);
    ctx.stroke();

    // Cartão Amarelo com halo pulsante
    ctx.fillStyle = '#090d16';
    ctx.fillRect(6.2, torsoY - 15.8, 5.6, 7.6);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(6.9, torsoY - 15.1, 4.2, 6.2);
  } else if (pointing) {
    // Braço esticado indicando a direção da cobrança
    const pDir = ref.signalDirX >= 0 ? 1 : -1;
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(pDir * 5.8, torsoY + 2.5);
    ctx.lineTo(pDir * 14.5, torsoY + 0.5);
    ctx.stroke();
    ctx.strokeStyle = '#e8b994';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pDir * 7.8, torsoY + 2.0);
    ctx.lineTo(pDir * 14.5, torsoY + 0.5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(6, torsoY + 2.5);
    ctx.lineTo(8.5, torsoY + 7 - stride * 0.4);
    ctx.stroke();
    ctx.strokeStyle = '#e8b994';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(6.8, torsoY + 4.5);
    ctx.lineTo(8.5, torsoY + 7 - stride * 0.4);
    ctx.stroke();
  }

  // Cabeça do Árbitro
  drawSculptedHead(ctx, 0, torsoY - 5.2, '#e8b994', '#334155', ref.facingX, 2, false);

  // Ondas sonoras do apito quando o juiz apita!
  if (ref.whistleTimer > 0) {
    const pulse = (Math.sin(engine.animTime * 28) + 1) * 0.5;
    ctx.strokeStyle = `rgba(254, 240, 138, ${0.55 + pulse * 0.45})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(dir * 5, torsoY - 3.5, 4.5 + pulse * 3, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dir * 5, torsoY - 3.5, 7.5 + pulse * 3, -0.7, 0.7);
    ctx.stroke();
  }

  ctx.restore();
}

// --- RENDERIZAÇÃO DOS BANDEIRINHAS (ÁRBITROS ASSISTENTES) ---
function drawLinesman(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  lm: LinesmanState,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const sx = snap(toScreenX(lm.x));
  const sy = snap(toScreenY(lm.y));
  if (sx < -60 || sx > CANVAS_W + 60 || sy < -70 || sy > CANVAS_H + 60) return;

  const isMoving = Math.abs(lm.vx) > 12;
  const lmPhase = lm.animTimer * (Math.PI / 3);
  const stride = isMoving ? Math.sin(lmPhase) * 4.0 : 0;
  const lLift = isMoving ? -Math.max(0, Math.cos(lmPhase)) * 1.9 : 0;
  const rLift = isMoving ? -Math.max(0, -Math.cos(lmPhase)) * 1.9 : 0;
  const bob = isMoving ? -Math.abs(Math.sin(lmPhase)) * 1.25 : 0;
  const dir = lm.facingX >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(spriteScale * 0.92, spriteScale * 0.92);

  // Sombra direcional dos refletores + contato
  ctx.fillStyle = 'rgba(3, 12, 8, 0.22)';
  ctx.beginPath();
  ctx.ellipse(6.0, 4.0, 11.2, 4.0, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 7.0, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas (passada fluida contínua)
  drawArticulatedLeg(ctx, -2.8, -10.5 + bob, -3 + stride, -3.5 + lLift, '#d9a17a', '#111827', '#facc15', dir);
  drawArticulatedLeg(ctx, 2.8, -10.5 + bob, 3 - stride, -3.5 + rLift, '#d9a17a', '#111827', '#facc15', dir);

  // Calção preto + camisa amarela de árbitro assistente
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, -6, -15 + bob, 12, 6, 2);
  ctx.fillStyle = '#18181b';
  fillCapsule(ctx, -5.2, -14.2 + bob, 10.4, 4.5, 1.5);

  const torsoY = -26 + bob;
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, -6.4, torsoY - 0.6, 12.8, 12.6, 3);
  ctx.fillStyle = '#facc15';
  fillCapsule(ctx, -5.5, torsoY, 11, 11.2, 2.4);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-2.2, torsoY, 4.4, 2.0);
  ctx.fillRect(-5.5, torsoY + 8.5, 11, 1.5);

  // Bandeira quadriculada amarelo/vermelho!
  const flagRaised = lm.flagRaisedTimer > 0;
  const wave = flagRaised ? Math.sin(engine.animTime * 22) * 2.4 : Math.sin(engine.animTime * 5) * 0.6;
  const fSide = flagRaised ? (lm.flagDirX >= 0 ? 1 : -1) : dir;

  const handX = fSide * 7.5;
  const handY = flagRaised ? torsoY - 6.5 : torsoY + 6.5;

  // Braço segurando a bandeira
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fSide * 5.2, torsoY + 2.5);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  ctx.strokeStyle = '#d9a17a';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(fSide * 6.0, torsoY + 1.5);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  // Haste + pano quadriculado amarelo e vermelho
  const tipX = flagRaised ? handX + fSide * 7.5 : handX + fSide * 5.5;
  const tipY = flagRaised ? handY - 9.5 + wave * 0.5 : handY + 5.5;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  const fx = tipX - (fSide < 0 ? 7.5 : 0);
  const fy = tipY - 1 + wave * 0.4;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(fx - 0.8, fy - 0.8, 9.2, 7.6);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(fx, fy, 3.8, 3.0);
  ctx.fillRect(fx + 3.8, fy + 3.0, 3.8, 3.0);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(fx + 3.8, fy, 3.8, 3.0);
  ctx.fillRect(fx, fy + 3.0, 3.8, 3.0);

  // Cabeça do Bandeirinha
  drawSculptedHead(ctx, 0, torsoY - 5, '#d9a17a', '#1e1b18', lm.facingX, lm.side === 'top' ? 0 : 1, false);

  ctx.restore();
}

// --- CAMERAMEN DE TV (TRIPÉ + STEADICAM LATERAL) E FOTÓGRAFOS ATRÁS DOS GOLS ---
function addCameramanDrawItems(
  items: Array<{ y: number; draw: () => void }>,
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  // 4 Cameramen de transmissão em tripé atrás das linhas de fundo
  const tripodSpots = [
    { x: FIELD_LEFT - 60, y: FIELD_TOP + 185, id: 1 },
    { x: FIELD_LEFT - 60, y: FIELD_BOTTOM - 185, id: 2 },
    { x: FIELD_RIGHT + 60, y: FIELD_TOP + 185, id: 3 },
    { x: FIELD_RIGHT + 60, y: FIELD_BOTTOM - 185, id: 4 },
  ];

  for (const spot of tripodSpots) {
    items.push({
      y: spot.y,
      draw: () =>
        drawTripodCameraman(
          ctx,
          engine,
          spot.x,
          spot.y,
          spot.id,
          spriteScale,
          toScreenX,
          toScreenY
        ),
    });
  }

  // 1 Operador de Steadicam acompanhando a bola pela lateral superior
  const steadyX = Math.max(
    FIELD_LEFT + 240,
    Math.min(FIELD_RIGHT - 240, engine.ball.x * 0.92 + FIELD_CENTER_X * 0.08)
  );
  const steadyY = FIELD_TOP - 28;
  items.push({
    y: steadyY,
    draw: () =>
      drawSteadicamOperator(
        ctx,
        engine,
        steadyX,
        steadyY,
        spriteScale,
        toScreenX,
        toScreenY
      ),
  });

  // 4 Fotógrafos esportivos sentados atrás dos gols com lentes teleobjetivas e flashes
  const photoSpots = [
    { x: FIELD_LEFT - 56, y: GOAL_TOP - 74, id: 10 },
    { x: FIELD_LEFT - 56, y: GOAL_BOTTOM + 74, id: 11 },
    { x: FIELD_RIGHT + 56, y: GOAL_TOP - 74, id: 12 },
    { x: FIELD_RIGHT + 56, y: GOAL_BOTTOM + 74, id: 13 },
  ];

  for (const ps of photoSpots) {
    items.push({
      y: ps.y,
      draw: () =>
        drawSidelinePhotographer(
          ctx,
          engine,
          ps.x,
          ps.y,
          ps.id,
          spriteScale,
          toScreenX,
          toScreenY
        ),
    });
  }
}

function drawTripodCameraman(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  wx: number,
  wy: number,
  id: number,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const sx = snap(toScreenX(wx));
  const sy = snap(toScreenY(wy));
  if (sx < -65 || sx > CANVAS_W + 65 || sy < -65 || sy > CANVAS_H + 65) return;

  const angleToBall = Math.atan2(engine.ball.y - wy, engine.ball.x - wx);
  const dir = Math.cos(angleToBall) >= 0 ? 1 : -1;
  const onAir = Math.floor(engine.animTime * 2.5 + id) % 2 === 0;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(spriteScale * 0.88, spriteScale * 0.88);

  // Sombra direcional do operador e do tripé
  ctx.fillStyle = 'rgba(3, 12, 8, 0.28)';
  ctx.beginPath();
  ctx.ellipse(7, 4.5, 16, 5.2, 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 11, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Operador de câmera em pé atrás do tripé
  const opX = -dir * 7.5;
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, opX - 4.2, -13, 3.4, 13, 1.4);
  fillCapsule(ctx, opX + 0.8, -13, 3.4, 13, 1.4);
  ctx.fillStyle = '#1e293b';
  fillCapsule(ctx, opX - 3.6, -12, 2.4, 11, 1);
  fillCapsule(ctx, opX + 1.2, -12, 2.4, 11, 1);

  // Colete escuro de imprensa/TV com faixa refletiva laranja
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, opX - 5.8, -24.5, 11.6, 12.2, 3);
  ctx.fillStyle = '#1f2937';
  fillCapsule(ctx, opX - 4.8, -23.5, 9.6, 10.4, 2.2);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(opX - 4.5, -18.5, 9, 2.2);

  // Cabeça com fone headset de comunicação
  drawSculptedHead(ctx, opX, -28.5, id % 2 === 0 ? '#e5b28a' : '#a96d46', '#1e1b18', dir, id % 3, false);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(opX, -29.5, 4.8, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(opX - 5.2, -29.8, 1.6, 2.8);
  ctx.fillRect(opX + 3.6, -29.8, 1.6, 2.8);

  // Tripé metálico de 3 pernas na frente do operador
  const tripX = dir * 4.5;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(tripX, -20);
  ctx.lineTo(tripX - 7, 1);
  ctx.moveTo(tripX, -20);
  ctx.lineTo(tripX + 7, 1);
  ctx.moveTo(tripX, -20);
  ctx.lineTo(tripX + dir * 1, 2);
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tripX, -20);
  ctx.lineTo(tripX - 7, 1);
  ctx.moveTo(tripX, -20);
  ctx.lineTo(tripX + 7, 1);
  ctx.stroke();

  // Câmera broadcast de TV rotacionando suavemente para acompanhar a bola
  const aimTilt = Math.max(-0.42, Math.min(0.42, Math.sin(angleToBall) * 0.45));
  ctx.save();
  ctx.translate(tripX, -22);
  ctx.rotate(aimTilt * dir);
  ctx.scale(dir, 1);

  // Corpo principal da câmera
  ctx.fillStyle = '#090d16';
  ctx.fillRect(-6.5, -4.5, 13, 8.2);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-5.5, -3.5, 11, 6.2);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-4.5, -2.8, 7, 2);
  // Lente teleobjetiva + para-sol (matte box)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(6, -3.2, 6.5, 5.8);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(11.6, -2.3, 1.2, 4.0);
  // Luz vermelha ON-AIR piscando no topo da câmera
  ctx.fillStyle = onAir ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(2.5, -5.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  if (onAir) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.36)';
    ctx.beginPath();
    ctx.arc(2.5, -5.2, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

function drawSteadicamOperator(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  wx: number,
  wy: number,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const sx = snap(toScreenX(wx));
  const sy = snap(toScreenY(wy));
  if (sx < -65 || sx > CANVAS_W + 65 || sy < -65 || sy > CANVAS_H + 65) return;

  const dir = engine.ball.x >= wx ? 1 : -1;
  const ballSpeed = Math.abs(engine.ball.vx);
  const stride = ballSpeed > 40 ? Math.sin(engine.animTime * 11) * 3.2 : 0;
  const onAir = Math.floor(engine.animTime * 3) % 2 === 0;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(spriteScale * 0.86, spriteScale * 0.86);

  // Sombra direcional + contato
  ctx.fillStyle = 'rgba(3, 12, 8, 0.25)';
  ctx.beginPath();
  ctx.ellipse(6.5, 4.0, 12.5, 4.2, 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 7.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas acompanhando o lance
  drawArticulatedLeg(ctx, -2.5, -10.5, -2.8 + stride, -3, '#d9a17a', '#0f172a', '#38bdf8', dir);
  drawArticulatedLeg(ctx, 2.5, -10.5, 2.8 - stride, -3, '#d9a17a', '#0f172a', '#38bdf8', dir);

  // Colete de transmissão + arnes Steadicam
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, -6, -24, 12, 14, 3);
  ctx.fillStyle = '#0f172a';
  fillCapsule(ctx, -5, -23, 10, 12, 2.2);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-4.5, -19, 9, 2.4);

  // Braço articulado Steadicam + câmera apontada para o campo
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dir * 3, -15);
  ctx.lineTo(dir * 9.5, -17);
  ctx.lineTo(dir * 9.5, -22.5);
  ctx.stroke();

  ctx.fillStyle = '#090d16';
  ctx.fillRect(dir * 9.5 - 4, -25.5, 8.5, 5.5);
  ctx.fillStyle = '#475569';
  ctx.fillRect(dir * 9.5 - 3, -24.5, 6.5, 3.5);
  ctx.fillStyle = onAir ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(dir * 9.5, -26.4, 1.5, 0, Math.PI * 2);
  ctx.fill();

  drawSculptedHead(ctx, 0, -28.5, '#d9a17a', '#1e1b18', dir, 1, false);
  ctx.restore();
}

function drawSidelinePhotographer(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  wx: number,
  wy: number,
  id: number,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const sx = snap(toScreenX(wx));
  const sy = snap(toScreenY(wy));
  if (sx < -60 || sx > CANVAS_W + 60 || sy < -60 || sy > CANVAS_H + 60) return;

  const dir = wx < FIELD_CENTER_X ? 1 : -1;
  const nearAction =
    Math.hypot(engine.ball.x - wx, engine.ball.y - wy) < 420 ||
    engine.phase === 'GOAL_CELEBRATION' ||
    engine.phase === 'GOAL_REPLAY';
  const flashVal = Math.sin(engine.animTime * 19 + id * 7.3);
  const triggerFlash = nearAction && flashVal > (engine.phase === 'GOAL_CELEBRATION' ? 0.86 : 0.965);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(spriteScale * 0.84, spriteScale * 0.84);

  // Sombra do fotógrafo sentado
  ctx.fillStyle = 'rgba(3, 12, 8, 0.28)';
  ctx.beginPath();
  ctx.ellipse(5, 3.5, 11.5, 4.2, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Banquinho dobrável
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(3, 2);
  ctx.moveTo(3, -5);
  ctx.lineTo(-4, 2);
  ctx.stroke();

  // Fotógrafo agachado/sentado com colete verde/cinza
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, -5.5, -16, 11, 11, 3);
  ctx.fillStyle = id % 2 === 0 ? '#15803d' : '#334155';
  fillCapsule(ctx, -4.5, -15, 9, 9, 2.2);

  // Cabeça inclinada no visor
  drawSculptedHead(ctx, dir * 0.5, -19.5, id % 2 === 0 ? '#f0c4a0' : '#b87a52', '#261c15', dir, id % 4, false);

  // Grande lente teleobjetiva branca (estilo fotojornalismo esportivo)
  ctx.fillStyle = '#090d16';
  ctx.fillRect(dir > 0 ? 3 : -14.5, -19.5, 11.5, 4.6);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(dir > 0 ? 4 : -13.5, -18.7, 9.5, 3.0);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(dir > 0 ? 11.2 : -12.4, -18.7, 1.3, 3.0);

  // Flash brilhante de câmera fotográfica nos lances de perigo e gols!
  if (triggerFlash) {
    const fx = dir > 0 ? 14.5 : -14.5;
    const fy = -17.2;
    const fGrad = ctx.createRadialGradient(fx, fy, 1, fx, fy, 18);
    fGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    fGrad.addColorStop(0.35, 'rgba(224, 242, 254, 0.62)');
    fGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Moldura cinematográfica de transmissão durante o REPLAY DO GOL
function drawReplayBroadcastFrame(ctx: CanvasRenderingContext2D, engine: SoccerEngine): void {
  // Barras sutis de cinema no topo e embaixo
  ctx.fillStyle = 'rgba(4, 9, 20, 0.52)';
  ctx.fillRect(0, 0, CANVAS_W, 12);
  ctx.fillRect(0, CANVAS_H - 12, CANVAS_W, 12);

  // Linhas sutis de transmissão TV
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let y = 14; y < CANVAS_H - 14; y += 4) {
    ctx.fillRect(0, y, CANVAS_W, 1);
  }

  // Marca d'água "EFATÁ TV · SLOW-MO" no canto inferior direito
  const bx = CANVAS_W - 156;
  const by = CANVAS_H - 36;
  ctx.fillStyle = 'rgba(7, 17, 36, 0.78)';
  ctx.fillRect(bx, by, 144, 18);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx, by, 144, 18);

  const pulse = Math.floor(engine.animTime * 4) % 2 === 0;
  ctx.fillStyle = pulse ? '#ef4444' : '#991b1b';
  ctx.beginPath();
  ctx.arc(bx + 10, by + 9, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 8.5px monospace';
  ctx.fillStyle = '#fde047';
  ctx.fillText('EFATÁ TV · SLOW-MO', bx + 19, by + 12);
}

// --- HINOS, GRITOS E PROVOCAÇÕES DAS TORCIDAS SUBINDO DA ARQUIBANCADA ---
function drawCrowdChants(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  if (!engine.crowdChants.length) return;

  for (const chant of engine.crowdChants) {
    const prog = 1 - chant.timer / Math.max(0.1, chant.maxTimer);
    const alpha =
      prog < 0.12 ? prog / 0.12 : prog > 0.78 ? Math.max(0, (1 - prog) / 0.22) : 1;

    const rawX = toScreenX(chant.worldX);
    const sx = Math.max(106, Math.min(CANVAS_W - 106, snap(rawX)));
    const baseStandY = Math.max(46, Math.min(138, snap(toScreenY(FIELD_TOP - 56))));
    const sway =
      chant.kind === 'anthem'
        ? Math.sin(engine.animTime * 6 + chant.id) * 3.2
        : Math.sin(engine.animTime * 13 + chant.id) * 2.4;
    const sy = snap(baseStandY - prog * (chant.kind === 'anthem' ? 22 : 28) + sway);

    const club = chant.team === 'home' ? engine.homeClub : engine.awayClub;
    const clubBg = club.crowdColors[0] ?? '#0f172a';
    const clubAccent = club.crowdColors[1] ?? '#facc15';

    const isAnthem = chant.kind === 'anthem';
    const isTaunt = chant.kind === 'taunt';

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(0.96, alpha));
    ctx.font = isAnthem ? 'bold 10px monospace' : 'bold 9.5px monospace';
    ctx.textAlign = 'center';

    const displayText = isAnthem
      ? `♪ ${chant.text} ♫`
      : isTaunt
        ? `⚡ ${chant.text}`
        : chant.text;
    const tw = Math.ceil(ctx.measureText(displayText).width) + 20;
    const bh = isAnthem ? 20 : 18;
    const bx = snap(sx - tw / 2);
    const by = sy - Math.floor(bh * 0.6);

    if (isTaunt) {
      // Leve inclinação provocativa em direção à torcida rival
      ctx.translate(sx, by + bh * 0.5);
      ctx.rotate(chant.team === 'home' ? -0.025 : 0.025);
      ctx.translate(-sx, -(by + bh * 0.5));
    }

    const bg = isTaunt ? '#140c1c' : clubBg;
    const border = isAnthem ? '#facc15' : isTaunt ? '#fb923c' : clubAccent;

    // Contorno externo escuro
    ctx.fillStyle = 'rgba(4, 9, 20, 0.9)';
    fillCapsule(ctx, bx - 2.5, by - 2.5, tw + 5, bh + 5, 5.5);

    // Fundo da faixa
    ctx.fillStyle = bg;
    fillCapsule(ctx, bx, by, tw, bh, 4.5);

    // Faixa lateral com a cor do clube nas provocações
    if (isTaunt) {
      ctx.fillStyle = clubBg;
      ctx.fillRect(bx + 2, by + 2, 4, bh - 4);
      ctx.fillRect(bx + tw - 6, by + 2, 4, bh - 4);
    }

    // Borda principal (dourada nos hinos, laranja-fogo nas provocações)
    ctx.strokeStyle = border;
    ctx.lineWidth = isAnthem ? 2.1 : 1.7;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw, bh, 4.5);
    ctx.stroke();

    // Triângulo apontando para o setor da torcida
    ctx.fillStyle = border;
    ctx.beginPath();
    ctx.moveTo(sx - 4.5, by + bh);
    ctx.lineTo(sx + 4.5, by + bh);
    ctx.lineTo(sx, by + bh + 5.5);
    ctx.closePath();
    ctx.fill();

    // Texto nítido com alto contraste
    const lightBg =
      !isTaunt &&
      (bg.toLowerCase() === '#ffffff' ||
        bg.toLowerCase() === '#f8fafc' ||
        bg.toLowerCase() === '#facc15' ||
        bg.toLowerCase() === '#fde047');

    ctx.fillStyle = lightBg ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.82)';
    ctx.fillText(displayText, sx + 1, by + bh - 5);
    ctx.fillStyle = isAnthem
      ? lightBg
        ? '#0f172a'
        : '#fef08a'
      : isTaunt
        ? '#ffedd5'
        : lightBg
          ? '#0f172a'
          : '#ffffff';
    ctx.fillText(displayText, sx, by + bh - 6);

    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  engine: SoccerEngine,
  spriteScale: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number, z?: number) => number
): void {
  const b = engine.ball;
  const sx = snap(toScreenX(b.x));
  const groundY = snap(toScreenY(b.y, 0));
  const ballY = snap(toScreenY(b.y, b.z));
  const sizeFactor = spriteScale / 1.28;

  // Rastro luminoso e efeito de curva (after-touch) em chutes fortes no ar!
  const speed = Math.hypot(b.vx, b.vy);
  if (b.shotInFlight && speed > 310) {
    const tailSec = Math.min(0.068, 0.036 + speed / 22000);
    const prevX = snap(toScreenX(b.x - b.vx * tailSec));
    const prevY = snap(toScreenY(b.y - b.vy * tailSec, Math.max(0, b.z - b.vz * (tailSec * 0.85))));
    const perpX = -(b.vy / speed);
    const perpY = b.vx / speed;
    const curveBend = Math.max(-16, Math.min(16, b.spin * 1.45)) * sizeFactor;
    const ctrlX = (prevX + sx) * 0.5 + perpX * curveBend;
    const ctrlY = (prevY + ballY) * 0.5 - 3 + perpY * curveBend;

    ctx.strokeStyle = Math.abs(b.spin) > 2.2 ? 'rgba(56, 189, 248, 0.52)' : 'rgba(254, 240, 138, 0.52)';
    ctx.lineWidth = (Math.abs(b.spin) > 2.2 ? 6.4 : 5.4) * sizeFactor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(prevX, prevY - 3);
    ctx.quadraticCurveTo(ctrlX, ctrlY, sx, ballY - 3);
    ctx.stroke();

    // Núcleo brilhante da curva quando o jogador aplica controlada de leve após o chute
    if (Math.abs(b.spin) > 1.8) {
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.82)';
      ctx.lineWidth = 2.4 * sizeFactor;
      ctx.beginPath();
      ctx.moveTo(prevX, prevY - 3);
      ctx.quadraticCurveTo(ctrlX, ctrlY, sx, ballY - 3);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  // Sombra dupla da bola: sombra de contato + sombra projetada pelos refletores deslocando com a altura (b.z)
  const shadowScale = Math.max(0.42, 1 - b.z / 210) * sizeFactor;
  const lightOffX = 3.5 + b.z * 0.22;
  const lightOffY = 2.0 + b.z * 0.11;
  ctx.fillStyle = `rgba(3, 12, 8, ${Math.max(0.14, 0.28 - b.z * 0.001)})`;
  ctx.beginPath();
  ctx.ellipse(
    sx + lightOffX,
    groundY + lightOffY,
    8.2 * shadowScale,
    4.0 * shadowScale,
    0.15,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.2, 0.38 - b.z * 0.0012)})`;
  ctx.beginPath();
  ctx.ellipse(sx, groundY + 2, 6.4 * shadowScale, 3.2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bola com sombreamento esférico + gomos girando + brilho especular
  const r = Math.max(5.5, Math.min(10.5, (5.8 + b.z * 0.024) * sizeFactor));
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(sx, ballY - 3, r + 1.2, 0, Math.PI * 2);
  ctx.fill();

  const ballGrad = ctx.createRadialGradient(sx - r * 0.3, ballY - 3 - r * 0.3, 1, sx, ballY - 3, r);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(0.75, '#e2e8f0');
  ballGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(sx, ballY - 3, r, 0, Math.PI * 2);
  ctx.fill();

  // Gomos pentagonais pretos girando
  const px = Math.round(Math.cos(b.rotation) * (r * 0.45));
  const py = Math.round(Math.sin(b.rotation) * (r * 0.45));
  ctx.fillStyle = '#111827';
  ctx.fillRect(sx + px - 1, ballY - 4 + py, 3, 2);
  ctx.fillRect(sx - px - 1, ballY - 3 - py, 2, 2);
  // Brilho branco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx - 2, ballY - 5, 2, 1);
}

// --- RADAR / MINIMAPA COMPACTO CENTRALIZADO EMBAIXO ---
function drawRadar(ctx: CanvasRenderingContext2D, engine: SoccerEngine): void {
  const rw = 144;
  const rh = 72;
  const rx = snap((CANVAS_W - rw) * 0.5);
  const ry = CANVAS_H - rh - 8;

  ctx.fillStyle = 'rgba(7, 17, 36, 0.72)';
  ctx.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);

  ctx.fillStyle = 'rgba(34, 125, 56, 0.72)';
  ctx.fillRect(rx, ry, rw, rh);

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);
  ctx.beginPath();
  ctx.moveTo(rx + rw * 0.5, ry + 2);
  ctx.lineTo(rx + rw * 0.5, ry + rh - 2);
  ctx.stroke();

  const mapX = (wx: number) =>
    rx + 3 + ((wx - FIELD_LEFT) / (FIELD_RIGHT - FIELD_LEFT)) * (rw - 6);
  const mapY = (wy: number) =>
    ry + 3 + ((wy - FIELD_TOP) / (FIELD_BOTTOM - FIELD_TOP)) * (rh - 6);

  for (const p of engine.players) {
    const px = snap(mapX(p.x));
    const py = snap(mapY(p.y));
    const isSel =
      p.id === engine.p1SelectedId ||
      (engine.config.controlMode === '1P_2P' && p.id === engine.p2SelectedId);
    const color = p.team === 'home' ? engine.homeKit.primary : engine.awayKit.primary;

    ctx.fillStyle = isSel ? '#facc15' : '#040914';
    ctx.fillRect(px - 2.5, py - 2.5, 6, 6);
    ctx.fillStyle = color;
    ctx.fillRect(px - 1.5, py - 1.5, 4, 4);
  }

  const bx = snap(mapX(engine.ball.x));
  const by = snap(mapY(engine.ball.y));
  ctx.fillStyle = Math.floor(engine.animTime * 10) % 2 === 0 ? '#ffffff' : '#facc15';
  ctx.fillRect(bx - 2, by - 2, 4, 4);
}

// =========================================================================
// RENDERIZADOR HD 16-BIT DA DISPUTA DE PÊNALTIS (960x540)
// =========================================================================

export function renderPenaltyFrame(ctx: CanvasRenderingContext2D, engine: PenaltyEngine): void {
  ctx.imageSmoothingEnabled = false;
  const textures = getTextures(ctx);
  const t = engine.animTime;
  const ex = engine.crowdExcitement;

  // Céu crepuscular de estádio lotado
  const sky = ctx.createLinearGradient(0, 0, 0, 195);
  sky.addColorStop(0, '#071026');
  sky.addColorStop(1, '#182b52');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, 195);

  // Refletores brilhando no alto
  [140, 340, 620, 820].forEach((lx) => {
    const glow = ctx.createRadialGradient(lx, 18, 4, lx, 18, 70);
    glow.addColorStop(0, 'rgba(254, 249, 195, 0.55)');
    glow.addColorStop(1, 'rgba(254, 249, 195, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 70, 0, 140, 90);
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(lx - 18, 8, 36, 8);
  });

  // Arquibancada animada atrás do gol
  const homeColors = engine.homeClub.crowdColors;
  const awayColors = engine.awayClub.crowdColors;

  for (let row = 0; row < 6; row++) {
    const ry = 32 + row * 23;
    ctx.fillStyle = row % 2 === 0 ? '#1b263b' : '#253657';
    ctx.fillRect(0, ry, CANVAS_W, 22);
    for (let col = 0; col < 80; col++) {
      const fx = col * 12 + (row % 2) * 5;
      const seed = (col * 19 + row * 13) % 99;
      const pal = col < 40 ? homeColors : awayColors;
      const jump = Math.max(0, Math.sin(t * (5 + ex * 12) + seed)) * (1.5 + ex * 7);
      ctx.fillStyle = pal[seed % pal.length];
      ctx.fillRect(fx, snap(ry + 9 - jump), 7, 8);
      ctx.fillStyle = seed % 2 === 0 ? '#e5b38c' : '#b87449';
      ctx.fillRect(fx + 1, snap(ry + 4 - jump), 5, 5);
      // Flashes na torcida
      if (Math.sin(t * 15 + seed * 9.1) > (ex > 0.5 ? 0.96 : 0.994)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx, snap(ry + 4 - jump), 6, 6);
      }
    }
  }

  // Bandeirões balançando atrás do gol
  [120, 290, 650, 815].forEach((bx, i) => {
    const pal = i < 2 ? homeColors : awayColors;
    const sway = Math.sin(t * (4 + ex * 8) + i) * 7;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(bx, 22, 3, 82);
    for (let s = 0; s < 5; s++) {
      const sx = bx + 3 + s * 10 + Math.round((sway * s) / 5);
      const sy = 26 + Math.round(Math.sin(t * 5 + s) * 3);
      ctx.fillStyle = pal[0];
      ctx.fillRect(sx, sy, 10, 9);
      ctx.fillStyle = pal[1];
      ctx.fillRect(sx, sy + 9, 10, 9);
      ctx.fillStyle = pal[2];
      ctx.fillRect(sx, sy + 18, 10, 7);
    }
  });

  // Placas de publicidade atrás do gol
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 172, CANVAS_W, 20);
  for (let x = 0; x < CANVAS_W; x += 96) {
    const pal = x < CANVAS_W / 2 ? homeColors : awayColors;
    ctx.fillStyle = pal[0];
    ctx.fillRect(x + 2, 174, 92, 14);
    ctx.fillStyle = pal[1];
    ctx.fillRect(x + 24, 174, 48, 14);
  }

  // Gramado texturizado em faixas horizontais
  const pitchTop = 192;
  for (let i = 0; i < 12; i++) {
    const y1 = pitchTop + i * 30;
    ctx.fillStyle = (i % 2 === 0 ? textures.turfLight : textures.turfDark) ?? '#2f913e';
    ctx.fillRect(0, y1, CANVAS_W, 30);
  }

  // Linhas da grande área
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 279);
  ctx.lineTo(CANVAS_W, 279);
  ctx.moveTo(165, 279);
  ctx.lineTo(60, 510);
  ctx.moveTo(CANVAS_W - 165, 279);
  ctx.lineTo(CANVAS_W - 60, 510);
  ctx.stroke();

  // Marca da cal do pênalti
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(CANVAS_W / 2 - 6, 442, 12, 6);

  // GOL FRONTAL 3D
  const goalW = 420;
  const goalH = 148;
  const gx1 = CANVAS_W / 2 - goalW / 2;
  const gx2 = CANVAS_W / 2 + goalW / 2;
  const gyTop = 279 - goalH;
  const gyBot = 279;

  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(gx1 + 6, gyTop + 6, goalW - 12, goalH - 6);

  // Rede com balanço físico no impacto
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.56)';
  ctx.lineWidth = 1.5;
  const rippleAmp = engine.netRipple * 14;
  for (let i = 1; i < 22; i++) {
    const x = gx1 + (goalW * i) / 22;
    const normX = (i / 22) * 2 - 1;
    const dist = Math.max(0, 1 - Math.abs(normX - engine.netRippleX) * 1.3);
    const wave = Math.sin(t * 22) * rippleAmp * dist;
    ctx.beginPath();
    ctx.moveTo(x, gyTop);
    ctx.lineTo(x + wave, gyBot - 10);
    ctx.stroke();
  }
  for (let j = 1; j < 9; j++) {
    const y = gyTop + (goalH * j) / 9;
    ctx.beginPath();
    for (let s = 0; s <= 16; s++) {
      const px = gx1 + (goalW * s) / 16;
      const normX = (s / 16) * 2 - 1;
      const dist = Math.max(0, 1 - Math.abs(normX - engine.netRippleX) * 1.3);
      const py = y + Math.sin(t * 20) * rippleAmp * 0.65 * dist;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Traves e travessão sombreados
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 12;
  ctx.strokeRect(gx1, gyTop, goalW, goalH);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(gx1, gyBot);
  ctx.lineTo(gx1, gyTop);
  ctx.lineTo(gx2, gyTop);
  ctx.lineTo(gx2, gyBot);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx1 - 1, gyBot);
  ctx.lineTo(gx1 - 1, gyTop - 1);
  ctx.lineTo(gx2 - 1, gyTop - 1);
  ctx.lineTo(gx2 - 1, gyBot);
  ctx.stroke();

  // MIRA + BARRA DE FORÇA
  if (engine.isHumanKicker() && (engine.phase === 'AIMING' || engine.phase === 'CHARGING')) {
    const ax = snap(CANVAS_W / 2 + engine.aimX * (goalW / 2 - 10));
    const ay = snap(gyBot - engine.aimY * (goalH - 12));
    const pulse = Math.floor(t * 10) % 2 === 0;
    ctx.strokeStyle = pulse ? '#facc15' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ax, ay, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax - 20, ay);
    ctx.lineTo(ax + 20, ay);
    ctx.moveTo(ax, ay - 20);
    ctx.lineTo(ax, ay + 20);
    ctx.stroke();

    if (engine.phase === 'CHARGING') {
      const barX = CANVAS_W / 2 + 86;
      const barY = 345;
      const barH = 112;
      ctx.fillStyle = '#040914';
      ctx.fillRect(barX - 3, barY - 3, 24, barH + 6);
      const fillH = Math.round(barH * engine.power);
      ctx.fillStyle =
        engine.power < 0.6 ? '#22c55e' : engine.power < 0.88 ? '#facc15' : '#ef4444';
      ctx.fillRect(barX, barY + (barH - fillH), 18, fillH);
    }
  }

  // GOLEIRO DETALHADO NA LINHA DO GOL
  const keeperKit = engine.kickingTeam === 'home' ? engine.awayKit : engine.homeKit;
  const kx = snap(CANVAS_W / 2 + engine.keeperX * (goalW * 0.46));
  const ky = snap(gyBot - 6 - (engine.keeperDiveProgress > 0.1 ? engine.keeperDiveHeight * 38 : 0));

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(kx, gyBot + 3, engine.keeperDiveProgress > 0.2 ? 36 : 19, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (engine.keeperDiveProgress > 0.15 && engine.keeperDiveTarget !== 0) {
    const dir = engine.keeperDiveTarget;
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, kx - 31, ky - 23, 62, 23, 8);
    ctx.fillStyle = keeperKit.gkShirt;
    fillCapsule(ctx, kx - 22, ky - 20, 38, 17, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    fillCapsule(ctx, kx - 20, ky - 19, 34, 5, 3);
    ctx.fillStyle = keeperKit.shorts;
    fillCapsule(ctx, dir > 0 ? kx - 29 : kx + 14, ky - 18, 16, 13, 4);
    // Luvas acolchoadas
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, dir > 0 ? kx + 17 : kx - 30, ky - 24, 13, 12, 5);
    ctx.fillStyle = '#ffffff';
    fillCapsule(ctx, dir > 0 ? kx + 18.5 : kx - 28.5, ky - 22.5, 10, 9, 4);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(dir > 0 ? kx + 19 : kx - 21, ky - 20, 2.5, 5);
    ctx.save();
    ctx.translate(dir > 0 ? kx + 10 : kx - 10, ky - 20);
    ctx.scale(1.6, 1.6);
    drawSculptedHead(ctx, 0, 0, '#f2c19b', '#2a1c12', dir, 0, false);
    ctx.restore();
  } else {
    const hop = Math.round(Math.abs(Math.sin(t * 7)) * 3);
    // Pernas + chuteiras
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, kx - 11, ky - 13 - hop, 8, 14, 3);
    fillCapsule(ctx, kx + 3, ky - 13 - hop, 8, 14, 3);
    ctx.fillStyle = keeperKit.socks;
    fillCapsule(ctx, kx - 9.5, ky - 12 - hop, 5, 10, 2);
    fillCapsule(ctx, kx + 4.5, ky - 12 - hop, 5, 10, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(kx - 9.5, ky - 11 - hop, 5, 2);
    ctx.fillRect(kx + 4.5, ky - 11 - hop, 5, 2);

    // Calção + camisa goleiro
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, kx - 12, ky - 23 - hop, 24, 13, 4);
    ctx.fillStyle = keeperKit.shorts;
    fillCapsule(ctx, kx - 10, ky - 21 - hop, 20, 10, 3);

    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, kx - 15, ky - 45 - hop, 30, 26, 6);
    ctx.fillStyle = keeperKit.gkShirt;
    fillCapsule(ctx, kx - 13, ky - 43 - hop, 26, 22, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    fillCapsule(ctx, kx - 12, ky - 42 - hop, 9, 20, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    fillCapsule(ctx, kx + 5, ky - 42 - hop, 7, 20, 4);

    // Braços prontos + luvas
    ctx.fillStyle = '#090d16';
    fillCapsule(ctx, kx - 23, ky - 42 - hop, 10, 11, 4);
    fillCapsule(ctx, kx + 13, ky - 42 - hop, 10, 11, 4);
    ctx.fillStyle = '#ffffff';
    fillCapsule(ctx, kx - 21.5, ky - 40.5 - hop, 7, 8, 3);
    fillCapsule(ctx, kx + 14.5, ky - 40.5 - hop, 7, 8, 3);

    ctx.save();
    ctx.translate(kx, ky - 51 - hop);
    ctx.scale(1.65, 1.65);
    drawSculptedHead(ctx, 0, 0, '#f2c19b', '#2a1c12', 0, 1, false);
    ctx.restore();
  }

  // BOLA COM SOMBREAMENTO 3D
  const bt = engine.ballT;
  const ballScreenX = snap(CANVAS_W / 2 + engine.ballX * (goalW / 2));
  const ballGroundY = snap(446 + (gyBot - 446) * bt);
  const ballScreenY = snap(ballGroundY - engine.ballY * goalH * bt);
  const ballRadius = Math.max(6, Math.round(12 - bt * 5.2));

  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(ballScreenX, ballGroundY + 3, ballRadius, ballRadius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(ballScreenX, ballScreenY, ballRadius + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ballScreenX, ballScreenY, ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.fillRect(ballScreenX - 3, ballScreenY - 2, 5, 4);

  // COBRADOR REALISTA DETALHADO (DE COSTAS CORRENDO PARA A BOLA)
  const kickerKit = engine.kickingTeam === 'home' ? engine.homeKit : engine.awayKit;
  const runY = snap(514 - engine.kickerRunT * 58);
  const runX = snap(CANVAS_W / 2 - 22 + engine.kickerRunT * 15);
  const leg = Math.floor(t * 14) % 2 === 0 ? 5 : -5;
  const isRunning = engine.kickerRunT > 0 && engine.kickerRunT < 1;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(runX, runY + 4, 20, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas com meiões e chuteiras
  const lOff = isRunning ? leg : 0;
  const rOff = isRunning ? -leg : 0;
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, runX - 11, runY - 21 + lOff, 9, 22, 4);
  fillCapsule(ctx, runX + 2, runY - 21 + rOff, 9, 22, 4);
  ctx.fillStyle = kickerKit.socks;
  fillCapsule(ctx, runX - 9.5, runY - 19 + lOff, 6, 15, 2.5);
  fillCapsule(ctx, runX + 3.5, runY - 19 + rOff, 6, 15, 2.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(runX - 9.5, runY - 18 + lOff, 6, 2);
  ctx.fillRect(runX + 3.5, runY - 18 + rOff, 6, 2);

  // Calção sombreado
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, runX - 14, runY - 36, 28, 17, 5);
  ctx.fillStyle = kickerKit.shorts;
  fillCapsule(ctx, runX - 12, runY - 34, 24, 14, 4);

  // Tronco largo atlético + camisa com número 10 nas costas
  ctx.fillStyle = '#090d16';
  fillCapsule(ctx, runX - 16, runY - 64, 32, 31, 7);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(runX - 14, runY - 62, 28, 27, 5);
  ctx.clip();
  drawPatternedShirt(ctx, runX - 14, runY - 62, 28, 27, kickerKit, false);
  ctx.restore();

  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  const backNumColor =
    kickerKit.primary.toLowerCase() === '#ffffff' || kickerKit.primary.toLowerCase() === '#facc15'
      ? '#0f172a'
      : '#ffffff';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('10', runX + 1, runY - 43);
  ctx.fillStyle = backNumColor;
  ctx.fillText('10', runX, runY - 44);
  ctx.textAlign = 'left';

  // Cabeça de costas com pescoço e orelhas
  ctx.fillStyle = '#d99b6c';
  fillCapsule(ctx, runX - 4, runY - 69, 8, 7, 3);
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(runX, runY - 74, 10, 10.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#261810';
  ctx.beginPath();
  ctx.ellipse(runX, runY - 75, 8.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(runX - 2.5, runY - 78, 3.5, 2.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  drawStadiumLighting(ctx);
}
