import { useMutation } from '@tanstack/react-query';
import { Send, Sparkles } from 'lucide-react-native';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Avatar, Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState } from '@/src/components/ui/States';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import {
  parityCustomerApi,
  type AssistTurn,
  type CustomerAssistAction,
  type CustomerAssistResult,
} from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

type Turn = { role: 'user' | 'assistant'; text: string; result?: CustomerAssistResult };

function asParams(payload: Record<string, unknown> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]),
  );
}

function toRoute(action: CustomerAssistAction): Href | null {
  if (action.href) {
    try {
      const url = new URL(action.href, 'https://bii.local');
      const path = url.pathname;
      const params = Object.fromEntries(url.searchParams.entries());
      if (path === '/search') return { pathname: '/explore', params: { q: params.q ?? '' } };
      if (path === '/become-a-provider') return '/become-provider';
      if (path === '/bookings') return '/(customer)/(tabs)/requests';
      if (path === '/provider/offerings') return '/(provider)/provider/(tabs)/services';
      if (path.startsWith('/providers/')) return { pathname: '/provider/[id]', params: { id: path.split('/')[2] ?? '' } };
      if (path === '/requests/new') return { pathname: '/request/new', params: asParams(params) };
      if (path.startsWith('/requests/')) return { pathname: '/request/[id]', params: { id: path.split('/')[2] ?? '' } };
      if (path.startsWith('/bookings/')) return { pathname: '/booking/[id]', params: { id: path.split('/')[2] ?? '' } };
      const allowed = [
        '/disputes',
        '/saved-searches',
        '/account',
        '/messages',
        '/notifications',
        '/settings/personalization',
        '/availability',
        '/explore',
      ];
      return allowed.includes(path) ? (path as Href) : null;
    } catch {
      return null;
    }
  }
  const payload = action.payload ?? {};
  const params = asParams(payload);
  if (action.kind === 'prefill-request') return { pathname: '/request/new', params };
  if (action.kind === 'send-quote') {
    const id = payload.requestId ?? payload.id;
    return id
      ? {
          pathname: '/(provider)/provider/request/[id]',
          params: asParams({
            id,
            price: payload.price,
            estimatedDuration: payload.estimatedDuration,
            description: payload.description,
          }),
        }
      : null;
  }
  if (action.kind === 'open-request') {
    const id = payload.requestId ?? payload.id;
    return id ? { pathname: '/request/[id]', params: { id: String(id) } } : null;
  }
  if (action.kind === 'open-booking') {
    const id = payload.bookingId ?? payload.id;
    return id ? { pathname: '/booking/[id]', params: { id: String(id) } } : null;
  }
  if (action.kind === 'toggle-availability') return '/availability';
  return null;
}

