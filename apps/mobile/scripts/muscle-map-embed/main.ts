import { MuscleMapWidget, setLocale, type BodyGender, type BodySide, type Muscle } from '../../vendor/MuscleMapJS/src/index.ts';

export type MuscleMapEmbedConfig = {
  gender: BodyGender;
  side: BodySide;
  muscles: Muscle[];
  color: string;
  locale?: string;
};

let map: MuscleMapWidget | null = null;

function applyConfig(config: MuscleMapEmbedConfig): void {
  if (config.locale) setLocale(config.locale as 'es');

  if (!map) {
    const root = document.getElementById('muscle-map');
    if (!root) return;
    map = new MuscleMapWidget(root, {
      gender: config.gender,
      side: config.side,
      style: 'minimal',
      interactive: false,
      multiSelect: false,
    });
    map.setInteractive(false);
  } else {
    map.setGender(config.gender);
    map.setSide(config.side);
  }

  map.clearHighlights();
  if (config.muscles.length > 0) {
    map.highlightMany(config.muscles, config.color, 0.92);
  }
  map.redraw();
}

function parseConfig(raw: unknown): MuscleMapEmbedConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<MuscleMapEmbedConfig>;
  if (!value.gender || !value.side || !Array.isArray(value.muscles) || !value.color) return null;
  return {
    gender: value.gender,
    side: value.side,
    muscles: value.muscles,
    color: value.color,
    locale: value.locale,
  };
}

function handleIncoming(raw: unknown): void {
  const config = parseConfig(raw);
  if (config) applyConfig(config);
}

declare global {
  interface Window {
    initMuscleMapEmbed?: (config: MuscleMapEmbedConfig) => void;
    __MUSCLE_MAP_CONFIG__?: MuscleMapEmbedConfig;
  }
}

window.initMuscleMapEmbed = handleIncoming;

document.addEventListener('message', (event) => {
  try {
    handleIncoming(JSON.parse(String((event as MessageEvent).data)));
  } catch {
    // ignore malformed messages
  }
});

window.addEventListener('message', (event) => {
  try {
    handleIncoming(JSON.parse(String(event.data)));
  } catch {
    // ignore malformed messages
  }
});

if (window.__MUSCLE_MAP_CONFIG__) {
  handleIncoming(window.__MUSCLE_MAP_CONFIG__);
}
