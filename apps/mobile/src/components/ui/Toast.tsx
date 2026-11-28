import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, CircleX, Info, X } from 'lucide-react-native';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';
import { useTheme } from '@/src/theme/ThemeProvider';
import { hit, motion, radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';
import type { NoticeTone } from './Notice';

interface ToastItem {
  id: number;
  message: string;
  tone: NoticeTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: NoticeTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  success: CircleCheck,
  error: CircleX,
  warning: Info,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: NoticeTone = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      timers.current[id] = setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      Object.values(timers.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View accessibilityLiveRegion="polite" style={styles.host} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const Icon = icons[toast.tone];
  const foreground = {
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    info: colors.info,
  }[toast.tone];

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={toast.message}
      style={[
        styles.card,
        { opacity, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        elevation.overlay,
      ]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss: ${toast.message}`} onPress={onDismiss} style={styles.pressable}>
        <Icon size={18} color={foreground} />
        <Text style={[typography.small, { color: colors.text, flex: 1 }]}>{toast.message}</Text>
        <X size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl,
    gap: spacing.sm,
    zIndex: 100,
  },
  card: { borderRadius: radius.md, borderWidth: 1 },
  pressable: { minHeight: hit.min, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
});
