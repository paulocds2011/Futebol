import React from 'react';
import { Club, Kit } from '../types/game';

interface PixelCrestProps {
  club: Club;
  size?: number;
  className?: string;
}

/**
 * Escudo geométrico em Pixel Art (grade 16x16 nítida) para todos os 24 clubes.
 */
export const PixelCrest: React.FC<PixelCrestProps> = ({ club, size = 40, className = '' }) => {
  const { crest } = club;

  const renderPattern = () => {
    switch (crest.pattern) {
      case 'hoops':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <rect x="2" y="4" width="12" height="2" fill={crest.secondary} />
            <rect x="2" y="8" width="12" height="2" fill={crest.secondary} />
            <rect x="2" y="12" width="12" height="2" fill={crest.secondary} />
            <rect x="2" y="2" width="5" height="5" fill={crest.primary} />
            <rect x="3" y="3" width="3" height="3" fill={crest.accent} />
          </>
        );
      case 'stripes':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <rect x="4" y="2" width="2" height="12" fill={crest.secondary} />
            <rect x="8" y="2" width="2" height="12" fill={crest.secondary} />
            <rect x="12" y="2" width="2" height="12" fill={crest.secondary} />
            <rect x="6" y="4" width="4" height="2" fill={crest.accent} />
          </>
        );
      case 'sash':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <rect x="2" y="2" width="3" height="3" fill={crest.secondary} />
            <rect x="4" y="4" width="3" height="3" fill={crest.secondary} />
            <rect x="6" y="6" width="3" height="3" fill={crest.secondary} />
            <rect x="8" y="8" width="3" height="3" fill={crest.secondary} />
            <rect x="10" y="10" width="3" height="3" fill={crest.secondary} />
            {/* Cruz de Malta simplificada em pixel */}
            <rect x="7" y="5" width="2" height="6" fill={crest.accent} />
            <rect x="5" y="7" width="6" height="2" fill={crest.accent} />
          </>
        );
      case 'tricolor-v':
        return (
          <>
            <rect x="2" y="2" width="4" height="12" fill={crest.primary} />
            <rect x="6" y="2" width="4" height="12" fill={crest.accent} />
            <rect x="10" y="2" width="4" height="12" fill={crest.secondary} />
          </>
        );
      case 'tricolor-h':
        return (
          <>
            <rect x="2" y="2" width="12" height="4" fill={crest.primary} />
            <rect x="2" y="6" width="12" height="4" fill={crest.accent} />
            <rect x="2" y="10" width="12" height="4" fill={crest.secondary} />
          </>
        );
      case 'sp-shield':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <rect x="2" y="2" width="12" height="4" fill={crest.accent} />
            <rect x="3" y="3" width="10" height="2" fill={crest.primary} />
            <rect x="2" y="7" width="6" height="7" fill={crest.secondary} />
            <rect x="8" y="7" width="6" height="7" fill={crest.accent} />
          </>
        );
      case 'diagonal-split':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <polygon points="14,2 14,14 2,14" fill={crest.secondary} />
            <rect x="6" y="6" width="4" height="4" fill={crest.accent} />
          </>
        );
      case 'diamond':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <polygon points="8,3 13,8 8,13 3,8" fill={crest.secondary} />
            <rect x="7" y="7" width="2" height="2" fill={crest.accent} />
          </>
        );
      case 'cross':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <rect x="7" y="3" width="2" height="10" fill={crest.accent} />
            <rect x="3" y="7" width="10" height="2" fill={crest.accent} />
            <rect x="6" y="6" width="4" height="4" fill={crest.secondary} />
          </>
        );
      case 'solid-star':
      default:
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill={crest.primary} />
            <rect x="7" y="4" width="2" height="8" fill={crest.accent} />
            <rect x="4" y="7" width="8" height="2" fill={crest.accent} />
            <rect x="6" y="6" width="4" height="4" fill={crest.secondary} />
          </>
        );
    }
  };

  const clipId = `crest-clip-${club.id}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`pixelated shrink-0 ${className}`}
      aria-label={`Escudo ${club.name}`}
    >
      <defs>
        {/* Silhueta geométrica pixelada de escudo clássico */}
        <clipPath id={clipId}>
          <path d="M2,1 H14 V10 H13 V12 H11 V13 H10 V14 H6 V13 H5 V12 H3 V10 H2 Z" />
        </clipPath>
      </defs>

      {/* Borda externa escura */}
      <path
        d="M1,0 H15 V10 H14 V12 H12 V14 H10 V15 H6 V14 H4 V12 H2 V10 H1 Z"
        fill="#040914"
      />
      {/* Borda metálica/clube */}
      <path
        d="M2,1 H14 V10 H13 V12 H11 V13 H10 V14 H6 V13 H5 V12 H3 V10 H2 Z"
        fill={crest.border}
      />
      {/* Padrão interno recortado */}
      <g clipPath={`url(#${clipId})`}>
        {renderPattern()}
      </g>
      {/* Brilho 16-bit no canto superior esquerdo */}
      <rect x="3" y="2" width="2" height="1" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
};

