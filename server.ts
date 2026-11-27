import 'dotenv/config';
import { spawn } from 'node:child_process';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

type NarrationMood = 'calm' | 'excited' | 'goal';
type BroadcastSpeaker = 'galvao' | 'casagrande' | 'ronaldo' | 'neto';

interface DialogueTurn {
  speaker: BroadcastSpeaker;
  text: string;
}

// Modelo de alta vazão (gemini-3.8-flash-lite-tts) como padrão para manter narração e comentários contínuos o jogo inteiro sem estourar o limite de 3 RPM, com fallback cruzado para gemini-3.8-flash-tts
const PRIMARY_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const FALLBACK_TTS_MODEL = 'gemini-3.8-flash-tts';

// Vozes 100% masculinas distintas — em diálogos em dupla (Galvão + Comentarista), os pares sempre usam bases vocais diferentes
const SPEAKER_VOICES: Record<BroadcastSpeaker, string> = {
  galvao: 'Fenrir',     // Barítono-grave potente e dramático — base de Galvão Bueno
  casagrande: 'Charon', // Grave, rouco e maduro — base de Walter Casagrande
  ronaldo: 'Puck',      // Base ajustada mais grave/encorpada para voz masculina de Ronaldo Fenômeno
  neto: 'Puck',         // Base ajustada grave-rasgada com direção paulista explosiva para Craque Neto
};

const SPEAKER_LABELS: Record<BroadcastSpeaker, string> = {
  galvao: 'Galvao',
  casagrande: 'Casagrande',
  ronaldo: 'Ronaldo',
  neto: 'Neto',
};

const MAX_CACHE_ENTRIES = 260;

const wavCache = new Map<string, Buffer>();
const pcmCache = new Map<string, Buffer>();
const dialogueWavCache = new Map<string, Buffer>();
const inFlightTts = new Map<string, Promise<Buffer>>();

function parseSpeaker(raw: unknown): BroadcastSpeaker {
  if (raw === 'casagrande' || raw === 'ronaldo' || raw === 'neto' || raw === 'galvao') {
    return raw;
  }
  return 'galvao';
}

