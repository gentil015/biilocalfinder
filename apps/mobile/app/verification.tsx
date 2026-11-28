import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  FileText,
  Mail,
  Phone,
  TriangleAlert,
  Upload,
  Wrench,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
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
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { elevation } from '@/src/theme/elevation';
import { hit, radius, spacing, typography } from '@/src/theme/metrics';
import { formatDate, humanize, statusLabel } from '@/src/utils/format';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

const TYPES = [
  { label: 'Identity', value: 'IDENTITY', doc: 'NATIONAL_ID' },
  { label: 'Business', value: 'BUSINESS', doc: 'BUSINESS_REGISTRATION' },
  { label: 'Service', value: 'SERVICE', doc: 'CERTIFICATE' },
] as const;

type VerificationType = (typeof TYPES)[number]['value'];
type CheckState = 'verified' | 'missing' | 'unavailable';

const TYPE_OPTIONS: SegmentOption<VerificationType>[] = TYPES.map((item) => ({
  label: item.label,
  value: item.value,
}));

const NEXT_STEP_ROUTES: Record<string, string> = {
  ADD_PHONE: '/verify-contact',
  VERIFY_PHONE: '/verify-contact',
  VERIFY_EMAIL: '/verify-contact',
};

const NEXT_STEP_COPY: Record<string, string> = {
  ADD_PHONE: 'Add and verify a phone number in your account.',
  VERIFY_PHONE: 'Verify your phone number to complete your profile.',
  VERIFY_EMAIL: 'Verify your email address to complete your profile.',
  SUBMIT_IDENTITY: 'Submit an identity document in the form below.',
  RENEW_IDENTITY: 'Renew your identity document in the form below.',
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

function checkState(value: boolean | null): CheckState {
  if (value === true) return 'verified';
  if (value === false) return 'missing';
  return 'unavailable';
}

function SectionBlock({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
          <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[typography.caption, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
      </View>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

function CheckRow({
  label,
  state,
  icon,
  missingLabel = 'Not verified',
}: {
  label: string;
  state: CheckState;
  icon: ReactNode;
  missingLabel?: string;
}) {
  const { colors } = useTheme();
  const Icon = state === 'verified' ? CircleCheck : state === 'missing' ? CircleX : Clock;
  const value = state === 'verified' ? 'Verified' : state === 'missing' ? missingLabel : 'Not available';
  const valueColor = state === 'verified' ? colors.success : state === 'missing' ? colors.danger : colors.textMuted;
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, { backgroundColor: colors.surfaceAlt }]}>{icon}</View>
      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Icon size={16} color={valueColor} />
      <Text style={[typography.caption, { color: valueColor }]}>{value}</Text>
    </View>
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

export default function VerificationScreen() {
  const { ready } = useRoleGuard(['PROVIDER']);
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

  const serviceOfferings = useMemo(
    () => (offerings.data ?? []).filter((offering) => offering.isActive !== false),
    [offerings.data],
  );
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
  const checks = [identityVerified, businessVerified, phoneVerified, emailVerified];
  const completedChecks = checks.filter((check) => check === true).length;
  const canSubmit =
    Boolean(document) &&
    !submit.isPending &&
    !picking &&
    (type !== 'SERVICE' || Boolean(serviceOfferingId));
  const statusNotice: { message: string; tone: NoticeTone } =
    status === 'VERIFIED'
      ? { message: 'Your provider verification is verified. Clients can see your trust badge.', tone: 'success' }
      : status === 'PENDING'
        ? { message: 'Your submission is awaiting review. We will notify you when it is decided.', tone: 'warning' }
        : status === 'REJECTED' || status === 'SUSPENDED'
          ? { message: 'Check the review note on your record for details, then submit a new document.', tone: 'error' }
          : status === 'EXPIRED'
            ? { message: 'Your verification expired. Submit a new document to renew it.', tone: 'warning' }
            : { message: 'Submit an identity document to begin verification.', tone: 'info' };

  if (!ready) return <RoleGuardLoading label="Loading verification…" />;

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <View style={styles.heroBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.backButton,
                  { backgroundColor: colors.goldSoft },
                  pressed && styles.pressed,
                ]}
              >
                <ArrowLeft size={18} color={colors.primaryDark} />
              </Pressable>
              <View style={[styles.heroPill, { borderColor: colors.goldSoft }]}>
                <Text style={[typography.caption, { color: colors.textOnPrimary }]}>TRUST & SAFETY</Text>
              </View>
            </View>
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: colors.goldSoft }]}>
                <BadgeCheck size={24} color={colors.primaryDark} />
              </View>
              <View style={styles.heroText}>
                <Text style={[typography.eyebrow, { color: colors.gold }]}>PROVIDER VERIFICATION</Text>
                <Text style={[typography.h1, { color: colors.textOnPrimary }]}>Build trust, get discovered</Text>
                <Text style={[typography.body, { color: colors.textOnPrimary, opacity: 0.88 }]}>
                  Verify your identity and business details so clients know they are hiring a trusted professional.
                </Text>
              </View>
            </View>
            <View style={styles.heroMeta}>
              <View style={[styles.heroMetaItem, { backgroundColor: colors.goldSoft }]}>
                <Badge label={statusLabel.verification(status)} tone={recordTone(status)} />
              </View>
              {expiresAt ? (
                <View style={[styles.heroMetaItem, { borderColor: colors.goldSoft }]}>
                  <Clock size={14} color={colors.gold} />
                  <Text style={[typography.caption, { color: colors.textOnPrimary }]}>
                    Expires {formatDate(expiresAt)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.heroMetaItem, { borderColor: colors.goldSoft }]}>
                <CircleCheck size={14} color={colors.gold} />
                <Text style={[typography.caption, { color: colors.textOnPrimary }]}>
                  {completedChecks} of 4 checks verified
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.content}>
            <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'info'} />

            {verification.isPending ? <LoadingState label="Loading verification status…" /> : null}
            {verification.isError ? (
              <ErrorState message="Verification status could not be loaded." onRetry={() => void verification.refetch()} />
            ) : null}

            {verification.isSuccess ? (
              <SectionBlock
                eyebrow="OVERVIEW"
                title="Verification status"
                subtitle="Your current standing across trust checks"
                icon={<BadgeCheck size={18} color={colors.primaryDark} />}
              >
                <View style={styles.statusHead}>
                  <Text style={[typography.h2, { color: colors.text, flex: 1 }]}>{statusLabel.verification(status)}</Text>
                  <Badge label={statusLabel.verification(status)} tone={recordTone(status)} />
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.primary, width: `${Math.round((completedChecks / 4) * 100)}%` },
                    ]}
                  />
                </View>
                <Notice message={statusNotice.message} tone={statusNotice.tone} />

                <View style={styles.checkList}>
                  <CheckRow label="Identity document" state={checkState(identityVerified)} icon={<FileText size={16} color={colors.primaryDark} />} />
                  <CheckRow label="Business details" state={checkState(businessVerified)} icon={<Wrench size={16} color={colors.primaryDark} />} />
                  <CheckRow label="Phone number" state={checkState(phoneVerified)} icon={<Phone size={16} color={colors.primaryDark} />} />
                  <CheckRow label="Email address" state={checkState(emailVerified)} icon={<Mail size={16} color={colors.primaryDark} />} />
                </View>

                {hasStatusDetails ? (
                  <View style={styles.detailsBlock}>
                    <Text style={[typography.eyebrow, { color: colors.primary }]}>STATUS DETAILS</Text>
                    {expiresAt ? <DetailRow label="Verification expires" value={formatDate(expiresAt)} /> : null}
                    {hasPhone !== null ? <DetailRow label="Phone on file" value={hasPhone ? 'Yes' : 'No'} /> : null}
                    {verifiedOfferings.length ? (
                      <View style={styles.detailsBlock}>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          Offerings available for verification
                        </Text>
                        <View style={styles.pillRow}>
                          {verifiedOfferings.map((offering, index) => (
                            <Badge key={offering.id ?? index} label={asText(offering.name) ?? 'Offering'} tone="accent" />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </SectionBlock>
            ) : null}

            {verification.isSuccess && nextSteps.length ? (
              <SectionBlock
                eyebrow="ACTION REQUIRED"
                title="Next steps"
                subtitle="Finish these to strengthen your profile"
                icon={<TriangleAlert size={18} color={colors.warning} />}
              >
                <View style={styles.checkList}>
                  {nextSteps.map((step) => {
                    const route = NEXT_STEP_ROUTES[step];
                    const content = (
                      <>
                        <View style={[styles.checkIcon, { backgroundColor: colors.warningSoft }]}>
                          <TriangleAlert size={16} color={colors.warning} />
                        </View>
                        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                          {NEXT_STEP_COPY[step] ?? humanize(step)}
                        </Text>
                        {route ? <ChevronRight size={16} color={colors.primaryDark} /> : null}
                      </>
                    );
                    return route ? (
                      <Pressable
                        key={step}
                        accessibilityRole="button"
                        accessibilityLabel={NEXT_STEP_COPY[step] ?? humanize(step)}
                        onPress={() => router.push(route as never)}
                        style={({ pressed }) => [styles.checkRow, styles.pressableRow, pressed && styles.pressed]}
                      >
                        {content}
                      </Pressable>
                    ) : (
                      <View key={step} style={styles.checkRow}>
                        {content}
                      </View>
                    );
                  })}
                </View>
              </SectionBlock>
            ) : null}

            <SectionBlock
              eyebrow="SUBMISSION"
              title="Submit a document"
              subtitle="JPEG, PNG or WEBP · up to 8 MB"
              icon={<Upload size={18} color={colors.primaryDark} />}
            >
              <SegmentedControl
                options={serviceTypeDisabled ? TYPE_OPTIONS.filter((option) => option.value !== 'SERVICE') : TYPE_OPTIONS}
                value={type}
                onChange={(next) => {
                  setType(next);
                  setNotice(null);
                }}
              />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {type === 'IDENTITY'
                  ? 'Use a national ID, passport, or driving licence.'
                  : type === 'BUSINESS'
                    ? 'Use your business registration certificate.'
                    : 'Use a certificate for the selected service offering.'}
              </Text>

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Input
                    label="Legal name"
                    value={legalName}
                    onChangeText={setLegalName}
                    placeholder="Name exactly as on the document"
                  />
                </View>
                <View style={styles.field}>
                  <Input
                    label="Reference number"
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="Registration or licence number"
                  />
                </View>
              </View>
              <Input
                label="Note for reviewer"
                value={note}
                onChangeText={setNote}
                placeholder="Anything the reviewer should know"
                multiline
                numberOfLines={3}
              />

              {serviceTypeDisabled ? (
                <Notice
                  message="Service verification needs an active service offering. Add one in Services, or submit identity or business verification now."
                  tone="info"
                />
              ) : null}
              {type === 'SERVICE' ? (
                serviceOfferings.length ? (
                  <View style={styles.checkList}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>Service offering</Text>
                    {serviceOfferings.map((offering) => {
                      const selected = offering.id === serviceOfferingId;
                      return (
                        <Pressable
                          key={offering.id}
                          accessibilityRole="button"
                          accessibilityLabel={offering.title ?? offering.service?.name ?? 'Service offering'}
                          accessibilityState={{ selected }}
                          onPress={() => setServiceOfferingId(offering.id)}
                          style={({ pressed }) => [
                            styles.offeringRow,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
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
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    <Notice message="No active service offering is available for service verification." tone="warning" />
                    <Button label="Go to Services" variant="secondary" onPress={() => router.push('/provider/services')} />
                  </View>
                )
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={document ? 'Choose another document' : 'Choose document'}
                disabled={picking}
                onPress={() => void pick()}
                style={({ pressed }) => [
                  styles.documentDrop,
                  { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
                  <Upload size={18} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>
                    {document ? 'Choose another document' : 'Choose a document'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Tap to open your photo library</Text>
                </View>
              </Pressable>

              {document ? (
                <View style={[styles.documentRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                  <View style={[styles.checkIcon, { backgroundColor: colors.primarySoft }]}>
                    <FileText size={16} color={colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
                      {document.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {formatBytes(document.sizeBytes) ?? 'Size not provided'}
                    </Text>
                  </View>
                  <Badge label="Ready" tone="success" />
                </View>
              ) : null}
            </SectionBlock>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
                  <FileText size={18} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.eyebrow, { color: colors.primary }]}>HISTORY</Text>
                  <Text style={[typography.h3, { color: colors.text }]}>Submitted records</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Every submission and review decision</Text>
                </View>
              </View>

              {verification.isPending ? (
                <View style={{ gap: spacing.sm }}>
                  <Card variant="muted">
                    <Skeleton height={18} />
                    <Skeleton width="60%" height={12} />
                  </Card>
                </View>
              ) : null}
              {verification.isError ? null : records.length ? (
                <View style={styles.records}>
                  {records.map((record, index) => {
                    const note = asText(record.decisionNote);
                    const recordStatus = asText(record.status) ?? 'PENDING';
                    const rejected = recordStatus === 'REJECTED' || recordStatus === 'SUSPENDED';
                    return (
                      <Card key={asText(record.id) ?? index} style={styles.recordCard}>
                        <View style={styles.recordHeader}>
                          <View style={[styles.checkIcon, { backgroundColor: colors.primarySoft }]}>
                            <FileText size={16} color={colors.primaryDark} />
                          </View>
                          <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                            {humanize(asText(record.type) ?? 'RECORD')}
                          </Text>
                          <Badge label={statusLabel.verification(recordStatus)} tone={recordTone(recordStatus)} />
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
                          <View style={styles.checkList}>
                            {record.documents.map((doc, docIndex) => (
                              <Text key={docIndex} style={[typography.caption, { color: colors.textMuted }]}>
                                {[asText(doc.originalName), humanize(asText(doc.documentType) ?? ''), formatBytes(doc.sizeBytes)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        {note ? (
                          <View
                            style={[
                              styles.decisionNote,
                              { backgroundColor: rejected ? colors.dangerSoft : colors.surfaceAlt },
                            ]}
                          >
                            <Text style={[typography.small, { color: rejected ? colors.danger : colors.textSecondary }]}>
                              {note}
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    );
                  })}
                </View>
              ) : verification.isSuccess ? (
                <Card style={styles.sectionCard}>
                  <EmptyState title="No records yet" message="Submit a document to start verification." />
                </Card>
              ) : null}
            </View>

            <Card style={[styles.submitCard, elevation.subtle]}>
              <View style={styles.footerRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.eyebrow, { color: colors.primary }]}>READY TO SUBMIT</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
                    {document
                      ? `${document.name} · ${formatBytes(document.sizeBytes) ?? 'Size not provided'}`
                      : `Choose a ${humanize(type.toLowerCase())} document to continue`}
                  </Text>
                </View>
                <Button
                  label="Submit for review"
                  onPress={() => submit.mutate()}
                  loading={submit.isPending}
                  disabled={!canSubmit}
                />
              </View>
            </Card>
          </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backButton: {
    width: hit.min,
    height: hit.min,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: spacing.xs },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  heroMetaItem: {
    minHeight: hit.compact,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sectionCard: { gap: spacing.md },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  checkList: { gap: spacing.sm },
  checkRow: { minHeight: hit.min, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pressableRow: { borderRadius: radius.sm },
  detailsBlock: { gap: spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  offeringRow: {
    minHeight: hit.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  documentDrop: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  documentRow: {
    minHeight: hit.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  records: { gap: spacing.md },
  recordCard: { gap: spacing.sm },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  decisionNote: { borderRadius: radius.sm, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.72 },
  submitCard: { gap: spacing.md },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