interface PixelJerseyProps {
  kit: Kit;
  size?: number;
}

/**
 * Mini camisa pixel art para visualização de uniforme titular/reserva na tela de seleção.
 */
export const PixelJersey: React.FC<PixelJerseyProps> = ({ kit, size = 44 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="pixelated shrink-0"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`jersey-${kit.primary}-${kit.secondary}-${kit.pattern}`}>
          <path d="M4,2 H6 V3 H10 V2 H12 L15,5 L13,8 L12,7 V14 H4 V7 L3,8 L1,5 Z" />
        </clipPath>
      </defs>
      {/* Contorno escuro */}
      <path
        d="M3,1 H6 V2 H10 V1 H13 L16,5 L13,9 L13,15 H3 V9 L0,5 Z"
        fill="#040914"
      />
      {/* Base da camisa */}
      <g clipPath={`url(#jersey-${kit.primary}-${kit.secondary}-${kit.pattern})`}>
        <rect x="0" y="0" width="16" height="16" fill={kit.primary} />
        {kit.pattern === 'hoops' && (
          <>
            <rect x="0" y="4" width="16" height="2" fill={kit.secondary} />
            <rect x="0" y="8" width="16" height="2" fill={kit.secondary} />
            <rect x="0" y="12" width="16" height="2" fill={kit.secondary} />
          </>
        )}
        {kit.pattern === 'stripes' && (
          <>
            <rect x="4" y="0" width="2" height="16" fill={kit.secondary} />
            <rect x="8" y="0" width="2" height="16" fill={kit.secondary} />
            <rect x="12" y="0" width="2" height="16" fill={kit.secondary} />
          </>
        )}
        {kit.pattern === 'tricolor-v' && (
          <>
            <rect x="5" y="0" width="2" height="16" fill={kit.secondary} />
            <rect x="7" y="0" width="2" height="16" fill={kit.tertiary ?? '#ffffff'} />
            <rect x="9" y="0" width="2" height="16" fill={kit.secondary} />
          </>
        )}
        {kit.pattern === 'tricolor-h' && (
          <>
            <rect x="0" y="5" width="16" height="3" fill={kit.secondary} />
            <rect x="0" y="8" width="16" height="2" fill={kit.tertiary ?? '#ffffff'} />
          </>
        )}
        {kit.pattern === 'sash' && (
          <>
            <rect x="3" y="2" width="3" height="2" fill={kit.secondary} />
            <rect x="5" y="4" width="3" height="2" fill={kit.secondary} />
            <rect x="7" y="6" width="3" height="2" fill={kit.secondary} />
            <rect x="9" y="8" width="3" height="2" fill={kit.secondary} />
            <rect x="10" y="10" width="3" height="3" fill={kit.secondary} />
          </>
        )}
        {kit.pattern === 'chest-bands' && (
          <>
            <rect x="0" y="6" width="16" height="2" fill={kit.secondary} />
            <rect x="0" y="9" width="16" height="2" fill={kit.tertiary ?? kit.secondary} />
          </>
        )}
        {kit.pattern === 'chest-detail' && (
          <>
            <rect x="0" y="2" width="16" height="3" fill={kit.secondary} />
            {kit.tertiary && <rect x="5" y="7" width="6" height="3" fill={kit.tertiary} />}
          </>
        )}
      </g>
      {/* Gola */}
      <rect x="6" y="2" width="4" height="2" fill="#040914" />
    </svg>
  );
};
