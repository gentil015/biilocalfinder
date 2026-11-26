import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CircleCheck, CircleX, FileText, TriangleAlert, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl, type SegmentOption } from '@/src/components/ui/SegmentedControl';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { queryKeys, useOfferings, useVerification } from '@/src/hooks/queries';
import { filesApi } from '@/src/services/api/endpoints/files';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { formatDate, humanize, statusLabel } from '@/src/utils/format';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

const TYPES = [
  { label: 'Identity', value: 'IDENTITY', doc: 'NATIONAL_ID' },
  { label: 'Business', value: 'BUSINESS', doc: 'BUSINESS_REGISTRATION' },
  { label: 'Service', value: 'SERVICE', doc: 'CERTIFICATE' },
] as const;

type VerificationType = (typeof TYPES)[number]['value'];

const TYPE_OPTIONS: SegmentOption<VerificationType>[] = TYPES.map((item) => ({
  label: item.label,
  value: item.value,
}));

const NEXT_STEP_ROUTES: Record<string, string> = {
  ADD_PHONE: '/verify-contact',
  VERIFY_PHONE: '/verify-contact',
  VERIFY_EMAIL: '/verify-contact',
  SUBMIT_IDENTITY: '',
  RENEW_IDENTITY: '',
};

const NEXT_STEP_COPY: Record<string, string> = {
  ADD_PHONE: 'Add and verify a phone number in your account.',
  VERIFY_PHONE: 'Verify your phone number.',
  VERIFY_EMAIL: 'Verify your email address.',
  SUBMIT_IDENTITY: 'Submit an identity document.',
  RENEW_IDENTITY: 'Renew your identity document.',
};

interface VerificationRecordView {
  id?: string;
  type?: string;
  status?: string;
  decisionNote?: string | null;
  offering?: { id?: string; name?: string } | null;
  legalName?: string | null;
  referenceNumber?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  expiringSoon?: boolean;
  documents?: Array<{ originalName?: string; documentType?: string; sizeBytes?: number }>;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function recordTone(status?: string): 'neutral' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'VERIFIED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger';
  if (status === 'EXPIRED') return 'accent';
  return 'neutral';
}