function parseMood(raw: unknown): NarrationMood {
  if (raw === 'goal' || raw === 'excited' || raw === 'calm') {
    return raw;
  }
  return 'calm';
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Direção profunda de Voice Design 100% MASCULINA em português do Brasil (idade vocal, timbre grave/barítono, sotaque e projeção de cabine)
function getStyleForSpeakerAndMood(speaker: BroadcastSpeaker, mood: NarrationMood): string {
  const strictMaleGuard =
    'REGRA ABSOLUTA: VOZ 100% MASCULINA DE HOMEM ADULTO, TIMBRE GRAVE OU BARÍTONO ENCORPADO, JAMAIS VOZ FEMININA OU AGUDA. ';

  if (speaker === 'casagrande') {
    const energy =
      mood === 'excited' || mood === 'goal'
        ? 'com forte emoção na voz grave, ênfase sincera e admiração de quem viveu o gramado.'
        : 'com ritmo pausado, análise tática direta, sinceridade e calor humano de cabine de TV.';
    return (
      strictMaleGuard +
      'Voice Design: homem brasileiro de 60 anos, paulistano, voz masculina muito grave, levemente rouca, barítono profundo e visceral ' +
      'inspirada no estilo de comentarista de Walter Casagrande na TV brasileira. ' +
      `Fale em português do Brasil autêntico (jamais robótico), com respiração natural de microfone headset de estádio, ${energy}`
    );
  }
  if (speaker === 'ronaldo') {
    const energy =
      mood === 'excited' || mood === 'goal'
        ? 'com sorriso aberto na voz masculina encorpada, entusiasmo contagiante de artilheiro e naturalidade.'
        : 'com leveza, carisma, tom masculino tranquilo, simpático e confiante de camisa nove campeão mundial.';
    return (
      strictMaleGuard +
      'Voice Design: homem brasileiro de 48 anos, carioca descontraído, voz masculina de homem adulto com timbre médio-grave caloroso, ' +
      'barítono macio, firme e amigável inspirada no estilo de comentarista de Ronaldo Fenômeno na TV brasileira. ' +
      `Fale em português do Brasil espontâneo e fluido (sem leitura engessada e sem soar agudo), ${energy}`
    );
  }
  if (speaker === 'neto') {
    const energy =
      mood === 'excited' || mood === 'goal'
        ? 'com explosão de empolgação, indignação divertida, voz masculina grave-rasgada potente e paixão à flor da pele!'
        : 'com energia alta, opinião forte, voz masculina encorpada e bom humor afiado de ex-camisa dez batedor de faltas.';
    return (
      strictMaleGuard +
      'Voice Design: homem brasileiro de 58 anos, sotaque paulista marcante de São Paulo (R retroflexo leve), ' +
      'voz masculina adulta grave, rasgada, potente, rouca e expansiva inspirada no estilo inconfundível do Craque Neto na TV brasileira. ' +
      `Fale em português do Brasil coloquial e visceral (nunca formal, nunca agudo nem feminino), com projeção forte de estúdio esportivo, ${energy}`
    );
  }
  // Galvão Bueno (narrador principal)
  if (mood === 'goal') {
    return (
      strictMaleGuard +
      'Voice Design: homem brasileiro de 72 anos, narrador esportivo lendário da TV aberta brasileira, voz barítono-grave ' +
      'ressonante, vibrante e altamente dramática inspirada no estilo clássico de Galvão Bueno em final de Copa. ' +
      'Fale em português do Brasil com extrema emoção, respiração audível de cabine lotada, grito de gol arrepiante e prolongado, ' +
      'crescendo épico e dicção firme de locutor de estádio.'
    );
  }
  if (mood === 'excited') {
    return (
      strictMaleGuard +
      'Voice Design: homem brasileiro de 72 anos, narrador esportivo clássico de TV aberta, voz masculina grave, imponente ' +
      'e dramática inspirada no estilo de Galvão Bueno transmitindo lance de perigo ao vivo. ' +
      'Fale em português do Brasil com crescendos de adrenalina, ritmo empolgante, ênfase nos nomes dos jogadores e naturalidade humana.'
    );
  }
  return (
    strictMaleGuard +
    'Voice Design: homem brasileiro de 72 anos, narrador esportivo carismático de TV aberta brasileira, voz masculina grave, ' +
    'firme, calorosa e envolvente inspirada no estilo clássico de Galvão Bueno com a bola rolando. ' +
    'Fale em português do Brasil com cadência natural de televisão ao vivo, sem soar sintético ou monótono.'
  );
}

// Injeta marcações sutis de expressividade humana (<breath>, <gasp>, <laugh>) apenas no áudio — o HUD mantém texto limpo!
function decorateExpressiveText(
  text: string,
  speaker: BroadcastSpeaker,
  mood: NarrationMood,
  isReplyInDialogue = false
): string {
  const clean = text.trim();
  if (!clean) return clean;
  if (/<breath>|<gasp>|<laugh>/.test(clean)) return clean;

  if (speaker === 'galvao') {
    if (mood === 'goal') {
      return `<breath> ${clean}`;
    }
    if (mood === 'excited' && /TRAVE|TRAVESSÃO|OLHA O QUE ELE FEZ|DEFESAÇA|BOMBA/i.test(clean)) {
      return `<gasp> ${clean}`;
    }
    return clean;
  }

  if (speaker === 'neto') {
    if (/Pão!|brincadeira|absurd|quebrou/i.test(clean)) {
      return isReplyInDialogue ? `|nossa!| <gasp> ${clean}` : `<gasp> ${clean}`;
    }
    return isReplyInDialogue ? `|olha lá,| <breath> ${clean}` : `<breath> ${clean}`;
  }

  if (speaker === 'ronaldo') {
    if (/Fenomenal|velhos tempos|futebol arte|Golaço/i.test(clean)) {
      return isReplyInDialogue ? `|é isso aí,| <laugh> ${clean}` : `<laugh> ${clean}`;
    }
    return isReplyInDialogue ? `|fala Galvão,| ${clean}` : clean;
  }

  if (speaker === 'casagrande') {
    if (/Caramba|Grande defesa|Golaço|jogadaça/i.test(clean)) {
      return isReplyInDialogue ? `|é verdade,| <breath> ${clean}` : `<breath> ${clean}`;
    }
    return clean;
  }

  return clean;
}

function cacheSet(map: Map<string, Buffer>, key: string, value: Buffer): void {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

// Controle inteligente de cota (evita bater repetidamente num modelo em cooldown de 429 RESOURCE_EXHAUSTED)
const modelCooldownUntil = new Map<string, number>();

function isQuotaOrRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
}

function parseRetryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/GenerateRequestsPerDay|per day limit exceeded/i.test(msg)) {
    return 10 * 60 * 1000;
  }
  const secMatch = msg.match(/retry in ([0-9.]+)s/i);
  if (secMatch) {
    const secs = Number(secMatch[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(20_000, Math.ceil(secs * 1000) + 500);
    }
  }
  return 6_000;
}

