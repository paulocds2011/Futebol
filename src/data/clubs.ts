import { Club, FormationId, Kit, PlayerRole, SquadPlayer } from '../types/game';

const SKIN_LIGHT = '#f2c19b';
const SKIN_TAN = '#d99b6c';
const SKIN_MED = '#b87449';
const SKIN_DARK = '#7c4628';

const HAIR_BLK = '#1a1718';
const HAIR_BRN = '#4a2e1b';
const HAIR_BLD = '#d4aa48';
const HAIR_GRY = '#9ca3af';

type RawClub = Omit<Club, 'bench'>;

const RAW_CLUBS: RawClub[] = [
  // 1. FLAMENGO
  {
    id: 'fla',
    name: 'Flamengo',
    shortName: 'FLA',
    division: 'SÉRIE A',
    stats: { attack: 95, defense: 90, speed: 92 },
    crest: {
      pattern: 'hoops',
      primary: '#d91620',
      secondary: '#111111',
      accent: '#ffffff',
      border: '#facc15',
    },
    homeKit: {
      pattern: 'hoops',
      primary: '#d91620',
      secondary: '#121212',
      shorts: '#ffffff',
      socks: '#d91620',
      gkShirt: '#38bdf8',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-bands',
      primary: '#f8fafc',
      secondary: '#d91620',
      tertiary: '#121212',
      shorts: '#121212',
      socks: '#f8fafc',
      gkShirt: '#f59e0b',
      numberColor: '#121212',
    },
    crowdColors: ['#d91620', '#121212', '#ffffff'],
    squad: [
      { name: 'Rossi', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Léo Ortiz', number: 3, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 4, spdMod: 2 },
      { name: 'Alex Sandro', number: 26, role: 'DEF', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Jorginho', number: 21, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 3, defMod: 3, spdMod: 2 },
      { name: 'Arrascaeta', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 5, defMod: 1, spdMod: 3 },
      { name: 'Lucas Paquetá', number: 11, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 2, spdMod: 4 },
      { name: 'Pedro', number: 9, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BLK, atkMod: 6, defMod: 0, spdMod: 2 },
    ],
  },

  // 2. PALMEIRAS
  {
    id: 'pal',
    name: 'Palmeiras',
    shortName: 'PAL',
    division: 'SÉRIE A',
    stats: { attack: 93, defense: 92, speed: 91 },
    crest: {
      pattern: 'solid-star',
      primary: '#006437',
      secondary: '#ffffff',
      accent: '#facc15',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#006b3c',
      secondary: '#ffffff',
      shorts: '#ffffff',
      socks: '#006b3c',
      gkShirt: '#1e3a8a',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#006b3c',
      shorts: '#006b3c',
      socks: '#f8fafc',
      gkShirt: '#f97316',
      numberColor: '#006b3c',
    },
    crowdColors: ['#006b3c', '#ffffff', '#10b981'],
    squad: [
      { name: 'Carlos Miguel', number: 1, role: 'GK', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Gustavo Gómez', number: 15, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 5, spdMod: 1 },
      { name: 'Piquerez', number: 22, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 3, spdMod: 4 },
      { name: 'Richard Ríos', number: 8, role: 'MID', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 4 },
      { name: 'Andreas Pereira', number: 18, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 2, spdMod: 3 },
      { name: 'Paulinho', number: 10, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 5 },
      { name: 'Vitor Roque', number: 9, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 5 },
    ],
  },

  // 3. CORINTHIANS
  {
    id: 'cor',
    name: 'Corinthians',
    shortName: 'COR',
    division: 'SÉRIE A',
    stats: { attack: 90, defense: 85, speed: 89 },
    crest: {
      pattern: 'cross',
      primary: '#ffffff',
      secondary: '#111111',
      accent: '#dc2626',
      border: '#111111',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#f8fafc',
      secondary: '#111111',
      shorts: '#111111',
      socks: '#f8fafc',
      gkShirt: '#eab308',
      numberColor: '#111111',
    },
    awayKit: {
      pattern: 'stripes',
      primary: '#121212',
      secondary: '#333333',
      shorts: '#f8fafc',
      socks: '#121212',
      gkShirt: '#22c55e',
      numberColor: '#ffffff',
    },
    crowdColors: ['#ffffff', '#121212', '#dc2626'],
    squad: [
      { name: 'Hugo Souza', number: 1, role: 'GK', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'André Ramalho', number: 5, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BRN, atkMod: 1, defMod: 4, spdMod: 1 },
      { name: 'Matheuzinho', number: 2, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 2, spdMod: 4 },
      { name: 'Rodrigo Garro', number: 8, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 5, defMod: 1, spdMod: 3 },
      { name: 'Jesse Lingard', number: 14, role: 'MID', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'Yuri Alberto', number: 9, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 5, defMod: 1, spdMod: 4 },
      { name: 'Memphis Depay', number: 10, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 5, defMod: 0, spdMod: 4 },
    ],
  },

  // 4. SANTOS
  {
    id: 'san',
    name: 'Santos',
    shortName: 'SAN',
    division: 'SÉRIE A',
    stats: { attack: 91, defense: 82, speed: 90 },
    crest: {
      pattern: 'stripes',
      primary: '#ffffff',
      secondary: '#111111',
      accent: '#facc15',
      border: '#111111',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#ffffff',
      secondary: '#111111',
      shorts: '#ffffff',
      socks: '#ffffff',
      gkShirt: '#2563eb',
      numberColor: '#111111',
    },
    awayKit: {
      pattern: 'stripes',
      primary: '#111111',
      secondary: '#ffffff',
      shorts: '#111111',
      socks: '#111111',
      gkShirt: '#f59e0b',
      numberColor: '#facc15',
    },
    crowdColors: ['#ffffff', '#111111', '#facc15'],
    squad: [
      { name: 'Gabriel Brazão', number: 77, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Luan Peres', number: 14, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Escobar', number: 31, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'P. Coutinho', number: 11, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 3 },
      { name: 'E. Cebolinha', number: 7, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Neymar', number: 10, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 6, defMod: 0, spdMod: 5 },
      { name: 'Gabigol', number: 9, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 5, defMod: 0, spdMod: 3 },
    ],
  },

  // 5. SÃO PAULO
  {
    id: 'sao',
    name: 'São Paulo',
    shortName: 'SAO',
    division: 'SÉRIE A',
    stats: { attack: 87, defense: 87, speed: 86 },
    crest: {
      pattern: 'sp-shield',
      primary: '#ffffff',
      secondary: '#dc2626',
      accent: '#111111',
      border: '#111111',
    },
    homeKit: {
      pattern: 'chest-bands',
      primary: '#ffffff',
      secondary: '#dc2626',
      tertiary: '#111111',
      shorts: '#ffffff',
      socks: '#ffffff',
      gkShirt: '#16a34a',
      numberColor: '#111111',
    },
    awayKit: {
      pattern: 'tricolor-v',
      primary: '#dc2626',
      secondary: '#111111',
      tertiary: '#ffffff',
      shorts: '#111111',
      socks: '#111111',
      gkShirt: '#0ea5e9',
      numberColor: '#ffffff',
    },
    crowdColors: ['#dc2626', '#ffffff', '#111111'],
    squad: [
      { name: 'Rafael', number: 23, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Arboleda', number: 5, role: 'DEF', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 1, defMod: 5, spdMod: 2 },
      { name: 'Alan Franco', number: 28, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 3 },
      { name: 'Pablo Maia', number: 29, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'Lucas Moura', number: 7, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 5 },
      { name: 'Luciano', number: 10, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Calleri', number: 9, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 5, defMod: 1, spdMod: 2 },
    ],
  },

  // 6. CRUZEIRO
  {
    id: 'cru',
    name: 'Cruzeiro',
    shortName: 'CRU',
    division: 'SÉRIE A',
    stats: { attack: 86, defense: 86, speed: 86 },
    crest: {
      pattern: 'solid-star',
      primary: '#0047ab',
      secondary: '#ffffff',
      accent: '#60a5fa',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#0052b4',
      secondary: '#ffffff',
      shorts: '#ffffff',
      socks: '#0052b4',
      gkShirt: '#facc15',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#0052b4',
      shorts: '#0052b4',
      socks: '#f8fafc',
      gkShirt: '#ef4444',
      numberColor: '#0052b4',
    },
    crowdColors: ['#0052b4', '#ffffff', '#38bdf8'],
    squad: [
      { name: 'Cássio', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 5, spdMod: 1 },
      { name: 'William', number: 12, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 4 },
      { name: 'João Marcelo', number: 43, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Lucas Romero', number: 29, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BLK, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'M. Pereira', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 4 },
      { name: 'Wanderson', number: 11, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 3, defMod: 1, spdMod: 5 },
      { name: 'Kaio Jorge', number: 19, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 0, spdMod: 4 },
    ],
  },

  // 7. ATLÉTICO-MG
  {
    id: 'cam',
    name: 'Atlético-MG',
    shortName: 'CAM',
    division: 'SÉRIE A',
    stats: { attack: 88, defense: 84, speed: 86 },
    crest: {
      pattern: 'stripes',
      primary: '#111111',
      secondary: '#ffffff',
      accent: '#facc15',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'stripes',
      primary: '#111111',
      secondary: '#ffffff',
      shorts: '#111111',
      socks: '#ffffff',
      gkShirt: '#22c55e',
      numberColor: '#facc15',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#111111',
      shorts: '#ffffff',
      socks: '#111111',
      gkShirt: '#ef4444',
      numberColor: '#111111',
    },
    crowdColors: ['#111111', '#ffffff', '#94a3b8'],
    squad: [
      { name: 'Everson', number: 22, role: 'GK', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Natanael', number: 2, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 4 },
      { name: 'Junior Alonso', number: 6, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Gustavo Scarpa', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 2, spdMod: 3 },
      { name: 'Bernard', number: 11, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'Dudu', number: 92, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Hulk', number: 7, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 6, defMod: 1, spdMod: 3 },
    ],
  },

  // 8. FLUMINENSE
  {
    id: 'flu',
    name: 'Fluminense',
    shortName: 'FLU',
    division: 'SÉRIE A',
    stats: { attack: 85, defense: 85, speed: 84 },
    crest: {
      pattern: 'tricolor-v',
      primary: '#8a1538',
      secondary: '#006341',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'tricolor-v',
      primary: '#8a1538',
      secondary: '#006341',
      tertiary: '#ffffff',
      shorts: '#ffffff',
      socks: '#ffffff',
      gkShirt: '#38bdf8',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-bands',
      primary: '#f8fafc',
      secondary: '#8a1538',
      tertiary: '#006341',
      shorts: '#8a1538',
      socks: '#f8fafc',
      gkShirt: '#facc15',
      numberColor: '#8a1538',
    },
    crowdColors: ['#8a1538', '#006341', '#ffffff'],
    squad: [
      { name: 'Fábio', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_GRY, atkMod: 0, defMod: 5, spdMod: 1 },
      { name: 'Thiago Silva', number: 3, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 6, spdMod: 2 },
      { name: 'Samuel Xavier', number: 2, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Martinelli', number: 8, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Ganso', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 1 },
      { name: 'Jhon Arias', number: 21, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 2, spdMod: 5 },
      { name: 'Germán Cano', number: 14, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 5, defMod: 0, spdMod: 2 },
    ],
  },

  // 9. BOTAFOGO
  {
    id: 'bot',
    name: 'Botafogo',
    shortName: 'BOT',
    division: 'SÉRIE A',
    stats: { attack: 88, defense: 86, speed: 89 },
    crest: {
      pattern: 'solid-star',
      primary: '#111111',
      secondary: '#ffffff',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'stripes',
      primary: '#111111',
      secondary: '#ffffff',
      shorts: '#111111',
      socks: '#111111',
      gkShirt: '#ef4444',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'solid',
      primary: '#1e293b',
      secondary: '#f8fafc',
      shorts: '#0f172a',
      socks: '#1e293b',
      gkShirt: '#facc15',
      numberColor: '#ffffff',
    },
    crowdColors: ['#111111', '#ffffff', '#cbd5e1'],
    squad: [
      { name: 'John', number: 12, role: 'GK', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Barboza', number: 20, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 1, defMod: 5, spdMod: 2 },
      { name: 'Alex Telles', number: 13, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'Marlon Freitas', number: 17, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'Savarino', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 4 },
      { name: 'M. Martins', number: 11, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Igor Jesus', number: 99, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 4 },
    ],
  },

  // 10. VASCO DA GAMA
  {
    id: 'vas',
    name: 'Vasco da Gama',
    shortName: 'VAS',
    division: 'SÉRIE A',
    stats: { attack: 83, defense: 81, speed: 84 },
    crest: {
      pattern: 'sash',
      primary: '#ffffff',
      secondary: '#111111',
      accent: '#dc2626',
      border: '#111111',
    },
    homeKit: {
      pattern: 'sash',
      primary: '#ffffff',
      secondary: '#111111',
      tertiary: '#dc2626',
      shorts: '#111111',
      socks: '#ffffff',
      gkShirt: '#10b981',
      numberColor: '#dc2626',
    },
    awayKit: {
      pattern: 'sash',
      primary: '#111111',
      secondary: '#ffffff',
      tertiary: '#dc2626',
      shorts: '#ffffff',
      socks: '#111111',
      gkShirt: '#38bdf8',
      numberColor: '#ffffff',
    },
    crowdColors: ['#111111', '#ffffff', '#dc2626'],
    squad: [
      { name: 'Léo Jardim', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 5, spdMod: 2 },
      { name: 'Paulo Henrique', number: 96, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 5 },
      { name: 'Lucas Piton', number: 6, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'Thiago Mendes', number: 23, role: 'MID', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'Hugo Moura', number: 25, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'David', number: 7, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'Vegetti', number: 99, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BLD, atkMod: 6, defMod: 1, spdMod: 2 },
    ],
  },

  // 11. GRÊMIO
  {
    id: 'gre',
    name: 'Grêmio',
    shortName: 'GRE',
    division: 'SÉRIE A',
    stats: { attack: 84, defense: 83, speed: 84 },
    crest: {
      pattern: 'tricolor-h',
      primary: '#0ea5e9',
      secondary: '#111111',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'tricolor-v',
      primary: '#0284c7',
      secondary: '#111111',
      tertiary: '#ffffff',
      shorts: '#111111',
      socks: '#ffffff',
      gkShirt: '#f59e0b',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-bands',
      primary: '#f8fafc',
      secondary: '#0284c7',
      tertiary: '#111111',
      shorts: '#0284c7',
      socks: '#f8fafc',
      gkShirt: '#ef4444',
      numberColor: '#111111',
    },
    crowdColors: ['#0284c7', '#111111', '#ffffff'],
    squad: [
      { name: 'Marchesín', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Kannemann', number: 4, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 1, defMod: 5, spdMod: 1 },
      { name: 'João Pedro', number: 18, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Villasanti', number: 20, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 4, spdMod: 3 },
      { name: 'Cristaldo', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Soteldo', number: 7, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 0, spdMod: 5 },
      { name: 'Braithwaite', number: 22, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 4 },
    ],
  },

  // 12. INTERNACIONAL
  {
    id: 'int',
    name: 'Internacional',
    shortName: 'INT',
    division: 'SÉRIE A',
    stats: { attack: 86, defense: 85, speed: 86 },
    crest: {
      pattern: 'solid-star',
      primary: '#d01222',
      secondary: '#ffffff',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#d01222',
      secondary: '#ffffff',
      shorts: '#ffffff',
      socks: '#d01222',
      gkShirt: '#1e293b',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#d01222',
      shorts: '#d01222',
      socks: '#f8fafc',
      gkShirt: '#22c55e',
      numberColor: '#d01222',
    },
    crowdColors: ['#d01222', '#ffffff', '#991b1b'],
    squad: [
      { name: 'Rochet', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 5, spdMod: 1 },
      { name: 'Vitão', number: 44, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 3 },
      { name: 'Bernabei', number: 26, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 3, defMod: 3, spdMod: 4 },
      { name: 'Fernando', number: 5, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 4, spdMod: 2 },
      { name: 'Alan Patrick', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 3 },
      { name: 'Wesley', number: 21, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Rafael Borré', number: 19, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 4 },
    ],
  },

  // 13. BAHIA
  {
    id: 'bah',
    name: 'Bahia',
    shortName: 'BAH',
    division: 'SÉRIE A',
    stats: { attack: 84, defense: 82, speed: 85 },
    crest: {
      pattern: 'tricolor-h',
      primary: '#0057b8',
      secondary: '#e11d48',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'chest-detail',
      primary: '#ffffff',
      secondary: '#0057b8',
      tertiary: '#e11d48',
      shorts: '#0057b8',
      socks: '#e11d48',
      gkShirt: '#facc15',
      numberColor: '#0057b8',
    },
    awayKit: {
      pattern: 'tricolor-v',
      primary: '#0057b8',
      secondary: '#e11d48',
      tertiary: '#ffffff',
      shorts: '#ffffff',
      socks: '#0057b8',
      gkShirt: '#10b981',
      numberColor: '#ffffff',
    },
    crowdColors: ['#0057b8', '#e11d48', '#ffffff'],
    squad: [
      { name: 'Marcos Felipe', number: 22, role: 'GK', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 0, defMod: 3, spdMod: 2 },
      { name: 'Gabriel Xavier', number: 3, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Luciano Juba', number: 46, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 4 },
      { name: 'Caio Alexandre', number: 19, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'E. Ribeiro', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 5, defMod: 1, spdMod: 3 },
      { name: 'Jean Lucas', number: 6, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 2, spdMod: 4 },
      { name: 'Everaldo', number: 9, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
    ],
  },

  // 14. ATHLETICO-PR
  {
    id: 'cap',
    name: 'Athletico-PR',
    shortName: 'CAP',
    division: 'SÉRIE A',
    stats: { attack: 82, defense: 80, speed: 84 },
    crest: {
      pattern: 'diagonal-split',
      primary: '#d91620',
      secondary: '#111111',
      accent: '#ffffff',
      border: '#d91620',
    },
    homeKit: {
      pattern: 'sash',
      primary: '#d91620',
      secondary: '#111111',
      shorts: '#111111',
      socks: '#111111',
      gkShirt: '#38bdf8',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#d91620',
      tertiary: '#111111',
      shorts: '#111111',
      socks: '#f8fafc',
      gkShirt: '#22c55e',
      numberColor: '#111111',
    },
    crowdColors: ['#d91620', '#111111', '#f8fafc'],
    squad: [
      { name: 'Mycael', number: 1, role: 'GK', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'G. Benavídez', number: 4, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'L. Esquivel', number: 37, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 3, defMod: 3, spdMod: 4 },
      { name: 'Felipinho', number: 5, role: 'MID', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Bruno Zapelli', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'S. Mendoza', number: 20, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Kevin Viveros', number: 9, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 5, defMod: 0, spdMod: 4 },
    ],
  },

  // 15. CORITIBA
  {
    id: 'cfc',
    name: 'Coritiba',
    shortName: 'CFC',
    division: 'SÉRIE A',
    stats: { attack: 79, defense: 79, speed: 80 },
    crest: {
      pattern: 'solid-star',
      primary: '#006847',
      secondary: '#ffffff',
      accent: '#facc15',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'chest-bands',
      primary: '#ffffff',
      secondary: '#006847',
      tertiary: '#006847',
      shorts: '#111111',
      socks: '#ffffff',
      gkShirt: '#f97316',
      numberColor: '#006847',
    },
    awayKit: {
      pattern: 'stripes',
      primary: '#006847',
      secondary: '#ffffff',
      shorts: '#ffffff',
      socks: '#006847',
      gkShirt: '#38bdf8',
      numberColor: '#ffffff',
    },
    crowdColors: ['#006847', '#ffffff', '#111111'],
    squad: [
      { name: 'Pedro Morisco', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Bruno Melo', number: 26, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Maicon', number: 4, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 1 },
      { name: 'S. Gómez', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'Josué', number: 7, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Lucas Ronier', number: 11, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Pedro Rocha', number: 9, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 0, spdMod: 3 },
    ],
  },

  // 16. VITÓRIA
  {
    id: 'vit',
    name: 'Vitória',
    shortName: 'VIT',
    division: 'SÉRIE A',
    stats: { attack: 79, defense: 78, speed: 81 },
    crest: {
      pattern: 'hoops',
      primary: '#c8102e',
      secondary: '#111111',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'hoops',
      primary: '#c8102e',
      secondary: '#111111',
      shorts: '#111111',
      socks: '#c8102e',
      gkShirt: '#facc15',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#c8102e',
      tertiary: '#111111',
      shorts: '#111111',
      socks: '#f8fafc',
      gkShirt: '#0ea5e9',
      numberColor: '#c8102e',
    },
    crowdColors: ['#c8102e', '#111111', '#ffffff'],
    squad: [
      { name: 'Lucas Arcanjo', number: 1, role: 'GK', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Camutanga', number: 13, role: 'DEF', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Zé Marcos', number: 4, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 1, defMod: 3, spdMod: 2 },
      { name: 'G. Baralhas', number: 5, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'Matheuzinho', number: 30, role: 'MID', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'Marinho', number: 11, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 0, spdMod: 4 },
      { name: 'Renato Kayzer', number: 9, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
    ],
  },

  // 17. RB BRAGANTINO
  {
    id: 'rbb',
    name: 'RB Bragantino',
    shortName: 'RBB',
    division: 'SÉRIE A',
    stats: { attack: 81, defense: 80, speed: 84 },
    crest: {
      pattern: 'diamond',
      primary: '#ffffff',
      secondary: '#e11d48',
      accent: '#facc15',
      border: '#1e3a8a',
    },
    homeKit: {
      pattern: 'chest-detail',
      primary: '#ffffff',
      secondary: '#e11d48',
      tertiary: '#1e3a8a',
      shorts: '#e11d48',
      socks: '#ffffff',
      gkShirt: '#22c55e',
      numberColor: '#1e3a8a',
    },
    awayKit: {
      pattern: 'solid',
      primary: '#0f172a',
      secondary: '#e11d48',
      shorts: '#0f172a',
      socks: '#e11d48',
      gkShirt: '#facc15',
      numberColor: '#ffffff',
    },
    crowdColors: ['#ffffff', '#e11d48', '#1e3a8a'],
    squad: [
      { name: 'Cleiton', number: 1, role: 'GK', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Pedro Henrique', number: 14, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'J. Capixaba', number: 29, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 4 },
      { name: 'L. Evangelista', number: 8, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'Lincoln', number: 10, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Helinho', number: 11, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Eduardo Sasha', number: 19, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
    ],
  },

  // 18. MIRASSOL
  {
    id: 'mir',
    name: 'Mirassol',
    shortName: 'MIR',
    division: 'SÉRIE A',
    stats: { attack: 78, defense: 79, speed: 80 },
    crest: {
      pattern: 'diagonal-split',
      primary: '#facc15',
      secondary: '#15803d',
      accent: '#ffffff',
      border: '#15803d',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#facc15',
      secondary: '#15803d',
      shorts: '#15803d',
      socks: '#facc15',
      gkShirt: '#1d4ed8',
      numberColor: '#14532d',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#15803d',
      secondary: '#facc15',
      shorts: '#ffffff',
      socks: '#15803d',
      gkShirt: '#ef4444',
      numberColor: '#facc15',
    },
    crowdColors: ['#facc15', '#15803d', '#ffffff'],
    squad: [
      { name: 'Walter', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Reinaldo', number: 6, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'João Victor', number: 4, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Neto Moura', number: 8, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Shaylon', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Alesson', number: 11, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'André Luís', number: 9, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 3 },
    ],
  },

  // 19. CHAPECOENSE
  {
    id: 'cha',
    name: 'Chapecoense',
    shortName: 'CHA',
    division: 'SÉRIE A',
    stats: { attack: 75, defense: 76, speed: 78 },
    crest: {
      pattern: 'solid-star',
      primary: '#16a34a',
      secondary: '#ffffff',
      accent: '#facc15',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#16a34a',
      secondary: '#ffffff',
      shorts: '#16a34a',
      socks: '#16a34a',
      gkShirt: '#f59e0b',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#16a34a',
      shorts: '#f8fafc',
      socks: '#16a34a',
      gkShirt: '#1e3a8a',
      numberColor: '#16a34a',
    },
    crowdColors: ['#16a34a', '#ffffff', '#14532d'],
    squad: [
      { name: 'Anderson', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 3, spdMod: 1 },
      { name: 'Bruno Pacheco', number: 6, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Rafael Thyere', number: 3, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Yago Felipe', number: 8, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'G. Augusto', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 2 },
      { name: 'Marcinho', number: 7, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 3, defMod: 1, spdMod: 4 },
      { name: 'Y. Bolasie', number: 11, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
    ],
  },

  // 20. REMO
  {
    id: 'rem',
    name: 'Remo',
    shortName: 'REM',
    division: 'SÉRIE A',
    stats: { attack: 77, defense: 76, speed: 79 },
    crest: {
      pattern: 'solid-star',
      primary: '#172554',
      secondary: '#ffffff',
      accent: '#38bdf8',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'solid',
      primary: '#172554',
      secondary: '#ffffff',
      shorts: '#172554',
      socks: '#172554',
      gkShirt: '#ef4444',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-detail',
      primary: '#f8fafc',
      secondary: '#172554',
      shorts: '#172554',
      socks: '#f8fafc',
      gkShirt: '#facc15',
      numberColor: '#172554',
    },
    crowdColors: ['#172554', '#ffffff', '#3b82f6'],
    squad: [
      { name: 'Marcelo Rangel', number: 88, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Matheus Felipe', number: 4, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 3, spdMod: 2 },
      { name: 'Marlon', number: 6, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Patrick Paula', number: 8, role: 'MID', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 3 },
      { name: 'Vitor Bueno', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Yago Pikachu', number: 22, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'Gabriel Poveda', number: 9, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 0, spdMod: 3 },
    ],
  },

  // 21. FORTALEZA (CONVIDADO)
  {
    id: 'for',
    name: 'Fortaleza',
    shortName: 'FOR',
    division: 'CONVIDADO',
    stats: { attack: 82, defense: 81, speed: 83 },
    crest: {
      pattern: 'tricolor-h',
      primary: '#0046ad',
      secondary: '#d91620',
      accent: '#ffffff',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'tricolor-h',
      primary: '#0046ad',
      secondary: '#d91620',
      tertiary: '#ffffff',
      shorts: '#0046ad',
      socks: '#d91620',
      gkShirt: '#facc15',
      numberColor: '#ffffff',
    },
    awayKit: {
      pattern: 'chest-bands',
      primary: '#f8fafc',
      secondary: '#0046ad',
      tertiary: '#d91620',
      shorts: '#ffffff',
      socks: '#0046ad',
      gkShirt: '#10b981',
      numberColor: '#0046ad',
    },
    crowdColors: ['#0046ad', '#d91620', '#ffffff'],
    squad: [
      { name: 'João Ricardo', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Kuscevic', number: 13, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Mancuso', number: 14, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 3, spdMod: 4 },
      { name: 'Lucas Sasha', number: 88, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'Pochettino', number: 7, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Moisés', number: 21, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 5 },
      { name: 'Breno Lopes', number: 26, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 4 },
    ],
  },

  // 22. CEARÁ (CONVIDADO)
  {
    id: 'cea',
    name: 'Ceará',
    shortName: 'CEA',
    division: 'CONVIDADO',
    stats: { attack: 79, defense: 78, speed: 80 },
    crest: {
      pattern: 'stripes',
      primary: '#111111',
      secondary: '#ffffff',
      accent: '#cbd5e1',
      border: '#ffffff',
    },
    homeKit: {
      pattern: 'stripes',
      primary: '#111111',
      secondary: '#ffffff',
      shorts: '#111111',
      socks: '#ffffff',
      gkShirt: '#2563eb',
      numberColor: '#facc15',
    },
    awayKit: {
      pattern: 'solid',
      primary: '#f8fafc',
      secondary: '#111111',
      shorts: '#ffffff',
      socks: '#111111',
      gkShirt: '#ef4444',
      numberColor: '#111111',
    },
    crowdColors: ['#111111', '#ffffff', '#64748b'],
    squad: [
      { name: 'Richard', number: 1, role: 'GK', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Luiz Otávio', number: 13, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 1 },
      { name: 'Rafael Ramos', number: 2, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Richardson', number: 26, role: 'MID', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Lucas Mugni', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Vina', number: 29, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 3 },
      { name: 'Saulo Mineiro', number: 73, role: 'FWD', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 5, defMod: 0, spdMod: 4 },
    ],
  },

  // 23. SPORT (CONVIDADO)
  {
    id: 'spt',
    name: 'Sport',
    shortName: 'SPT',
    division: 'CONVIDADO',
    stats: { attack: 78, defense: 77, speed: 80 },
    crest: {
      pattern: 'hoops',
      primary: '#d91620',
      secondary: '#111111',
      accent: '#facc15',
      border: '#facc15',
    },
    homeKit: {
      pattern: 'hoops',
      primary: '#d91620',
      secondary: '#111111',
      shorts: '#111111',
      socks: '#111111',
      gkShirt: '#22c55e',
      numberColor: '#facc15',
    },
    awayKit: {
      pattern: 'chest-bands',
      primary: '#f8fafc',
      secondary: '#d91620',
      tertiary: '#facc15',
      shorts: '#111111',
      socks: '#f8fafc',
      gkShirt: '#0284c7',
      numberColor: '#111111',
    },
    crowdColors: ['#d91620', '#111111', '#facc15'],
    squad: [
      { name: 'Caíque França', number: 22, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 2 },
      { name: 'Benevenuto', number: 4, role: 'DEF', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Igor Cariús', number: 16, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'F. Sobral', number: 8, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Lucas Lima', number: 10, role: 'MID', skin: SKIN_LIGHT, hair: HAIR_BLD, atkMod: 4, defMod: 1, spdMod: 2 },
      { name: 'C. Barletta', number: 30, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 4, defMod: 1, spdMod: 4 },
      { name: 'Zé Roberto', number: 99, role: 'FWD', skin: SKIN_DARK, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 3 },
    ],
  },

  // 24. JUVENTUDE (CONVIDADO)
  {
    id: 'juv',
    name: 'Juventude',
    shortName: 'JUV',
    division: 'CONVIDADO',
    stats: { attack: 77, defense: 78, speed: 78 },
    crest: {
      pattern: 'stripes',
      primary: '#00843d',
      secondary: '#ffffff',
      accent: '#facc15',
      border: '#00843d',
    },
    homeKit: {
      pattern: 'stripes',
      primary: '#00843d',
      secondary: '#ffffff',
      shorts: '#ffffff',
      socks: '#00843d',
      gkShirt: '#ef4444',
      numberColor: '#111111',
    },
    awayKit: {
      pattern: 'solid',
      primary: '#064e3b',
      secondary: '#facc15',
      shorts: '#064e3b',
      socks: '#064e3b',
      gkShirt: '#facc15',
      numberColor: '#ffffff',
    },
    crowdColors: ['#00843d', '#ffffff', '#065f46'],
    squad: [
      { name: 'Jandrei', number: 1, role: 'GK', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 0, defMod: 4, spdMod: 1 },
      { name: 'Rodrigo Sam', number: 4, role: 'DEF', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 1, defMod: 4, spdMod: 2 },
      { name: 'Alan Ruschel', number: 28, role: 'DEF', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 2, defMod: 3, spdMod: 3 },
      { name: 'Jadson', number: 16, role: 'MID', skin: SKIN_MED, hair: HAIR_BLK, atkMod: 2, defMod: 4, spdMod: 3 },
      { name: 'Gabriel Pires', number: 8, role: 'MID', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 3, defMod: 3, spdMod: 2 },
      { name: 'Nenê', number: 10, role: 'FWD', skin: SKIN_LIGHT, hair: HAIR_BRN, atkMod: 5, defMod: 0, spdMod: 2 },
      { name: 'Gilberto', number: 9, role: 'FWD', skin: SKIN_TAN, hair: HAIR_BLK, atkMod: 4, defMod: 1, spdMod: 3 },
    ],
  },
];

// Expansão 2026 para elenco 12×12 (1 GOL + 2 LAT + 2 ZAG + 4 MEI + 3 ATA) + 5 Reservas por clube
interface ClubRosterExtra {
  starters: [SquadPlayer, SquadPlayer, SquadPlayer, SquadPlayer, SquadPlayer];
  bench: [SquadPlayer, SquadPlayer, SquadPlayer, SquadPlayer, SquadPlayer]; // [GOL, ZAG, LAT, MEI, ATA]
}

const mkP = (
  name: string,
  number: number,
  role: PlayerRole,
  skin: string,
  hair: string,
  atkMod: number,
  defMod: number,
  spdMod: number
): SquadPlayer => ({ name, number, role, skin, hair, atkMod, defMod, spdMod });

const CLUB_ROSTER_EXTRAS: Record<string, ClubRosterExtra> = {
  fla: {
    starters: [
      mkP('Léo Pereira', 4, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 5, 3),
      mkP('Wesley', 43, 'LAT', SKIN_MED, HAIR_BLK, 3, 3, 5),
      mkP('De La Cruz', 18, 'MID', SKIN_TAN, HAIR_BLK, 4, 3, 4),
      mkP('Erick Pulgar', 5, 'MID', SKIN_LIGHT, HAIR_BRN, 2, 4, 3),
      mkP('Bruno Henrique', 27, 'FWD', SKIN_MED, HAIR_BLK, 5, 1, 6),
    ],
    bench: [
      mkP('Matheus Cunha', 25, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Danilo', 13, 'ZAG', SKIN_TAN, HAIR_BLK, 1, 4, 3),
      mkP('Ayrton Lucas', 6, 'LAT', SKIN_MED, HAIR_BLK, 3, 3, 5),
      mkP('Allan', 29, 'MID', SKIN_MED, HAIR_BLK, 2, 4, 3),
      mkP('Luiz Araújo', 7, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 5),
    ],
  },
  pal: {
    starters: [
      mkP('Murilo', 26, 'ZAG', SKIN_TAN, HAIR_BLK, 1, 5, 2),
      mkP('Marcos Rocha', 2, 'LAT', SKIN_TAN, HAIR_BLK, 2, 4, 3),
      mkP('Aníbal Moreno', 5, 'MID', SKIN_LIGHT, HAIR_BRN, 2, 5, 3),
      mkP('Raphael Veiga', 23, 'MID', SKIN_LIGHT, HAIR_BRN, 5, 2, 3),
      mkP('Estêvão', 41, 'FWD', SKIN_MED, HAIR_BLK, 5, 1, 6),
    ],
    bench: [
      mkP('Marcelo Lomba', 14, 'GK', SKIN_LIGHT, HAIR_GRY, 0, 3, 1),
      mkP('Bruno Fuchs', 3, 'ZAG', SKIN_LIGHT, HAIR_BLD, 1, 4, 2),
      mkP('Mayke', 12, 'LAT', SKIN_TAN, HAIR_BLK, 3, 3, 4),
      mkP('Maurício', 19, 'MID', SKIN_LIGHT, HAIR_BRN, 4, 2, 4),
      mkP('Flaco López', 42, 'FWD', SKIN_LIGHT, HAIR_BRN, 5, 1, 3),
    ],
  },
  cor: {
    starters: [
      mkP('Gustavo Henrique', 13, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 2),
      mkP('Matheus Bidu', 21, 'LAT', SKIN_MED, HAIR_BLK, 3, 3, 4),
      mkP('Carrillo', 19, 'MID', SKIN_MED, HAIR_BLK, 4, 3, 4),
      mkP('Raniele', 15, 'MID', SKIN_TAN, HAIR_BLK, 2, 4, 3),
      mkP('Talles Magno', 43, 'FWD', SKIN_DARK, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Matheus Donelli', 32, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Félix Torres', 3, 'ZAG', SKIN_DARK, HAIR_BLK, 1, 4, 3),
      mkP('Angileri', 26, 'LAT', SKIN_LIGHT, HAIR_BRN, 2, 3, 3),
      mkP('José Martínez', 70, 'MID', SKIN_MED, HAIR_BLK, 2, 4, 3),
      mkP('Romero', 11, 'FWD', SKIN_TAN, HAIR_BLK, 4, 2, 3),
    ],
  },
  san: {
    starters: [
      mkP('Zé Ivaldo', 2, 'ZAG', SKIN_MED, HAIR_BLK, 1, 4, 3),
      mkP('JP Chermont', 44, 'LAT', SKIN_TAN, HAIR_BLK, 3, 3, 5),
      mkP('João Schmidt', 5, 'MID', SKIN_LIGHT, HAIR_BRN, 2, 4, 3),
      mkP('Tomás Rincón', 8, 'MID', SKIN_TAN, HAIR_BLK, 2, 4, 3),
      mkP('Guilherme', 19, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('João Paulo', 1, 'GK', SKIN_TAN, HAIR_BLK, 0, 4, 1),
      mkP('Gil', 4, 'ZAG', SKIN_DARK, HAIR_BLK, 1, 4, 2),
      mkP('Souza', 33, 'LAT', SKIN_MED, HAIR_BLK, 2, 3, 4),
      mkP('Zé Rafael', 6, 'MID', SKIN_TAN, HAIR_BLK, 3, 4, 3),
      mkP('Tiquinho', 29, 'FWD', SKIN_TAN, HAIR_BLK, 5, 1, 3),
    ],
  },
  sao: {
    starters: [
      mkP('Enzo Díaz', 13, 'LAT', SKIN_LIGHT, HAIR_BRN, 2, 4, 4),
      mkP('Igor Vinícius', 2, 'LAT', SKIN_TAN, HAIR_BLK, 3, 3, 4),
      mkP('Alisson', 25, 'MID', SKIN_MED, HAIR_BLK, 3, 4, 3),
      mkP('Oscar', 8, 'MID', SKIN_LIGHT, HAIR_BRN, 5, 2, 3),
      mkP('Ferreirinha', 11, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Jandrei', 93, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Sabino', 35, 'ZAG', SKIN_TAN, HAIR_BLK, 1, 4, 3),
      mkP('Cédric', 6, 'LAT', SKIN_LIGHT, HAIR_BRN, 2, 4, 3),
      mkP('Marcos Antônio', 20, 'MID', SKIN_MED, HAIR_BLK, 3, 3, 4),
      mkP('André Silva', 17, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 4),
    ],
  },
  cru: {
    starters: [
      mkP('Fabrício Bruno', 15, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 5, 4),
      mkP('Kaiki', 6, 'LAT', SKIN_MED, HAIR_BLK, 3, 3, 4),
      mkP('Walace', 20, 'MID', SKIN_DARK, HAIR_BLK, 2, 4, 3),
      mkP('Matheus Henrique', 8, 'MID', SKIN_MED, HAIR_BLK, 3, 3, 4),
      mkP('Dudu', 7, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Léo Aragão', 41, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Villalba', 25, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 3),
      mkP('Fagner', 23, 'LAT', SKIN_TAN, HAIR_BLK, 2, 4, 3),
      mkP('Lucas Silva', 16, 'MID', SKIN_LIGHT, HAIR_BRN, 3, 3, 3),
      mkP('Bolasie', 21, 'FWD', SKIN_DARK, HAIR_BLK, 4, 1, 4),
    ],
  },
  cam: {
    starters: [
      mkP('Lyanco', 4, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 3),
      mkP('Guilherme Arana', 13, 'LAT', SKIN_MED, HAIR_BLK, 4, 4, 5),
      mkP('Alan Franco', 21, 'MID', SKIN_DARK, HAIR_BLK, 3, 4, 4),
      mkP('Fausto Vera', 8, 'MID', SKIN_LIGHT, HAIR_BRN, 2, 4, 3),
      mkP('Cuello', 28, 'FWD', SKIN_LIGHT, HAIR_BRN, 4, 1, 5),
    ],
    bench: [
      mkP('Gabriel Delfim', 1, 'GK', SKIN_TAN, HAIR_BLK, 0, 3, 1),
      mkP('Igor Rabello', 16, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 2),
      mkP('Saravia', 26, 'LAT', SKIN_LIGHT, HAIR_BRN, 2, 3, 4),
      mkP('Gabriel Menino', 25, 'MID', SKIN_TAN, HAIR_BLK, 3, 3, 4),
      mkP('Júnior Santos', 37, 'FWD', SKIN_DARK, HAIR_BLK, 5, 1, 5),
    ],
  },
  flu: {
    starters: [
      mkP('Freytes', 22, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 3),
      mkP('Fuentes', 12, 'LAT', SKIN_MED, HAIR_BLK, 3, 3, 4),
      mkP('Hércules', 35, 'MID', SKIN_MED, HAIR_BLK, 3, 4, 4),
      mkP('Nonato', 16, 'MID', SKIN_TAN, HAIR_BLK, 3, 3, 4),
      mkP('Keno', 11, 'FWD', SKIN_DARK, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Vitor Eudes', 98, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Ignácio', 4, 'ZAG', SKIN_MED, HAIR_BLK, 1, 4, 2),
      mkP('Guga', 23, 'LAT', SKIN_TAN, HAIR_BLK, 2, 3, 4),
      mkP('Lima', 45, 'MID', SKIN_TAN, HAIR_BLK, 3, 3, 3),
      mkP('Canobbio', 17, 'FWD', SKIN_LIGHT, HAIR_BRN, 4, 1, 5),
    ],
  },
  bot: {
    starters: [
      mkP('Bastos', 15, 'ZAG', SKIN_DARK, HAIR_BLK, 1, 5, 3),
      mkP('Vitinho', 2, 'LAT', SKIN_MED, HAIR_BLK, 3, 4, 5),
      mkP('Gregore', 26, 'MID', SKIN_MED, HAIR_BLK, 2, 5, 3),
      mkP('Patrick de Paula', 8, 'MID', SKIN_DARK, HAIR_BLK, 3, 3, 3),
      mkP('Artur', 7, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Léo Linck', 24, 'GK', SKIN_LIGHT, HAIR_BLD, 0, 3, 1),
      mkP('Jair Cunha', 32, 'ZAG', SKIN_MED, HAIR_BLK, 1, 4, 3),
      mkP('Cuiabano', 66, 'LAT', SKIN_TAN, HAIR_BLK, 3, 3, 5),
      mkP('Allan', 25, 'MID', SKIN_TAN, HAIR_BLK, 2, 4, 3),
      mkP('Mastriani', 39, 'FWD', SKIN_LIGHT, HAIR_BRN, 4, 1, 3),
    ],
  },
  vas: {
    starters: [
      mkP('João Victor', 38, 'ZAG', SKIN_TAN, HAIR_BLK, 1, 4, 4),
      mkP('Mauricio Lemos', 4, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 2),
      mkP('Jair', 8, 'MID', SKIN_MED, HAIR_BLK, 3, 4, 3),
      mkP('Tchê Tchê', 3, 'MID', SKIN_DARK, HAIR_BLK, 3, 3, 4),
      mkP('Nuno Moreira', 17, 'FWD', SKIN_LIGHT, HAIR_BRN, 4, 1, 4),
    ],
    bench: [
      mkP('Daniel Fuzato', 13, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Lucas Freitas', 43, 'ZAG', SKIN_TAN, HAIR_BLK, 1, 4, 3),
      mkP('Puma Rodríguez', 2, 'LAT', SKIN_LIGHT, HAIR_BRN, 3, 3, 4),
      mkP('Paulinho', 18, 'MID', SKIN_TAN, HAIR_BLK, 3, 3, 4),
      mkP('Rayan', 77, 'FWD', SKIN_DARK, HAIR_BLK, 4, 1, 5),
    ],
  },
  gre: {
    starters: [
      mkP('Jemerson', 28, 'ZAG', SKIN_DARK, HAIR_BLK, 1, 4, 3),
      mkP('Lucas Esteves', 25, 'LAT', SKIN_DARK, HAIR_BLK, 3, 3, 4),
      mkP('Cuéllar', 6, 'MID', SKIN_MED, HAIR_BLK, 2, 5, 3),
      mkP('Edenílson', 8, 'MID', SKIN_DARK, HAIR_BLK, 3, 3, 4),
      mkP('Cristian Olivera', 99, 'FWD', SKIN_LIGHT, HAIR_BRN, 4, 1, 5),
    ],
    bench: [
      mkP('Gabriel Grando', 12, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Wagner Leonardo', 3, 'ZAG', SKIN_MED, HAIR_BLK, 1, 4, 3),
      mkP('Igor Serrote', 34, 'LAT', SKIN_TAN, HAIR_BLK, 2, 3, 4),
      mkP('Dodi', 17, 'MID', SKIN_TAN, HAIR_BLK, 2, 4, 4),
      mkP('Arezo', 19, 'FWD', SKIN_LIGHT, HAIR_BRN, 4, 1, 4),
    ],
  },
  int: {
    starters: [
      mkP('Victor Gabriel', 41, 'ZAG', SKIN_MED, HAIR_BLK, 1, 4, 3),
      mkP('Aguirre', 35, 'LAT', SKIN_LIGHT, HAIR_BRN, 3, 3, 4),
      mkP('Bruno Henrique', 8, 'MID', SKIN_LIGHT, HAIR_BRN, 3, 4, 3),
      mkP('Thiago Maia', 29, 'MID', SKIN_TAN, HAIR_BLK, 2, 4, 3),
      mkP('Carbonero', 7, 'FWD', SKIN_DARK, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Anthoni', 24, 'GK', SKIN_LIGHT, HAIR_BLD, 0, 3, 1),
      mkP('Rogel', 4, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 2),
      mkP('Nathan', 23, 'LAT', SKIN_MED, HAIR_BLK, 2, 3, 4),
      mkP('Ronaldo', 16, 'MID', SKIN_MED, HAIR_BLK, 2, 4, 3),
      mkP('Enner Valencia', 13, 'FWD', SKIN_DARK, HAIR_BLK, 5, 1, 5),
    ],
  },
  bah: {
    starters: [
      mkP('Kanu', 4, 'ZAG', SKIN_DARK, HAIR_BLK, 1, 4, 3),
      mkP('Santiago Arias', 13, 'LAT', SKIN_TAN, HAIR_BLK, 3, 4, 4),
      mkP('Erick', 14, 'MID', SKIN_TAN, HAIR_BLK, 3, 4, 3),
      mkP('Rodrigo Nestor', 11, 'MID', SKIN_LIGHT, HAIR_BRN, 4, 2, 4),
      mkP('Ademir', 7, 'FWD', SKIN_MED, HAIR_BLK, 4, 1, 5),
    ],
    bench: [
      mkP('Danilo Fernandes', 1, 'GK', SKIN_LIGHT, HAIR_BRN, 0, 3, 1),
      mkP('Ramos Mingo', 21, 'ZAG', SKIN_LIGHT, HAIR_BRN, 1, 4, 3),
      mkP('Gilberto', 2, 'LAT', SKIN_MED, HAIR_BLK, 3, 3, 4),
      mkP('Acevedo', 26, 'MID', SKIN_LIGHT, HAIR_BRN, 2, 4, 3),
      mkP('Willian José', 12, 'FWD', SKIN_TAN, HAIR_BLK, 4, 1, 3),
    ],
  },
};

const FALLBACK_UNIQUE_POOL = [
  'Mateusinho',
  'Kaio César',
  'Léo Natel',
  'Rafael Bilu',
  'Henrique Dourado',
  'Vitor Bueno',
  'Jhonata Robert',
  'Luiz Fernando',
  'Diego Pituca',
  'Lucas Evangelista',
  'Pedro Henrique',
  'Yago Pikachu',
  'Matheus Peixoto',
  'Léo Chú',
  'Gabriel Inocêncio',
  'Vinícius Zanocelo',
  'Kawan',
  'Rodrigo Ely',
  'Caio Paulista',
  'Breno Bidon',
];

function buildDefaultExtras(club: RawClub, idx: number): ClubRosterExtra {
  const latLeftNames = ['Guilherme Romão', 'Juninho', 'Bruno Pacheco', 'Diego Renan', 'Matheus Bahia', 'Igor Cariús', 'Léo Borges', 'Sander', 'Reinaldo', 'Welington', 'Marlon'];
  const latRightNames = ['Tinga', 'Claudio Winck', 'Raúl Cáceres', 'Rafael Ramos', 'Ewerthon', 'Andrés Hurtado', 'Fábio Santos', 'Lucas Ramon', 'Maílton', 'Madson', 'Mário Sérgio'];
  const mid3Names = ['Zé Welison', 'Lucas Sasha', 'Willian Oliveira', 'Gabriel Girotto', 'Neto Moura', 'Richardson', 'Christian', 'Baralhas', 'Rodrigo Lindoso', 'Matheus Vargas', 'Caíque'];
  const mid4Names = ['Pochettino', 'Lucas Mugni', 'Matheus Frizzo', 'Chico Kim', 'Danielzinho', 'Lourenço', 'Felipe Amaral', 'Lucas Lima', 'Giovanni', 'Shaylon', 'Jean Irmer'];
  const fwd3Names = ['Moisés', 'Osvaldo', 'Erick Pulga', 'Vinícius Mingotti', 'Negueba', 'Chrystian Barletta', 'Julimar', 'Pedro Rocha', 'Taliari', 'Iury Castilho', 'Robson'];

  const gkBenchNames = ['Brenno', 'Lucas Arcanjo', 'Richard', 'Caíque França', 'Cleiton', 'Muralha', 'Léo Vieira', 'Marcelo Rangel', 'Léo Linck', 'Pedro Morisco', 'Gustavo'];
  const zagBenchNames = ['Brítez', 'Edu', 'David Ricardo', 'Rafael Thyere', 'Lucas Cunha', 'Jemmes', 'Bruno Leonardo', 'Rafael Castro', 'Belezi', 'Maicon', 'Abner'];
  const latBenchNames = ['Bruno Melo', 'Willean Lepo', 'Lucas Esteves', 'Dalbert', 'Juninho Capixaba', 'Natanael', 'Raul Prata', 'Thalys', 'Léo Derik', 'Zeca', 'Hayner'];
  const midBenchNames = ['Pedro Augusto', 'Filipe Machado', 'De Lucca', 'Fabricio Domínguez', 'Eric Ramires', 'Gabriel Taliari', 'Bruno Matias', 'Jaderson', 'Patrick', 'Sebastián Gómez', 'Mandaca'];
  const fwdBenchNames = ['Breno Lopes', 'Janderson', 'Aylon', 'Gustavo Coutinho', 'Eduardo Sasha', 'Léo Gamalho', 'Mário Sérgio', 'Ytalo', 'Alan Kardec', 'Dellatorre', 'Erick Farias'];

  const skins = [SKIN_LIGHT, SKIN_TAN, SKIN_MED, SKIN_DARK];
  const hairs = [HAIR_BLK, HAIR_BRN, HAIR_BLD];
  const s = (n: number) => skins[(idx + n) % skins.length];
  const h = (n: number) => hairs[(idx + n) % hairs.length];

  const used = new Set(club.squad.map((p) => p.number));
  const pickNum = (preferred: number) => {
    let n = preferred;
    while (used.has(n)) n = (n % 98) + 1;
    used.add(n);
    return n;
  };

  return {
    starters: [
      mkP(latLeftNames[idx % latLeftNames.length], pickNum(6), 'LAT', s(1), h(0), 2, 3, 4),
      mkP(latRightNames[idx % latRightNames.length], pickNum(2), 'LAT', s(2), h(1), 2, 3, 4),
      mkP(mid3Names[idx % mid3Names.length], pickNum(5), 'MID', s(0), h(0), 2, 4, 3),
      mkP(mid4Names[idx % mid4Names.length], pickNum(18), 'MID', s(3), h(1), 3, 2, 3),
      mkP(fwd3Names[idx % fwd3Names.length], pickNum(11), 'FWD', s(2), h(2), 4, 1, 4),
    ],
    bench: [
      mkP(gkBenchNames[idx % gkBenchNames.length], pickNum(12), 'GK', s(0), h(1), 0, 3, 1),
      mkP(zagBenchNames[idx % zagBenchNames.length], pickNum(14), 'ZAG', s(2), h(0), 1, 4, 2),
      mkP(latBenchNames[idx % latBenchNames.length], pickNum(22), 'LAT', s(1), h(0), 2, 3, 4),
      mkP(midBenchNames[idx % midBenchNames.length], pickNum(15), 'MID', s(3), h(1), 3, 3, 3),
      mkP(fwdBenchNames[idx % fwdBenchNames.length], pickNum(19), 'FWD', s(1), h(2), 4, 1, 4),
    ],
  };
}

export const CLUBS: Club[] = RAW_CLUBS.map((raw, idx) => {
  const extra = CLUB_ROSTER_EXTRAS[raw.id] ?? buildDefaultExtras(raw, idx);
  const orig = raw.squad;

  // Organiza os 12 titulares nas posições padrão do 4-4-3:
  // 0: GOL | 1: LAT | 2: ZAG | 3: ZAG | 4: LAT | 5..8: MEI | 9..11: ATA (11 = craque principal!)
  const defendersAndFullbacks: SquadPlayer[] = [
    { ...orig[1], role: orig[1].role === 'DEF' ? 'ZAG' : orig[1].role },
    { ...orig[2], role: orig[2].role === 'DEF' ? 'LAT' : orig[2].role },
    extra.starters[0],
    extra.starters[1],
  ];
  const lats = defendersAndFullbacks.filter((p) => p.role === 'LAT');
  const zags = defendersAndFullbacks.filter((p) => p.role !== 'LAT');
  const orderedBack4: SquadPlayer[] = [
    { ...(lats[0] ?? defendersAndFullbacks[0]), role: 'LAT' },
    { ...(zags[0] ?? defendersAndFullbacks[1]), role: 'ZAG' },
    { ...(zags[1] ?? defendersAndFullbacks[2]), role: 'ZAG' },
    { ...(lats[1] ?? defendersAndFullbacks[3]), role: 'LAT' },
  ];

  const rawFullSquad: SquadPlayer[] = [
    { ...orig[0], role: 'GK' },
    ...orderedBack4,
    { ...orig[3], role: 'MID' },
    { ...orig[4], role: 'MID' },
    { ...extra.starters[2], role: 'MID' },
    { ...extra.starters[3], role: 'MID' },
    { ...extra.starters[4], role: 'FWD' },
    { ...orig[5], role: 'FWD' },
    { ...orig[6], role: 'FWD' },
  ];

  // Garantia absoluta de unicidade de nomes e números entre titulares (12) e reservas (5)
  const usedNames = new Set<string>();
  const usedNums = new Set<number>();
  let fallbackCursor = idx * 3;
  const ensureUnique = (p: SquadPlayer): SquadPlayer => {
    let name = p.name;
    while (usedNames.has(name.toLowerCase())) {
      name = FALLBACK_UNIQUE_POOL[fallbackCursor % FALLBACK_UNIQUE_POOL.length];
      fallbackCursor++;
    }
    usedNames.add(name.toLowerCase());

    let number = p.number;
    while (usedNums.has(number)) {
      number = (number % 98) + 1;
    }
    usedNums.add(number);

    return { ...p, name, number };
  };

  const fullSquad = rawFullSquad.map(ensureUnique);
  const fullBench = extra.bench.map(ensureUnique);

  return {
    ...raw,
    squad: fullSquad,
    bench: fullBench,
  };
});

export interface FormationSlot {
  x: number; // 0..1 (ataque esquerda -> direita)
  y: number; // 0..1 (topo -> base)
  role: PlayerRole;
}

export interface FormationDefinition {
  id: FormationId;
  label: string;
  description: string;
  slots: FormationSlot[]; // sempre 12 posições (0 = GK, 1..11 = linha)
}

export const FORMATIONS: Record<FormationId, FormationDefinition> = {
  '4-4-3': {
    id: '4-4-3',
    label: '4-4-3',
    description: 'Equilibrada (2 ZAG, 2 LAT, 4 MEI, 3 ATA)',
    slots: [
      { x: 0.042, y: 0.50, role: 'GK' },
      { x: 0.225, y: 0.14, role: 'LAT' },
      { x: 0.195, y: 0.37, role: 'ZAG' },
      { x: 0.195, y: 0.63, role: 'ZAG' },
      { x: 0.225, y: 0.86, role: 'LAT' },
      { x: 0.425, y: 0.18, role: 'MID' },
      { x: 0.385, y: 0.41, role: 'MID' },
      { x: 0.385, y: 0.59, role: 'MID' },
      { x: 0.425, y: 0.82, role: 'MID' },
      { x: 0.625, y: 0.22, role: 'FWD' },
      { x: 0.625, y: 0.78, role: 'FWD' },
      { x: 0.685, y: 0.50, role: 'FWD' },
    ],
  },
  '4-3-4': {
    id: '4-3-4',
    label: '4-3-4',
    description: 'Super Ofensiva (2 ZAG, 2 LAT, 3 MEI, 4 ATA)',
    slots: [
      { x: 0.042, y: 0.50, role: 'GK' },
      { x: 0.235, y: 0.14, role: 'LAT' },
      { x: 0.195, y: 0.38, role: 'ZAG' },
      { x: 0.195, y: 0.62, role: 'ZAG' },
      { x: 0.235, y: 0.86, role: 'LAT' },
      { x: 0.415, y: 0.25, role: 'MID' },
      { x: 0.385, y: 0.50, role: 'MID' },
      { x: 0.415, y: 0.75, role: 'MID' },
      { x: 0.605, y: 0.16, role: 'FWD' },
      { x: 0.605, y: 0.84, role: 'FWD' },
      { x: 0.675, y: 0.38, role: 'FWD' },
      { x: 0.675, y: 0.62, role: 'FWD' },
    ],
  },
  '3-5-3': {
    id: '3-5-3',
    label: '3-5-3',
    description: 'Alas e Meio Forte (3 ZAG, 2 LAT, 3 MEI, 3 ATA)',
    slots: [
      { x: 0.042, y: 0.50, role: 'GK' },
      { x: 0.195, y: 0.28, role: 'ZAG' },
      { x: 0.180, y: 0.50, role: 'ZAG' },
      { x: 0.195, y: 0.72, role: 'ZAG' },
      { x: 0.395, y: 0.12, role: 'LAT' },
      { x: 0.385, y: 0.34, role: 'MID' },
      { x: 0.445, y: 0.50, role: 'MID' },
      { x: 0.385, y: 0.66, role: 'MID' },
      { x: 0.395, y: 0.88, role: 'LAT' },
      { x: 0.625, y: 0.22, role: 'FWD' },
      { x: 0.625, y: 0.78, role: 'FWD' },
      { x: 0.685, y: 0.50, role: 'FWD' },
    ],
  },
  '5-3-3': {
    id: '5-3-3',
    label: '5-3-3',
    description: 'Linha de 5 Defensiva (3 ZAG, 2 LAT, 3 MEI, 3 ATA)',
    slots: [
      { x: 0.042, y: 0.50, role: 'GK' },
      { x: 0.215, y: 0.12, role: 'LAT' },
      { x: 0.180, y: 0.32, role: 'ZAG' },
      { x: 0.168, y: 0.50, role: 'ZAG' },
      { x: 0.180, y: 0.68, role: 'ZAG' },
      { x: 0.215, y: 0.88, role: 'LAT' },
      { x: 0.385, y: 0.27, role: 'MID' },
      { x: 0.365, y: 0.50, role: 'MID' },
      { x: 0.385, y: 0.73, role: 'MID' },
      { x: 0.615, y: 0.24, role: 'FWD' },
      { x: 0.615, y: 0.76, role: 'FWD' },
      { x: 0.675, y: 0.50, role: 'FWD' },
    ],
  },
  '4-5-2': {
    id: '4-5-2',
    label: '4-5-2',
    description: 'Meio Reforçado (2 ZAG, 2 LAT, 5 MEI, 2 ATA)',
    slots: [
      { x: 0.042, y: 0.50, role: 'GK' },
      { x: 0.215, y: 0.14, role: 'LAT' },
      { x: 0.190, y: 0.38, role: 'ZAG' },
      { x: 0.190, y: 0.62, role: 'ZAG' },
      { x: 0.215, y: 0.86, role: 'LAT' },
      { x: 0.425, y: 0.15, role: 'MID' },
      { x: 0.375, y: 0.35, role: 'MID' },
      { x: 0.465, y: 0.50, role: 'MID' },
      { x: 0.375, y: 0.65, role: 'MID' },
      { x: 0.425, y: 0.85, role: 'MID' },
      { x: 0.665, y: 0.37, role: 'FWD' },
      { x: 0.665, y: 0.63, role: 'FWD' },
    ],
  },
};

export const FORMATION_LIST: FormationDefinition[] = [
  FORMATIONS['4-4-3'],
  FORMATIONS['4-3-4'],
  FORMATIONS['3-5-3'],
  FORMATIONS['5-3-3'],
  FORMATIONS['4-5-2'],
];

export function getRoleShortLabel(role: PlayerRole): 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA' {
  switch (role) {
    case 'GK':
      return 'GOL';
    case 'ZAG':
    case 'DEF':
      return 'ZAG';
    case 'LAT':
      return 'LAT';
    case 'MID':
      return 'MEI';
    case 'FWD':
      return 'ATA';
  }
}

export function isDefenderRole(role: PlayerRole): boolean {
  return role === 'ZAG' || role === 'LAT' || role === 'DEF';
}

export const CLUBS_BY_ID: Record<string, Club> = Object.fromEntries(
  CLUBS.map((c) => [c.id, c])
);

export function getClubById(id: string): Club {
  return CLUBS_BY_ID[id] ?? CLUBS[0];
}

// --- DETECÇÃO AUTOMÁTICA DE CHOQUE DE UNIFORMES ---

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDist(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  // Perceptual RGB distance
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
  );
}

function effectiveKitTone(kit: Kit): string {
  // For striped kits, average primary & secondary slightly; otherwise use primary
  if (kit.pattern === 'stripes' || kit.pattern === 'hoops' || kit.pattern === 'tricolor-v' || kit.pattern === 'tricolor-h') {
    const [r1, g1, b1] = hexToRgb(kit.primary);
    const [r2, g2, b2] = hexToRgb(kit.secondary);
    const r = Math.round(r1 * 0.65 + r2 * 0.35);
    const g = Math.round(g1 * 0.65 + g2 * 0.35);
    const b = Math.round(b1 * 0.65 + b2 * 0.35);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return kit.primary;
}

export function kitsClash(a: Kit, b: Kit): boolean {
  const primaryDist = colorDist(a.primary, b.primary);
  const effDist = colorDist(effectiveKitTone(a), effectiveKitTone(b));
  if (primaryDist < 140 || effDist < 130) return true;
  // Also catch same striped palettes (e.g. two black-and-white or two red-and-black clubs)
  if (
    a.pattern === b.pattern &&
    colorDist(a.primary, b.primary) < 180 &&
    colorDist(a.secondary, b.secondary) < 180
  ) {
    return true;
  }
  return false;
}

export interface ResolvedKits {
  homeKit: Kit;
  awayKit: Kit;
  awayUsedReserve: boolean;
}

export function resolveMatchKits(homeClub: Club, awayClub: Club): ResolvedKits {
  const homeKit = homeClub.homeKit;
  if (homeClub.id !== awayClub.id && !kitsClash(homeKit, awayClub.homeKit)) {
    return { homeKit, awayKit: awayClub.homeKit, awayUsedReserve: false };
  }

  // Try away club's reserve kit
  if (!kitsClash(homeKit, awayClub.awayKit)) {
    return { homeKit, awayKit: awayClub.awayKit, awayUsedReserve: true };
  }

  // Fallback high-contrast third kit if both primary & reserve clash (e.g. Santos vs Santos or white vs white)
  const isHomeDark = colorDist(homeKit.primary, '#000000') < 280;
  const fallbackKit: Kit = isHomeDark
    ? {
        pattern: 'chest-detail',
        primary: '#facc15',
        secondary: awayClub.homeKit.primary,
        shorts: '#111111',
        socks: '#facc15',
        gkShirt: '#38bdf8',
        numberColor: '#111111',
      }
    : {
        pattern: 'solid',
        primary: '#1d4ed8',
        secondary: '#ffffff',
        shorts: '#0f172a',
        socks: '#1d4ed8',
        gkShirt: '#f59e0b',
        numberColor: '#ffffff',
      };

  return { homeKit, awayKit: fallbackKit, awayUsedReserve: true };
}