function TurnSuggestions({
  result,
  onQuestion,
  onAction,
  onService,
  onProvider,
}: {
  result: CustomerAssistResult;
  onQuestion: (question: string) => void;
  onAction: (route: Href) => void;
  onService: (id: string) => void;
  onProvider: (id: string) => void;
}) {
  const { colors } = useTheme();
  const routes = result.actions
    .map((action, index) => ({ action, index, route: toRoute(action) }))
    .filter((item): item is { action: CustomerAssistAction; index: number; route: Href } => Boolean(item.route));
  const hasSuggestions =
    result.questions.length > 0 ||
    routes.length > 0 ||
    result.suggestions.services.length > 0 ||
    result.suggestions.providers.length > 0;
  if (!hasSuggestions) return null;

  return (
    <View style={[styles.suggestions, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      {result.questions.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Ask next</Text>
          <View style={styles.chips}>
            {result.questions.map((question) => (
              <Chip key={question} label={question} tone="neutral" onPress={() => onQuestion(question)} />
            ))}
          </View>
        </View>
      ) : null}
      {routes.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Quick actions</Text>
          <View style={styles.chips}>
            {routes.map(({ action, index, route }) => (
              <Chip
                key={`${action.kind}-${index}`}
                label={action.label}
                tone="neutral"
                onPress={() => onAction(route)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {result.suggestions.services.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Services</Text>
          {result.suggestions.services.map((service) => (
            <Card key={service.id} variant="muted" onPress={() => onService(service.id)}>
              <View style={styles.row}>
                <Text style={[typography.small, { color: colors.text, flex: 1 }]}>{service.name}</Text>
                <Badge label={`${service.providerCount} providers`} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      {result.suggestions.providers.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Providers</Text>
          {result.suggestions.providers.map((provider) => (
            <Card key={provider.id} variant="muted" onPress={() => onProvider(provider.id)}>
              <View style={styles.row}>
                <Avatar uri={provider.avatarUrl} name={provider.businessName} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.small, { color: colors.text }]}>{provider.businessName}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{provider.city ?? 'Location not set'}</Text>
                </View>
                  <Badge label={typeof provider.rating === 'number' && Number.isFinite(provider.rating) ? `${provider.rating.toFixed(1)} rating` : 'Not enough data yet'} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function AssistantScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const router = useRouter();
  const { colors } = useTheme();
  const [consent, setConsent] = useState(false);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const chat = useMutation({
    mutationFn: ({ message, history }: { message: string; history: AssistTurn[] }) =>
      parityCustomerApi.customerAssistChat({ message, history, consentToProcess: true }),
    onSuccess: (result) => {
      setTurns((current) => [...current, { role: 'assistant', text: result.reply, result }]);
      setFailedPrompt(null);
      setNotice(null);
      setInput('');
    },
    onError: (error, variables) => {
      setNotice({ message: toApiError(error).message, tone: 'error' });
      setFailedPrompt(variables.message);
    },
  });

  const send = (text: string, retry = false) => {
    const message = text.trim();
    if (!message || chat.isPending) return;
    if (!consent) {
      setNotice({ message: 'Turn on AI processing consent before sending a message.', tone: 'warning' });
      return;
    }
    const history: AssistTurn[] = turns.map((turn) => ({ role: turn.role, text: turn.text })).slice(-8);
    if (!retry) setTurns((current) => [...current, { role: 'user', text: message }]);
    setNotice(null);
    setFailedPrompt(null);
    chat.mutate({ message, history });
  };

  if (!ready) return <RoleGuardLoading />;

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false} padded={false} edges={['top', 'bottom']} contentStyle={styles.root}>
        <AppScreenHeader
          title="BII Assistant"
          eyebrow="Guided help"
          subtitle="English · Kinyarwanda · Français"
          action={<Sparkles size={20} color={colors.primaryDark} />}
        />

        <Card>
          <View style={styles.consentRow}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>AI processing consent</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Messages and relevant account context are sent to an AI provider. Do not share passwords or payment details.
              </Text>
            </View>
            <Switch
              value={consent}
              accessibilityLabel="AI processing consent"
              onValueChange={(value) => {
                setConsent(value);
                if (!value) setNotice({ message: 'Consent is off. Turn it on to ask the assistant.', tone: 'info' });
              }}
            />
          </View>
        </Card>

        <Notice message={notice?.message ?? null} tone={notice?.tone} />
        {failedPrompt ? (
          <Button
            label="Retry last question"
            size="sm"
            variant="secondary"
            onPress={() => send(failedPrompt, true)}
          />
        ) : null}

        <ScrollView
          style={styles.thread}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {turns.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={24} color={colors.primaryDark} />}
              title="Ask a question"
              message="Ask about services, your requests, bookings, disputes, or where to go next."
            />
          ) : (
            turns.map((turn, index) => (
              <View key={`${turn.role}-${index}`} style={{ gap: spacing.sm }}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: turn.role === 'user' ? colors.primary : colors.surface,
                      borderColor: colors.border,
                      alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <Text style={[typography.small, { color: turn.role === 'user' ? colors.textOnPrimary : colors.text }]}>
                    {turn.text}
                  </Text>
                </View>
                {turn.role === 'assistant' && turn.result ? (
                  <TurnSuggestions
                    result={turn.result}
                    onQuestion={(question) => send(question)}
                    onAction={(route) => router.push(route)}
                    onService={(id) => router.push({ pathname: '/request/new', params: { serviceId: id } })}
                    onProvider={(id) => router.push({ pathname: '/provider/[id]', params: { id } })}
                  />
                ) : null}
              </View>
            ))
          )}
          {chat.isPending ? (
            <View style={styles.pending}>
              <ActivityIndicator color={colors.primaryDark} size="small" />
              <Text style={[typography.caption, { color: colors.textMuted }]}>Assistant is thinking…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: colors.border }]}>
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Ask in English or Kinyarwanda…"
            editable={consent && !chat.isPending}
            multiline
            numberOfLines={2}
          />
          <Button
            label="Ask"
            icon={<Send size={16} color={colors.textOnPrimary} />}
            disabled={!consent || !input.trim()}
            loading={chat.isPending}
            onPress={() => send(input)}
            fullWidth
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  root: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thread: { flex: 1 },
  bubble: { maxWidth: '85%', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  suggestions: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  pending: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  composer: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1 },
});