function markModelQuotaExceeded(model: string, err: unknown): void {
  const delayMs = parseRetryDelayMs(err);
  modelCooldownUntil.set(model, Date.now() + delayMs);
}

function getOrderedTtsModels(): string[] {
  const now = Date.now();
  const candidates = [PRIMARY_TTS_MODEL, FALLBACK_TTS_MODEL];
  return candidates.filter((m) => (modelCooldownUntil.get(m) ?? 0) <= now);
}

// Empacota PCM 16-bit LE mono 24kHz em um arquivo WAV padrão (cabeçalho RIFF de 44 bytes)
function wrapPcm16AsWav(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2;
  const dataSize = pcmBuffer.length;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  header.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);  // BlockAlign
  header.writeUInt16LE(16, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Perfil de masterização vocal masculina via Rubberband (pitch + formantes deslocados para registro de homem adulto barítono/grave em playbackRate 1.0)
function getMaleRubberbandFilter(speaker: BroadcastSpeaker, mood: NarrationMood): string {
  if (speaker === 'casagrande') {
    const tempo = mood === 'excited' || mood === 'goal' ? 1.12 : 1.07;
    return `rubberband=pitch=0.75:tempo=${tempo}:formant=shifted:pitchq=quality,bass=g=4.6:f=155,equalizer=f=1150:t=q:w=1.1:g=2.2,treble=g=1.4:f=3200`;
  }
  if (speaker === 'ronaldo') {
    const tempo = mood === 'excited' || mood === 'goal' ? 1.16 : 1.11;
    return `rubberband=pitch=0.81:tempo=${tempo}:formant=shifted:pitchq=quality,bass=g=3.8:f=170,equalizer=f=1380:t=q:w=1.1:g=2.2,treble=g=1.6:f=3400`;
  }
  if (speaker === 'neto') {
    const tempo = mood === 'excited' || mood === 'goal' ? 1.22 : 1.16;
    return `rubberband=pitch=0.84:tempo=${tempo}:formant=shifted:pitchq=quality,bass=g=3.4:f=180,equalizer=f=1720:t=q:w=1.2:g=3.2,treble=g=2.0:f=3500`;
  }
  // Galvão Bueno (narrador principal)
  const tempo = mood === 'goal' ? 1.20 : mood === 'excited' ? 1.15 : 1.10;
  const pitch = mood === 'goal' ? 0.82 : 0.79;
  return `rubberband=pitch=${pitch}:tempo=${tempo}:formant=shifted:pitchq=quality,bass=g=4.0:f=165,equalizer=f=1450:t=q:w=1.1:g=2.5,treble=g=1.8:f=3400`;
}

// Filtro nativo FFmpeg (asetrate + aresample + atempo) caso librubberband não esteja compilado no binário ffmpeg
function getMaleStandardFfmpegFilter(speaker: BroadcastSpeaker, mood: NarrationMood): string {
  if (speaker === 'casagrande') {
    const pitch = 0.76;
    const tempo = Math.min(2.0, (mood === 'excited' || mood === 'goal' ? 1.12 : 1.07) / pitch);
    return `asetrate=24000*${pitch},aresample=24000,atempo=${tempo.toFixed(3)},bass=g=4.6:f=155,equalizer=f=1150:t=q:w=1.1:g=2.2`;
  }
  if (speaker === 'ronaldo') {
    const pitch = 0.81;
    const tempo = Math.min(2.0, (mood === 'excited' || mood === 'goal' ? 1.16 : 1.11) / pitch);
    return `asetrate=24000*${pitch},aresample=24000,atempo=${tempo.toFixed(3)},bass=g=3.8:f=170,equalizer=f=1380:t=q:w=1.1:g=2.2`;
  }
  if (speaker === 'neto') {
    const pitch = 0.84;
    const tempo = Math.min(2.0, (mood === 'excited' || mood === 'goal' ? 1.22 : 1.16) / pitch);
    return `asetrate=24000*${pitch},aresample=24000,atempo=${tempo.toFixed(3)},bass=g=3.4:f=180,equalizer=f=1720:t=q:w=1.2:g=3.2`;
  }
  const pitch = mood === 'goal' ? 0.82 : 0.79;
  const targetSpeed = mood === 'goal' ? 1.20 : mood === 'excited' ? 1.15 : 1.10;
  const tempo = Math.min(2.0, targetSpeed / pitch);
  return `asetrate=24000*${pitch},aresample=24000,atempo=${tempo.toFixed(3)},bass=g=4.0:f=165,equalizer=f=1450:t=q:w=1.1:g=2.5`;
}

// Divide frases longas em blocos de até 185 caracteres respeitando pontuação
function splitTextChunks(rawText: string, maxLen = 185): string[] {
  const cleaned = rawText
    .replace(/<breath>|<gasp>|<laugh>/gi, '')
    .replace(/\|[^|]*\|/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (!current) {
      current = s.slice(0, maxLen);
    } else if (current.length + 1 + s.length <= maxLen) {
      current += ` ${s}`;
    } else {
      chunks.push(current);
      current = s.slice(0, maxLen);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function runFfmpegAudioFilter(inputMp3: Buffer, filterGraph: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-af',
      filterGraph,
      '-f',
      's16le',
      '-ac',
      '1',
      '-ar',
      '24000',
      'pipe:1',
    ]);

    const outChunks: Buffer[] = [];
    let errText = '';

    ff.stdout.on('data', (chunk: Buffer) => {
      outChunks.push(chunk);
    });
    ff.stderr.on('data', (chunk: Buffer) => {
      errText += chunk.toString();
    });
    ff.on('error', (err) => {
      reject(err);
    });
    ff.on('close', (code) => {
      if (code === 0 && outChunks.length > 0) {
        resolve(Buffer.concat(outChunks));
      } else {
        reject(new Error(`FFMPEG_MALE_MASTER_FAILED_${code}: ${errText}`));
      }
    });

    ff.stdin.on('error', () => {
      // ignore EPIPE if process closes early
    });
    ff.stdin.end(inputMp3);
  });
}

