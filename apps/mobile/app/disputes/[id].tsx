import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { CheckCheck, Paperclip, Send, Upload } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import {
  parityCustomerApi,
  type DisputeEvidence,
} from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { formatDate, formatTime, humanize } from '@/src/utils/format';

type EvidenceFile = { uri: string; name: string; type: string };

const OPEN_STATUSES = ['OPEN', 'RESPONDED', 'UNDER_REVIEW'];

function tone(status: string): 'warning' | 'success' | 'neutral' {
  if (OPEN_STATUSES.includes(status)) return 'warning';
  if (status === 'RESOLVED') return 'success';
  return 'neutral';
}

export default function DisputeDetailScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<EvidenceFile | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const dispute = useQuery({
    queryKey: ['dispute', id],
    queryFn: () => parityCustomerApi.getDispute(id),
    enabled: Boolean(id),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dispute', id] }),
      queryClient.invalidateQueries({ queryKey: ['disputes', 'mine'] }),
    ]);
  };

  const showError = (error: unknown) => setNotice({ message: toApiError(error).message, tone: 'error' });

  const send = useMutation({
    mutationFn: (body: string) => parityCustomerApi.addDisputeMessage(id, body),
    onSuccess: async () => {
      setMessage('');
      setNotice({ message: 'Message sent.', tone: 'success' });
      await refresh();
    },
    onError: showError,
  });

  const upload = useMutation({
    mutationFn: (input: { file: EvidenceFile; description?: string }) =>
      parityCustomerApi.addDisputeEvidence(id, input.file, input.description),
    onSuccess: async () => {
      setSelectedFile(null);
      setDescription('');
      setNotice({ message: 'Evidence uploaded.', tone: 'success' });
      await refresh();
    },
    onError: showError,
  });

  const closed = dispute.data ? !OPEN_STATUSES.includes(dispute.data.status) : false;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setSelectedFile({
      uri: asset.uri,
      name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
    setNotice(null);
  };

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen
      contentStyle={{ gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={dispute.isRefetching} onRefresh={() => void dispute.refetch()} />}
    >
      <AppScreenHeader
        title="Dispute"
        eyebrow={dispute.data ? humanize(dispute.data.category) : 'Resolution center'}
        subtitle={dispute.data ? `Opened ${formatDate(dispute.data.createdAt)}` : 'Messages and evidence stay in one thread'}
        action={dispute.data ? <Badge label={humanize(dispute.data.status)} tone={tone(dispute.data.status)} /> : undefined}
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      {!id ? (
        <EmptyState title="Missing dispute" message="Open this screen from your disputes list." actionLabel="My disputes" onAction={() => router.push('/disputes')} />
      ) : dispute.isError ? (
        <ErrorState message="This dispute could not be loaded." onRetry={() => void dispute.refetch()} />
      ) : dispute.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={96} />
          <Skeleton height={160} />
          <Skeleton height={64} />
        </View>
      ) : dispute.data ? (
        <View style={{ gap: spacing.lg }}>
          <Card variant="elevated">
            <Text style={[typography.h3, { color: colors.text }]}>{dispute.data.reason}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {humanize(dispute.data.category)} · opened {formatDate(dispute.data.createdAt)}
            </Text>
            {dispute.data.details ? <Text style={[typography.small, { color: colors.textSecondary }]}>{dispute.data.details}</Text> : null}
            {dispute.data.resolution ? (
              <View style={[styles.resolution, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Resolution</Text>
                <Text style={[typography.small, { color: colors.text }]}>{dispute.data.resolution}</Text>
              </View>
            ) : null}
          </Card>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Evidence" subtitle="Photos attached by either side." />
            {dispute.data.evidence.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {dispute.data.evidence.map((item: DisputeEvidence) => (
                  <View key={item.id} style={{ width: 120, gap: spacing.xs }}>
                    {item.url ? (
                      <Image source={{ uri: item.url }} style={styles.evidenceImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.evidenceImage, { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                        <Paperclip size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.description ?? 'Evidence'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <EmptyState title="No evidence yet" message="Attach a photo if it helps explain what happened." />
            )}
            {!closed ? (
              <Card>
                <Button
                  label={selectedFile ? 'Photo selected' : 'Choose a photo'}
                  variant="secondary"
                  icon={<Upload size={16} color={colors.primaryDark} />}
                  onPress={() => void pickImage()}
                  fullWidth
                />
                {selectedFile ? (
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Image source={{ uri: selectedFile.uri }} style={styles.selectedImage} contentFit="cover" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[typography.small, { color: colors.text }]} numberOfLines={2}>
                          {selectedFile.name}
                        </Text>
                        <Text style={[typography.caption, { color: colors.success }]}>Ready to upload</Text>
                      </View>
                    </View>
                    <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="What does this show?" />
                    <Button
                      label="Upload evidence"
                      icon={<CheckCheck size={16} color={colors.textOnPrimary} />}
                      onPress={() => selectedFile && upload.mutate({ file: selectedFile, description: description.trim() || undefined })}
                      loading={upload.isPending}
                      fullWidth
                    />
                  </View>
                ) : null}
              </Card>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Conversation" subtitle="Both sides see the same thread." />
            {dispute.data.messages.length ? (
              <View style={{ gap: spacing.sm }}>
                {dispute.data.messages.map((item) => (
                  <Card key={item.id} variant="muted">
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                      <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                        {[item.author?.firstName, item.author?.lastName].filter(Boolean).join(' ') || 'Member'}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {formatDate(item.createdAt)} · {formatTime(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={[typography.small, { color: colors.textSecondary }]}>{item.body}</Text>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState title="No messages yet" message="Write the first message to explain your side." />
            )}
            {!closed ? (
              <Card>
                <Input
                  label="Your message"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Write a message"
                  multiline
                  numberOfLines={3}
                />
                <Button
                  label="Send message"
                  icon={<Send size={16} color={colors.textOnPrimary} />}
                  disabled={!message.trim()}
                  loading={send.isPending}
                  onPress={() => {
                    if (!message.trim()) return;
                    setNotice(null);
                    send.mutate(message.trim());
                  }}
                  fullWidth
                />
              </Card>
            ) : (
              <Notice message="This dispute is closed. The thread stays readable." tone="info" />
            )}
          </View>
        </View>
      ) : (
        <EmptyState title="Dispute not found" message="It may have been removed or you no longer have access." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  resolution: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  evidenceImage: { width: 120, height: 120, borderRadius: radius.md },
  selectedImage: { width: 52, height: 52, borderRadius: radius.sm },
});
