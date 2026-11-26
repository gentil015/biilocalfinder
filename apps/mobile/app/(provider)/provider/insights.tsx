import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Circle, ListChecks, RefreshCw, TrendingUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { parityProviderApi, type ProviderChecklistItem } from '@/src/services/api/endpoints/parity-provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';

const INSIGHTS_KEY = ['provider', 'parity', 'insights'] as const;

type Route =
  | '/provider/portfolio'
  | '/provider/services'
  | '/availability'
  | '/verification'
  | '/provider/profile'
  | '/provider/insights'
  | '/verify-contact'
  | '/location';

const ACTION_ROUTES: Record<string, Route> = {
  ADD_PORTFOLIO: '/provider/portfolio',
  ADD_SERVICES: '/provider/services',
  SET_AVAILABILITY: '/availability',
  GET_VERIFIED: '/verification',
  IMPROVE_CONVERSION: '/provider/portfolio',
};

const CHECKLIST_ROUTES: Record<string, Route> = {
  DESCRIPTION: '/provider/profile',
  PHONE_VERIFIED: '/verify-contact',
  LOCATION: '/location',
  SERVICES: '/provider/services',
  PORTFOLIO: '/provider/portfolio',
  AVAILABILITY: '/availability',
  PRICING: '/provider/services',
};

export default function ProviderInsightsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, motion, layout } = useTheme();
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const insights = useQuery({ queryKey: INSIGHTS_KEY, queryFn: () => parityProviderApi.insights() });
  const progress = useRef(new Animated.Value(0)).current;

  const refresh = useMutation({
    mutationFn: () => parityProviderApi.insights(),
    onSuccess: (data) => {
      queryClient.setQueryData(INSIGHTS_KEY, data);
      setNotice(null);
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const data = insights.data;
  const actions = data?.recommendedActions ?? [];
  const opportunities = data?.opportunities ?? [];
  const checklist = data?.profileStrength.checklist ?? [];
  const percent = Math.max(0, Math.min(100, Math.round(data?.profileStrength.percent ?? 0)));
  const completed = checklist.filter((item) => item.checked);
  const remaining = checklist.filter((item) => !item.checked);
  const isEmpty = actions.length === 0 && opportunities.length === 0 && checklist.length === 0;
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: percent / 100,
      duration: motion.normal,
      easing: motion.easing,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [percent, progress, motion.normal, motion.easing]);

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <Screen contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}>
      <AppScreenHeader
        eyebrow="Growth"
        title="Insights"
        subtitle="Recommendations based on marketplace activity"
        action={
          <Button
            label="Refresh"
            size="sm"
            variant="secondary"
            icon={<RefreshCw size={15} color={colors.primaryDark} />}
            loading={refresh.isPending}
            onPress={() => refresh.mutate()}
          />
        }
      />

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      {insights.isPending ? (
        <Card style={cardStyle}>
          <View style={{ gap: spacing.md }}>
            <Skeleton width="45%" height={22} />
            <Skeleton height={12} />
            <Skeleton width="80%" height={12} />
            <Skeleton width="60%" height={12} />
          </View>
        </Card>
      ) : null}

      {insights.isError ? (
        <ErrorState
          title="Insights unavailable"
          message={toApiError(insights.error).message}
          onRetry={() => void insights.refetch()}
        />
      ) : null}

      {insights.isSuccess && isEmpty ? (
        <EmptyState
          title="No insights yet"
          message="Insights appear once your profile has some activity. Refresh to check again."
          actionLabel="Refresh insights"
          onAction={() => void insights.refetch()}
        />
      ) : null}

      {data && checklist.length ? (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[typography.eyebrow, { color: colors.primary }]}>Profile strength</Text>
                <Text style={[typography.h3, { color: colors.text }]}>{completed.length} of {checklist.length} checks complete</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Based on the details currently on your profile</Text>
              </View>
              <Text style={[typography.display, { color: colors.primaryDark }]}>{percent}%</Text>
            </View>
            <View style={{ height: 12, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
              <Animated.View style={{ height: 12, borderRadius: radius.pill, backgroundColor: colors.primary, width: progressWidth }} />
            </View>
            <View style={{ gap: spacing.xs }}>
              {remaining.length ? <Text style={[typography.caption, { color: colors.warning }]}>Still to complete</Text> : null}
              {remaining.map((item) => {
                const route = checklistRoute(item.id);
                return <ChecklistRow key={item.id} item={item} onPress={route ? () => router.push(route) : undefined} />;
              })}
              {completed.length ? <Text style={[typography.caption, { color: colors.success }]}>Complete</Text> : null}
              {completed.map((item) => {
                const route = checklistRoute(item.id);
                return <ChecklistRow key={item.id} item={item} onPress={route ? () => router.push(route) : undefined} />;
              })}
            </View>
          </View>
        </Card>
      ) : null}

      {data && actions.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Recommended actions" subtitle="In the order suggested by your profile data" />
          {actions.map((action, index) => {
            const route = ACTION_ROUTES[action.action];
            return (
              <Card key={action.action} onPress={route ? () => router.push(route) : undefined} style={cardStyle}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.sm,
                      backgroundColor: colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[typography.caption, { color: colors.primaryDark }]}>{index + 1}</Text>
                  </View>
                  <ListChecks size={18} color={colors.primaryDark} />
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{action.label}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {data && opportunities.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="Opportunities"
            subtitle="Based on interest shown in services you do not currently offer"
          />
          <Notice message="These are interest counts from marketplace activity, not a promise of bookings." tone="info" />
          {opportunities.map((opportunity) => (
            <Card key={opportunity.serviceId} style={cardStyle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <TrendingUp size={18} color={colors.warning} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{opportunity.serviceName}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{opportunity.categoryName}</Text>
                </View>
                <Badge label={`Approx. ${opportunity.approximateInterestedUsers} interested`} tone="accent" />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function checklistRoute(id: string): Route | undefined {
  return CHECKLIST_ROUTES[id];
}

function ChecklistRow({ item, onPress }: { item: ProviderChecklistItem; onPress?: () => void }) {
  const { colors, spacing, radius, typography, borderWidth, hit } = useTheme();
  const content = (
    <>
      {item.checked ? <Check size={18} color={colors.success} /> : <Circle size={18} color={colors.textMuted} />}
      <Text style={[typography.body, { color: item.checked ? colors.textMuted : colors.text, flex: 1 }]}>{item.label}</Text>
    </>
  );
  const style = [
    styles.row,
    {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: borderWidth.thin,
      minHeight: hit.compact,
      padding: spacing.sm,
    },
  ];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