// Motor vocal masculino em português ilimitado (zero cota 429): busca fonética PT-BR e masteriza com Rubberband Formant+Pitch Shift em barítono masculino real
async function synthesizeUnlimitedMalePortuguesePcm(
  text: string,
  mood: NarrationMood,
  speaker: BroadcastSpeaker
): Promise<Buffer> {
  const segments = splitTextChunks(text, 185);
  if (segments.length === 0) {
    throw new Error('EMPTY_TTS_TEXT');
  }

  const mp3Buffers: Buffer[] = [];
  for (const seg of segments) {
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=${encodeURIComponent(seg)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      throw new Error(`FALLBACK_TTS_HTTP_${response.status}`);
    }
    const ab = await response.arrayBuffer();
    if (ab.byteLength > 64) {
      mp3Buffers.push(Buffer.from(ab));
    }
  }

  if (mp3Buffers.length === 0) {
    throw new Error('FALLBACK_TTS_EMPTY_MP3');
  }

  const combinedMp3 = Buffer.concat(mp3Buffers);
  try {
    return await runFfmpegAudioFilter(combinedMp3, getMaleRubberbandFilter(speaker, mood));
  } catch {
    return await runFfmpegAudioFilter(combinedMp3, getMaleStandardFfmpegFilter(speaker, mood));
  }
}

