import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';
import { radius } from '@/src/theme/metrics';

export function Skeleton({
  width = '100%',
  height = 16,
  style,
}: {
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.8);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 600, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.block,
        { backgroundColor: colors.skeleton, width, height, opacity },
        style,
      ]}
    />
  );
}

export function ProviderCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={56} height={56} style={{ borderRadius: radius.pill }} />
      <View style={styles.lines}>
        <Skeleton width="65%" height={16} />
        <Skeleton width="45%" height={12} />
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <ProviderCardSkeleton key={index} />
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.profile}>
      <Skeleton width={72} height={72} style={{ borderRadius: radius.pill }} />
      <View style={styles.profileLines}>
        <Skeleton width="52%" height={18} />
        <Skeleton width="38%" height={12} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.sm },
  list: { gap: spacing.md },
  profile: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg },
  profileLines: { flex: 1, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  lines: { flex: 1, gap: 8 },
});
