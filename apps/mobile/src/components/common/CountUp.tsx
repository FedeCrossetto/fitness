import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  prefix?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  style,
  suffix = '',
  prefix = '',
}: CountUpProps): React.JSX.Element {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (rafRef.current) clearInterval(rafRef.current);
    fromRef.current = display;
    startRef.current = Date.now();

    rafRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (progress >= 1) {
        if (rafRef.current) clearInterval(rafRef.current);
      }
    }, 16);

    return () => { if (rafRef.current) clearInterval(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <Text style={style}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </Text>
  );
}