async function synthesizeMaleNarrationWav(
  text: string,
  mood: NarrationMood,
  speaker: BroadcastSpeaker = 'galvao'
): Promise<{ buffer: Buffer; engine: 'GEMINI' | 'STUDIO-MALE-PT' }> {
  try {
    const ai = getGenAIClient();
    const style = getStyleForSpeakerAndMood(speaker, mood);
    const voiceName = SPEAKER_VOICES[speaker];
    const expressiveText = decorateExpressiveText(text, speaker, mood, false);

    for (const modelName of getOrderedTtsModels()) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: expressiveText,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error('EMPTY_AUDIO_RESPONSE');
        }
        return { buffer: Buffer.from(base64Audio, 'base64'), engine: 'GEMINI' };
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          markModelQuotaExceeded(modelName, err);
          continue;
        }
        break;
      }
    }
  } catch {
    // Segue imediatamente para o motor vocal masculino em português ilimitado do servidor
  }

  // Fallback ilimitado de voz masculina em português (quando ambos os modelos Gemini TTS atingem limite de cota)
  const fallbackPcm = await synthesizeUnlimitedMalePortuguesePcm(text, mood, speaker);
  return { buffer: wrapPcm16AsWav(fallbackPcm, 24000), engine: 'STUDIO-MALE-PT' };
}

