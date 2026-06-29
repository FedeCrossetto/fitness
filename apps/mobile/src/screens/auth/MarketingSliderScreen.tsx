import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import type { ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { fontFamily } from '../../theme/typography';

// ── Brand palette ──────────────────────────────────────────────────────────────
const BG    = '#07090A';
const LIMA  = '#C1ED00';
const CORAL = '#FE734A';
const CYAN  = '#00E3FC';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.50)';

const { width: W, height: H } = Dimensions.get('window');
const IMAGE_H = H * 0.44;

interface Props { onDone: () => void }

// ── Slide data ─────────────────────────────────────────────────────────────────

interface SlideData {
  key: string;
  imageUri: string;
  gradientColors: readonly [string, string, string];
  content: () => React.JSX.Element;
}

// Slide 1 ─────────────────────────────────────────────────────────────────────
function ContentSlide1(): React.JSX.Element {
  return (
    <>
      <Text style={styles.eyebrow}>
        <Text style={{ color: CORAL }}>PSICOLOGÍA</Text>
        {'  ·  '}
        <Text style={{ color: LIMA }}>ENTRENAMIENTO</Text>
        {'  ·  '}
        <Text style={{ color: CYAN }}>NUTRICIÓN</Text>
      </Text>

      <Text style={styles.headline}>
        {'TRANSFORMA\nTUS HÁBITOS,\nNO SOLO\nTU PESO.'}
      </Text>

      <Text style={styles.body}>
        Un sistema diseñado para cambiar tu cuerpo{'\n'}
        y tu mentalidad de forma sostenible.{'\n'}
        Sin extremos. Sin culpa. Con resultados reales.
      </Text>
    </>
  );
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// Slide 2 ─────────────────────────────────────────────────────────────────────

interface PillarData {
  key: string;
  color: string;
  title: string;
  shortDesc: string;
  fullDesc: string;
  tags: string[];
}

const PILLARS: PillarData[] = [
  {
    key: 'psicologia',
    color: CORAL,
    title: 'Psicología',
    shortDesc: 'Dejás de autosabotearte y empezás a sostener hábitos reales.',
    fullDesc:
      'Trabajamos tu mentalidad, tu relación con la comida y los patrones que hoy te frenan.\n\n' +
      'Sin culpa. Sin extremos. Con herramientas reales para que el cambio dure.',
    tags: ['Constancia Real', 'Control de Impulsos', 'Aceptación'],
  },
  {
    key: 'entrenamiento',
    color: LIMA,
    title: 'Entrenamiento',
    shortDesc: 'Sabés exactamente qué hacer para ver resultados sin perder tiempo.',
    fullDesc:
      'Sesiones adaptadas a tu nivel para mejorar tu cuerpo de forma inteligente y progresiva.\n\n' +
      'Cada semana avanzás con un plan claro, sin adivinar qué ejercicio hacer.',
    tags: ['Bajar Grasa', 'Ganar Músculo'],
  },
  {
    key: 'nutricion',
    color: CYAN,
    title: 'Nutrición',
    shortDesc: 'La diferencia no está en hacer más, sino en hacerlo sostenible.',
    fullDesc:
      'Nuestro enfoque elimina los extremos y prioriza resultados reales a largo plazo.\n\n' +
      'Comés rico, aprendés a elegir bien y dejás de depender de dietas que no duran.',
    tags: ['Sin Restricciones', 'Sostenible'],
  },
];

function ContentSlide2(): React.JSX.Element {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const expand = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(key);
  };

  const collapse = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(null);
  };

  const activePillar = PILLARS.find((p) => p.key === expanded) ?? null;

  return (
    <>
      <Text style={styles.headline}>{'LOS 3\nPILARES.'}</Text>

      {activePillar ? (
        /* ── Expanded pillar ── */
        <View style={styles.pillarExpanded}>
          {/* Header: title + X */}
          <View style={styles.pillarExpandedHeader}>
            <View style={[styles.pillarAccent, { backgroundColor: activePillar.color, alignSelf: 'stretch' }]} />
            <Text style={[styles.pillarTitle, { color: activePillar.color, flex: 1 }]}>
              {activePillar.title}
            </Text>
            <Pressable onPress={collapse} hitSlop={12} style={styles.pillarCloseBtn}>
              <Text style={[styles.pillarCloseText, { color: activePillar.color }]}>✕</Text>
            </Pressable>
          </View>

          {/* Full description */}
          <Text style={styles.pillarFullDesc}>{activePillar.fullDesc}</Text>

          {/* Tags */}
          <View style={styles.tagRow}>
            {activePillar.tags.map((t) => (
              <View key={t} style={[styles.tag, { borderColor: activePillar.color }]}>
                <Text style={[styles.tagText, { color: activePillar.color }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        /* ── All pillars collapsed ── */
        PILLARS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => expand(p.key)}
            style={({ pressed }) => [styles.pillarRow, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.pillarAccent, { backgroundColor: p.color }]} />
            <View style={styles.pillarBody}>
              <Text style={[styles.pillarTitle, { color: p.color }]}>{p.title}</Text>
              <Text style={styles.pillarDesc}>{p.shortDesc}</Text>
              <View style={styles.tagRow}>
                {p.tags.map((t) => (
                  <View key={t} style={[styles.tag, { borderColor: p.color }]}>
                    <Text style={[styles.tagText, { color: p.color }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={[styles.pillarChevron, { color: p.color }]}>›</Text>
          </Pressable>
        ))
      )}
    </>
  );
}

// Slide 3 ─────────────────────────────────────────────────────────────────────
function ContentSlide3(): React.JSX.Element {
  return (
    <>
      <Text style={styles.eyebrow}>
        <Text style={{ color: CORAL }}>HEAD COACH</Text>
      </Text>

      <Text style={styles.headline}>
        {'ALEJANDRO\nGEREZ.'}
      </Text>

      <Text style={styles.body}>
        Bajé 70 kg y aprendí que el cambio real no es una foto del antes y después —
        es lo que pasa cuando nadie está mirando.
      </Text>

      <View style={styles.aleList}>
        {[
          { color: CORAL, text: 'Psicología aplicada al cambio de hábitos' },
          { color: LIMA,  text: 'Nutrición enfocada en resultados sostenibles' },
          { color: CYAN,  text: 'Entrenamientos para resultados que podés mantener' },
        ].map(({ color, text }) => (
          <View key={text} style={styles.aleItem}>
            <View style={[styles.aleDot, { backgroundColor: color }]} />
            <Text style={styles.aleText}>{text}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ── Slides config ──────────────────────────────────────────────────────────────
const SLIDES: SlideData[] = [
  {
    key: '1',
    imageUri: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=1600&q=80&auto=format&fit=crop',
    gradientColors: ['#1a2a10', '#0e1a0a', BG],
    content: ContentSlide1,
  },
  {
    key: '2',
    imageUri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=60&auto=format&fit=crop',
    gradientColors: ['#2a1208', '#1a0d05', BG],
    content: ContentSlide2,
  },
  {
    key: '3',
    imageUri: 'https://www.alegerezcoach.com/images/ale/ale-cara.jpg',
    gradientColors: ['#051a1a', '#030f0f', BG],
    content: ContentSlide3,
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function MarketingSliderScreen({ onDone }: Props): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList<SlideData>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
    }
  ).current;

  const isLast = activeIndex === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onDone();
    } else {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  return (
    <View style={styles.root}>
      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={({ item: slide }) => (
          <View style={styles.slide}>
            {/* Image area */}
            <View style={styles.imageArea}>
              <Image
                source={{ uri: slide.imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="top center"
                placeholder={slide.gradientColors[0]}
                transition={300}
              />
              {/* Scrim top → legible header sobre cualquier foto */}
              <LinearGradient
                colors={['rgba(0,0,0,0.72)', 'transparent']}
                style={styles.imageScrimTop}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
              {/* Fade to BG at bottom */}
              <LinearGradient
                colors={['transparent', BG]}
                style={styles.imageFade}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
            </View>

            {/* Text content */}
            <View style={styles.contentArea}>
              <slide.content />
            </View>
          </View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {/* Header overlay — brand label + X (sits above FlatList) */}
      <SafeAreaView style={styles.headerOverlay} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Text style={styles.brandLabel}>MÉTODO R3SET</Text>
          <Pressable onPress={onDone} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Bottom overlay — dots + CTA */}
      <SafeAreaView style={styles.bottomOverlay} pointerEvents="box-none">
        <View style={styles.bottomBar} pointerEvents="box-none">
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
            onPress={goNext}
          >
            <Text style={styles.ctaText}>
              {isLast ? 'COMENZAR  →' : 'SIGUIENTE  →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Slide ──
  slide: {
    width: W,
    flex: 1,
    backgroundColor: BG,
  },
  imageArea: {
    width: W,
    height: IMAGE_H,
  },
  imageScrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: IMAGE_H * 0.45,
  },
  imageFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: IMAGE_H * 0.5,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 100, // space for bottom bar
    gap: 14,
  },

  // ── Header overlay ──
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: LIMA,
    letterSpacing: 1.5,
    fontStyle: 'italic',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: WHITE,
    fontSize: 22,
    fontFamily: fontFamily.bold,
    opacity: 0.9,
  },

  // ── Text styles ──
  eyebrow: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MUTED,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: 38,
    lineHeight: 44,
    color: WHITE,
    letterSpacing: -0.8,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
  },

  // ── Pillar rows (Slide 2) ──
  pillarRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pillarAccent: {
    width: 3,
    borderRadius: 2,
    marginTop: 2,
  },
  pillarBody: {
    flex: 1,
    gap: 4,
  },
  pillarTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    letterSpacing: -0.1,
  },
  pillarDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
  },
  pillarChevron: {
    fontSize: 22,
    fontFamily: fontFamily.bold,
    alignSelf: 'center',
    opacity: 0.7,
  },
  pillarExpanded: {
    gap: 14,
  },
  pillarExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillarCloseBtn: {
    padding: 4,
  },
  pillarCloseText: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  pillarFullDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 24,
    color: MUTED,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // ── Ale list (Slide 3) ──
  aleList: {
    gap: 10,
    marginTop: 4,
  },
  aleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  aleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  aleText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 21,
    color: WHITE,
    flex: 1,
  },

  // ── Bottom bar ──
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingBottom: 28,
    paddingTop: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    borderRadius: 100,
  },
  dotActive: {
    width: 22,
    height: 6,
    backgroundColor: LIMA,
  },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ctaBtn: {
    backgroundColor: LIMA,
    borderRadius: 100,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: BG,
    letterSpacing: 0.8,
  },
});