export default function VerificationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { colors } = theme;
  const verification = useVerification();
  const offerings = useOfferings();
  const [type, setType] = useState<VerificationType>('IDENTITY');
  const [serviceOfferingId, setServiceOfferingId] = useState('');
  const [legalName, setLegalName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [document, setDocument] = useState<{ storageKey: string; name: string; sizeBytes?: number } | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [picking, setPicking] = useState(false);

  const serviceOfferings = (offerings.data ?? []).filter((offering) => offering.isActive !== false);
  const serviceTypeDisabled = !offerings.isPending && serviceOfferings.length === 0;

  useEffect(() => {
    if (!serviceOfferingId && serviceOfferings[0]?.id) setServiceOfferingId(serviceOfferings[0].id);
  }, [serviceOfferingId, serviceOfferings]);

  useEffect(() => {
    if (serviceTypeDisabled && type === 'SERVICE') setType('IDENTITY');
  }, [serviceTypeDisabled, type]);

  const submit = useMutation({
    mutationFn: () =>
      providerApi.submitVerification({
        type,
        ...(type === 'SERVICE' ? { serviceOfferingId } : {}),
        legalName: legalName.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        note: note.trim() || undefined,
        documents: document ? [{ storageKey: document.storageKey, documentType: TYPES.find((item) => item.value === type)!.doc }] : [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.verification });
      setDocument(null);
      setNotice({ message: 'Verification record submitted for review.', tone: 'success' });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const pick = async () => {
    setNotice(null);
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_DOCUMENT_BYTES) {
        setNotice({ message: 'File is too large (max 8 MB)', tone: 'error' });
        return;
      }
      const mime = asset.mimeType?.toLowerCase() ?? '';
      if (mime && !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime)) {
        setNotice({ message: 'Only JPEG, PNG, WEBP images or PDF files are allowed', tone: 'error' });
        return;
      }
      const name = asset.fileName?.trim() || asset.uri.split('/').pop() || 'document';
      const uploaded = await filesApi.uploadVerificationDocument({
        uri: asset.uri,
        name,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setDocument({
        storageKey: uploaded.storageKey,
        name: uploaded.originalName || name,
        sizeBytes: uploaded.sizeBytes,
      });
      setNotice({ message: 'Document uploaded. Submit it for review.', tone: 'success' });
    } catch (error) {
      setNotice({ message: toApiError(error).message, tone: 'error' });
    } finally {
      setPicking(false);
    }
  };

  const data = verification.data ?? {};
  const status = asText(data.status) ?? 'UNVERIFIED';
  const identityVerified = typeof data.identityVerified === 'boolean' ? data.identityVerified : null;
  const businessVerified = typeof data.businessVerified === 'boolean' ? data.businessVerified : null;
  const nextSteps = Array.isArray(data.nextSteps) ? data.nextSteps.map(String) : [];
  const records = Array.isArray(data.records) ? (data.records as VerificationRecordView[]) : [];
  const expiresAt = asText(data.expiresAt);
  const phoneVerified = typeof data.phoneVerified === 'boolean' ? data.phoneVerified : null;
  const emailVerified = typeof data.emailVerified === 'boolean' ? data.emailVerified : null;
  const hasPhone = typeof data.hasPhone === 'boolean' ? data.hasPhone : null;
  const verifiedOfferings = Array.isArray(data.offerings)
    ? (data.offerings as Array<{ id?: string; name?: string }>).filter((offering) => asText(offering.name))
    : [];
  const hasStatusDetails = Boolean(
    expiresAt ||
      hasPhone !== null ||
      phoneVerified !== null ||
      emailVerified !== null ||
      verifiedOfferings.length > 0,
  );
  const canSubmit =
    Boolean(document) &&
    !submit.isPending &&
    !picking &&
    (type !== 'SERVICE' || Boolean(serviceOfferingId));

  const statusNotice: { message: string; tone: NoticeTone } =
    status === 'VERIFIED'
      ? { message: 'Your provider verification is verified.', tone: 'success' }
      : status === 'PENDING'
        ? { message: 'Your submission is awaiting review.', tone: 'warning' }
        : status === 'REJECTED' || status === 'SUSPENDED'
          ? { message: 'Check the review note on your record for details.', tone: 'error' }
          : status === 'EXPIRED'
            ? { message: 'Your verification expired. Submit a new document to renew it.', tone: 'warning' }
            : { message: 'Submit an identity document to begin verification.', tone: 'info' };

  return (
    <Screen contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        eyebrow="Trust and safety"
        title="Verification"
        subtitle="Documents are reviewed before a verification badge is granted"
      />

      {verification.isPending ? <LoadingState label="Loading verification status…" /> : null}
      {verification.isError ? (
        <ErrorState message="Verification status could not be loaded." onRetry={() => void verification.refetch()} />
      ) : null}
      <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'info'} />

      {verification.isSuccess ? (
        <Card variant="elevated">
          <View style={{ gap: theme.spacing.md }}>
            <View style={styles.statusRow}>
              <BadgeCheck size={22} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>
                {statusLabel.verification(status)}
              </Text>
              <Badge label={statusLabel.verification(status)} tone={recordTone(status)} />
            </View>
            <Notice message={statusNotice.message} tone={statusNotice.tone} />
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>VERIFICATION JOURNEY</Text>
              <JourneyRow label="Identity" verified={identityVerified} />
              <JourneyRow label="Business" verified={businessVerified} />
            </View>
            {hasStatusDetails ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={[typography.eyebrow, { color: colors.primary }]}>STATUS DETAILS</Text>
                {expiresAt ? <DetailRow label="Verification expires" value={formatDate(expiresAt)} /> : null}
                {hasPhone !== null ? <DetailRow label="Phone on file" value={hasPhone ? 'Yes' : 'No'} /> : null}
                {phoneVerified !== null ? <JourneyRow label="Phone verified" verified={phoneVerified} /> : null}
                {emailVerified !== null ? <JourneyRow label="Email verified" verified={emailVerified} /> : null}
                {verifiedOfferings.length ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      Offerings available for verification
                    </Text>
                    {verifiedOfferings.map((offering, index) => (
                      <Text key={offering.id ?? index} style={[typography.small, { color: colors.textSecondary }]}>
                        {offering.name}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {nextSteps.length ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={[typography.eyebrow, { color: colors.warning }]}>NEXT STEPS</Text>
                {nextSteps.map((step) => {
                  const route = NEXT_STEP_ROUTES[step];
                  const content = (
                    <View style={styles.stepRow}>
                      <TriangleAlert size={16} color={colors.warning} />
                      <Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>
                        {NEXT_STEP_COPY[step] ?? humanize(step)}
                      </Text>
                      {route ? <Text style={[typography.caption, { color: colors.primaryDark }]}>Open</Text> : null}
                    </View>
                  );
                  return route ? (
                    <Pressable key={step} accessibilityRole="button" onPress={() => router.push(route as never)}>
                      {content}
                    </Pressable>
                  ) : (
                    <View key={step}>{content}</View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Submit a document" subtitle="Images up to 8 MB" />
        <Card variant="default">
          <View style={{ gap: theme.spacing.md }}>
            <Input
              label="Legal name"
              value={legalName}
              onChangeText={setLegalName}
              placeholder="Name exactly as on the document"
            />
            <Input
              label="Reference number"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="Registration or licence number"
            />
            <Input
              label="Note for reviewer"
              value={note}
              onChangeText={setNote}
              placeholder="Anything the reviewer should know"
              multiline
              numberOfLines={3}
            />
            <SegmentedControl
              options={serviceTypeDisabled ? TYPE_OPTIONS.filter((option) => option.value !== 'SERVICE') : TYPE_OPTIONS}
              value={type}
              onChange={(next) => {
                setType(next);
                setNotice(null);
              }}
            />
            {serviceTypeDisabled ? (
              <Notice
                message="Service verification needs an active service offering. Add one in Services, or submit identity or business verification now."
                tone="info"
              />
            ) : null}
            {type === 'SERVICE' ? (
              serviceOfferings.length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>Service offering</Text>
                  <View style={{ gap: theme.spacing.xs }}>
                    {serviceOfferings.map((offering) => {
                      const selected = offering.id === serviceOfferingId;
                      return (
                        <Pressable
                          key={offering.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setServiceOfferingId(offering.id)}
                          style={[
                            styles.offeringRow,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
                            },
                          ]}
                        >
                          <View style={{ flex: 1, gap: theme.spacing.xs }}>
                            <Text style={[typography.bodyStrong, { color: colors.text }]}>
                              {offering.title ?? offering.service?.name ?? 'Service offering'}
                            </Text>
                            {offering.service?.name ? (
                              <Text style={[typography.caption, { color: colors.textMuted }]}>{offering.service.name}</Text>
                            ) : null}
                          </View>
                          {selected ? <Badge label="Selected" tone="accent" /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  <Notice message="No active service offering is available for service verification." tone="warning" />
                  <Button label="Go to Services" variant="secondary" onPress={() => router.push('/provider/services')} />
                </View>
              )
            ) : null}
            <Button
              label={document ? 'Choose another document' : 'Choose document'}
              variant="secondary"
              icon={<Upload size={16} />}
              loading={picking}
              onPress={() => void pick()}
            />
            {document ? (
              <View style={styles.documentRow}>
                <FileText size={18} color={colors.primaryDark} />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
                    {document.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {formatBytes(document.sizeBytes) ?? 'Size not provided'}
                  </Text>
                </View>
                <Badge label="Selected" tone="accent" />
              </View>
            ) : null}
            <Button
              label="Submit for review"
              onPress={() => submit.mutate()}
              loading={submit.isPending}
              disabled={!canSubmit}
              fullWidth
            />
          </View>
        </Card>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Submitted records" />
        {verification.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="60%" height={12} />
            </Card>
          </View>
        ) : null}
        {verification.isError ? null : records.length ? (
          <View style={{ gap: theme.spacing.sm }}>
            {records.map((record, index) => {
              const note = asText(record.decisionNote);
              return (
                <Card key={asText(record.id) ?? index} variant="default">
                  <View style={{ gap: theme.spacing.sm }}>
                    <View style={styles.row}>
                      <FileText size={16} color={colors.primaryDark} />
                      <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                        {humanize(asText(record.type) ?? 'RECORD')}
                      </Text>
                      <Badge
                        label={statusLabel.verification(asText(record.status) ?? 'PENDING')}
                        tone={recordTone(asText(record.status) ?? undefined)}
                      />
                    </View>
                    {asText(record.legalName) ? <DetailRow label="Legal name" value={asText(record.legalName)!} /> : null}
                    {asText(record.referenceNumber) ? (
                      <DetailRow label="Reference number" value={asText(record.referenceNumber)!} />
                    ) : null}
                    {asText(record.offering?.name) ? (
                      <DetailRow label="Linked offering" value={asText(record.offering?.name)!} />
                    ) : null}
                    {asText(record.submittedAt) ? (
                      <DetailRow label="Submitted" value={formatDate(asText(record.submittedAt))} />
                    ) : null}
                    {asText(record.verifiedAt) ? (
                      <DetailRow label="Verified" value={formatDate(asText(record.verifiedAt))} />
                    ) : null}
                    {asText(record.expiresAt) ? (
                      <DetailRow label="Expires" value={formatDate(asText(record.expiresAt))} />
                    ) : null}
                    {record.expiringSoon === true ? <Badge label="Expiring soon" tone="warning" /> : null}
                    {record.documents?.length ? (
                      <View style={{ gap: theme.spacing.xs }}>
                        {record.documents.map((doc, docIndex) => (
                          <Text key={docIndex} style={[typography.caption, { color: colors.textMuted }]}>
                            {[asText(doc.originalName), humanize(asText(doc.documentType) ?? ''), formatBytes(doc.sizeBytes)]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {note ? <Text style={[typography.small, { color: colors.textSecondary }]}>{note}</Text> : null}
                  </View>
                </Card>
              );
            })}
          </View>
        ) : verification.isSuccess ? (
          <EmptyState title="No records yet" message="Submit a document to start verification." />
        ) : null}
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.small, { color: colors.text, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function JourneyRow({ label, verified }: { label: string; verified: boolean | null }) {
  const { colors } = useTheme();
  const Icon = verified === true ? CircleCheck : CircleX;
  return (
    <View style={styles.row}>
      <Icon size={18} color={verified === true ? colors.success : colors.textMuted} />
      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Text style={[typography.caption, { color: verified === true ? colors.success : colors.textMuted }]}>
        {verified === null ? 'Not available' : verified ? 'Verified' : 'Not verified'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offeringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
});