// Síntese de Bate-Bola em Dupla real (multiSpeakerVoiceConfig com 2 locutores + fallback automático entre modelos + fallback vocal masculino ilimitado)
async function synthesizeDialogueWav(
  turns: DialogueTurn[],
  mood: NarrationMood
): Promise<{ buffer: Buffer; engine: 'GEMINI' | 'STUDIO-MALE-PT' }> {
  // Garante exatamente 2 locutores distintos no multiSpeakerVoiceConfig
  const uniqueSpeakers: BroadcastSpeaker[] = [];
  for (const t of turns) {
    if (!uniqueSpeakers.includes(t.speaker)) {
      uniqueSpeakers.push(t.speaker);
    }
  }
  if (uniqueSpeakers.length < 2) {
    const solo = turns[0];
    return synthesizeMaleNarrationWav(solo.text, mood, solo.speaker);
  }

  try {
    const ai = getGenAIClient();
    const spkA = uniqueSpeakers[0];
    const spkB = uniqueSpeakers[1];
    const labelA = SPEAKER_LABELS[spkA];
    const labelB = SPEAKER_LABELS[spkB];

    // Garante que as 2 vozes pré-construídas na dupla nunca colidam
    const voiceA = SPEAKER_VOICES[spkA];
    const voiceB =
      SPEAKER_VOICES[spkB] === voiceA
        ? voiceA === 'Puck'
          ? 'Charon'
          : 'Puck'
        : SPEAKER_VOICES[spkB];

    const parts = turns.slice(0, 4).map((turn, idx) => {
      const activeSpk = turn.speaker === spkA || turn.speaker === spkB ? turn.speaker : spkB;
      const label = SPEAKER_LABELS[activeSpk];
      const spoken = decorateExpressiveText(turn.text, activeSpk, mood, idx > 0);
      return {
        text: `${label}: ${spoken}`,
        speechMetadata: {
          speaker: label,
          style: getStyleForSpeakerAndMood(activeSpk, mood),
        },
      };
    });

    for (const modelName of getOrderedTtsModels()) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: labelA,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceA },
                    },
                  },
                  {
                    speaker: labelB,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceB },
                    },
                  },
                ],
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error('EMPTY_DIALOGUE_AUDIO');
        }
        return { buffer: Buffer.from(base64Audio, 'base64'), engine: 'GEMINI' };
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          markModelQuotaExceeded(modelName, err);
          continue;
        }
        break;
      }
    }
  } catch {
    // Segue para síntese de diálogo em dupla no motor masculino PT-BR ilimitado
  }

  // Fallback ilimitado em dupla: sintetiza cada fala com o timbre masculino específico do locutor (Galvão + Comentarista) e concatena com pausa de 120ms
  const turnPcms: Buffer[] = [];
  const pausePcm = Buffer.alloc(Math.floor(24000 * 0.12) * 2); // 120ms de silêncio 16-bit entre locutores
  for (let i = 0; i < turns.slice(0, 4).length; i++) {
    const turn = turns[i];
    const pcm = await synthesizeUnlimitedMalePortuguesePcm(turn.text, mood, turn.speaker);
    if (i > 0) turnPcms.push(pausePcm);
    turnPcms.push(pcm);
  }
  return { buffer: wrapPcm16AsWav(Buffer.concat(turnPcms), 24000), engine: 'STUDIO-MALE-PT' };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Streaming PCM 24kHz mono 16-bit LE com Voice Design e fallback automático para alta disponibilidade
  app.post('/api/narrate/stream', async (req: Request, res: Response) => {
    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const mood = parseMood(req.body?.mood);
    const speaker = parseSpeaker(req.body?.speaker);

    if (!rawText) {
      res.status(400).json({ error: 'Texto da narração é obrigatório.' });
      return;
    }

    const text = rawText.slice(0, 240);
    const cacheKey = `${speaker}::${mood}::${text.toLowerCase()}`;

    try {
      const cachedPcm = pcmCache.get(cacheKey);
      if (cachedPcm) {
        pcmCache.delete(cacheKey);
        pcmCache.set(cacheKey, cachedPcm);
        res.setHeader('Content-Type', 'audio/pcm');
        res.setHeader('X-Sample-Rate', '24000');
        res.setHeader('X-Narration-Cache', 'HIT');
        res.setHeader('X-Narration-Engine', 'STUDIO-MALE-PT');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).end(cachedPcm);
        return;
      }

      const chunks: Buffer[] = [];
      let headersFlushed = false;

      try {
        const ai = getGenAIClient();
        const style = getStyleForSpeakerAndMood(speaker, mood);
        const voiceName = SPEAKER_VOICES[speaker];
        const expressiveText = decorateExpressiveText(text, speaker, mood, false);

        for (const modelName of getOrderedTtsModels()) {
          try {
            const stream = await ai.models.generateContentStream({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: expressiveText,
                      speechMetadata: {
                        style,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName,
                    },
                  },
                },
              },
            });

            // Só envia os cabeçalhos HTTP quando o primeiro bloco real de áudio chegar (evita resposta vazia em erro 429 durante o for-await)
            for await (const chunk of stream) {
              if (clientClosed) break;
              const base64Audio = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                const pcmBuf = Buffer.from(base64Audio, 'base64');
                if (pcmBuf.length > 0) {
                  if (!headersFlushed) {
                    headersFlushed = true;
                    res.setHeader('Content-Type', 'audio/pcm');
                    res.setHeader('X-Sample-Rate', '24000');
                    res.setHeader('X-Narration-Cache', 'MISS');
                    res.setHeader('X-Narration-Engine', 'GEMINI');
                    res.setHeader('Cache-Control', 'no-store');
                    res.setHeader('X-Accel-Buffering', 'no');
                    res.flushHeaders?.();
                  }
                  chunks.push(pcmBuf);
                  res.write(pcmBuf);
                }
              }
            }

            if (chunks.length > 0) {
              break;
            }
          } catch (err) {
            if (isQuotaOrRateLimitError(err)) {
              markModelQuotaExceeded(modelName, err);
              if (!headersFlushed) {
                continue;
              }
            }
            break;
          }
        }
      } catch {
        // Chave ausente ou erro de rede -> cai direto no sintetizador masculino PT-BR abaixo
      }

      if (chunks.length > 0) {
        if (!clientClosed) {
          res.end();
          cacheSet(pcmCache, cacheKey, Buffer.concat(chunks));
        }
        return;
      }

      // Ambos os modelos Gemini TTS estão em cooldown de cota (ou falharam antes do 1º byte) -> usa o sintetizador vocal masculino em português ilimitado do servidor!
      const fallbackPcm = await synthesizeUnlimitedMalePortuguesePcm(text, mood, speaker);
      if (!clientClosed && !res.headersSent) {
        cacheSet(pcmCache, cacheKey, fallbackPcm);
        res.setHeader('Content-Type', 'audio/pcm');
        res.setHeader('X-Sample-Rate', '24000');
        res.setHeader('X-Narration-Cache', 'MISS');
        res.setHeader('X-Narration-Engine', 'STUDIO-MALE-PT');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).end(fallbackPcm);
      } else if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        try {
          const fallbackPcm = await synthesizeUnlimitedMalePortuguesePcm(text, mood, speaker);
          cacheSet(pcmCache, cacheKey, fallbackPcm);
          res.setHeader('Content-Type', 'audio/pcm');
          res.setHeader('X-Sample-Rate', '24000');
          res.setHeader('X-Narration-Engine', 'STUDIO-MALE-PT');
          res.setHeader('Cache-Control', 'no-store');
          res.status(200).end(fallbackPcm);
          return;
        } catch {
          res.status(204).end();
          return;
        }
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // Rota de Bate-Bola em Dupla (Galvão + Casagrande / Ronaldo / Craque Neto) com multiSpeakerVoiceConfig
  app.post('/api/narrate/dialogue', async (req: Request, res: Response) => {
    try {
      const rawTurns = Array.isArray(req.body?.turns) ? req.body.turns : [];
      const mood = parseMood(req.body?.mood);

      const turns: DialogueTurn[] = [];
      for (const item of rawTurns.slice(0, 4)) {
        const speaker = parseSpeaker(item?.speaker);
        const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 210) : '';
        if (text) {
          turns.push({ speaker, text });
        }
      }

      if (turns.length === 0) {
        res.status(400).json({ error: 'Falas do diálogo são obrigatórias.' });
        return;
      }

      const cacheKey = `duo::${mood}::${turns
        .map((t) => `${t.speaker}:${t.text.toLowerCase()}`)
        .join('|')}`;

      const cached = dialogueWavCache.get(cacheKey);
      if (cached) {
        dialogueWavCache.delete(cacheKey);
        dialogueWavCache.set(cacheKey, cached);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-Narration-Cache', 'HIT');
        res.setHeader('X-Narration-Engine', 'STUDIO-MALE-PT');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(cached);
        return;
      }

      let engineUsed: 'GEMINI' | 'STUDIO-MALE-PT' = 'STUDIO-MALE-PT';
      let pending = inFlightTts.get(cacheKey);
      if (!pending) {
        pending = synthesizeDialogueWav(turns, mood)
          .then((result) => {
            engineUsed = result.engine;
            cacheSet(dialogueWavCache, cacheKey, result.buffer);
            return result.buffer;
          })
          .finally(() => {
            inFlightTts.delete(cacheKey);
          });
        inFlightTts.set(cacheKey, pending);
      }

      const wavBuffer = await pending;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('X-Narration-Cache', 'MISS');
      res.setHeader('X-Narration-Engine', engineUsed);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(wavBuffer);
    } catch {
      res.status(204).end();
    }
  });

  // Rota WAV completa (solo) com Voice Design
  app.post('/api/narrate', async (req: Request, res: Response) => {
    try {
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const mood = parseMood(req.body?.mood);
      const speaker = parseSpeaker(req.body?.speaker);

      if (!rawText) {
        res.status(400).json({ error: 'Texto da narração é obrigatório.' });
        return;
      }

      const text = rawText.slice(0, 260);
      const cacheKey = `${speaker}::${mood}::${text.toLowerCase()}`;

      const cached = wavCache.get(cacheKey);
      if (cached) {
        wavCache.delete(cacheKey);
        wavCache.set(cacheKey, cached);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-Narration-Cache', 'HIT');
        res.setHeader('X-Narration-Engine', 'STUDIO-MALE-PT');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(cached);
        return;
      }

      let engineUsed: 'GEMINI' | 'STUDIO-MALE-PT' = 'STUDIO-MALE-PT';
      let pending = inFlightTts.get(cacheKey);
      if (!pending) {
        pending = synthesizeMaleNarrationWav(text, mood, speaker)
          .then((result) => {
            engineUsed = result.engine;
            cacheSet(wavCache, cacheKey, result.buffer);
            return result.buffer;
          })
          .finally(() => {
            inFlightTts.delete(cacheKey);
          });
        inFlightTts.set(cacheKey, pending);
      }

      const wavBuffer = await pending;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('X-Narration-Cache', 'MISS');
      res.setHeader('X-Narration-Engine', engineUsed);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(wavBuffer);
    } catch {
      res.status(204).end();
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
