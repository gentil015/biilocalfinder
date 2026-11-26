import { ArrowRight, BadgeCheck, MessageCircle, Search, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { useAppStore } from '@/src/stores/app.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

const steps = [
  {
    icon: Search,
    title: 'Find the right professional',
    body: 'Search trusted local providers by service, category and location.',
  },
  {
    icon: MessageCircle,
    title: 'Request and discuss',
    body: 'Describe the job, receive quotes and chat before you commit.',
  },
  {
    icon: BadgeCheck,
    title: 'Hire with confidence',
    body: 'Track the work, review completed jobs and build lasting trust.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colors } = theme;

  const goTo = async (route: '/register' | '/login') => {
    await useAppStore.getState().completeOnboarding();
    router.push(route);
  };

  return (
    <Screen padded={false} contentStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.brand}>
          <View style={[styles.brandIcon, { backgroundColor: colors.goldSoft }]}>
            <Sparkles size={14} color={colors.primaryDark} />
          </View>
          <Text style={[typography.small, styles.brandText, { color: colors.textOnPrimary }]}>
            BII LocalFinder
          </Text>
        </View>
        <Text style={[typography.h1, styles.heroTitle, { color: colors.textOnPrimary }]}>
          Trusted local services,{'\n'}right at your fingertips.
        </Text>
        <Text style={[typography.body, styles.heroBody, { color: colors.textOnPrimary }]}>
          Business. Innovation. Intelligence. Discover professionals across Rwanda and beyond.
        </Text>
      </View>

      <View style={styles.body}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[typography.eyebrow, { color: colors.primaryDark }]}>HOW IT WORKS</Text>
          <Text style={[typography.h3, { color: colors.text }]}>Three steps to getting it done.</Text>
        </View>

        <Card variant="elevated">
          <View style={{ gap: theme.spacing.lg }}>
            {steps.map((step, index) => (
              <View key={step.title} style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: colors.primarySoft }]}>
                  <step.icon size={20} color={colors.primaryDark} />
                </View>
                <View style={styles.stepText}>
                  <Text style={[typography.small, { color: colors.textMuted }]}>Step {index + 1}</Text>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{step.title}</Text>
                  <Text style={[typography.small, { color: colors.textSecondary }]}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            label="Create an account"
            onPress={() => goTo('/register')}
            icon={<ArrowRight size={18} color={colors.textOnPrimary} />}
            fullWidth
          />
          <Button label="Sign in" variant="secondary" onPress={() => goTo('/login')} fullWidth />
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            Built for customers and providers across Rwanda and beyond.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  hero: {
    padding: spacing.xl,
    paddingTop: spacing.xl + spacing.md,
    gap: spacing.md,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandText: { fontWeight: '700' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  heroTitle: { marginTop: spacing.md },
  heroBody: { opacity: 0.85, marginTop: spacing.xs },
  body: { padding: spacing.xl, gap: spacing.xl },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' as const },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepText: { flex: 1, gap: spacing.xs },
  actions: { gap: spacing.md },
});
