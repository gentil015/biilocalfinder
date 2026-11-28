import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Mail, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { IconButton } from '@/src/components/ui/IconButton';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl, type SegmentOption } from '@/src/components/ui/SegmentedControl';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { queryKeys, useAuthWorkspaces } from '@/src/hooks/queries';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { toApiError } from '@/src/services/api/errors';
import {
  workspacesApi,
  type WorkspaceInvitation,
  type WorkspaceInvitationPreview,
  type WorkspaceMember,
} from '@/src/services/api/endpoints/workspaces';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import type { ProviderType } from '@/src/types/api';
import { humanize } from '@/src/utils/format';
import { emailSchema } from '@/src/utils/validation';

const providerTypes: ProviderType[] = ['INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY'];
const roleOptions: SegmentOption<'MEMBER' | 'MANAGER'>[] = [
  { label: 'Member', value: 'MEMBER' },
  { label: 'Manager', value: 'MANAGER' },
];

type PendingMemberAction = { kind: 'remove' | 'transfer'; member: WorkspaceMember } | null;

function memberName(member: WorkspaceMember): string {
  const fullName = [member.user?.firstName, member.user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || member.user?.email || member.invitedEmail || 'Invited member';
}

export default function WorkspacesScreen() {
  const { ready } = useRoleGuard(['PROVIDER']);
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const workspaces = useAuthWorkspaces();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const user = useAuthStore((state) => state.user);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<ProviderType>('INDIVIDUAL');
  const [renameName, setRenameName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MANAGER' | 'MEMBER'>('MEMBER');
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<WorkspaceInvitation | null>(null);
  const [pendingMemberAction, setPendingMemberAction] = useState<PendingMemberAction>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [invitationPreview, setInvitationPreview] = useState<WorkspaceInvitationPreview | null>(null);
  const activeWorkspace = workspaces.data?.find((workspace) => workspace.id === activeWorkspaceId);
  const canManage = activeWorkspace?.role === 'OWNER' || activeWorkspace?.role === 'MANAGER';
  const members = useQuery({
    queryKey: ['workspace-members', activeWorkspaceId],
    queryFn: () => workspacesApi.members(activeWorkspaceId!),
    enabled: Boolean(activeWorkspaceId),
  });
  const invitations = useQuery({
    queryKey: ['workspace-invitations', activeWorkspaceId],
    queryFn: () => workspacesApi.invitations(activeWorkspaceId!),
    enabled: Boolean(activeWorkspaceId && canManage),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
      useAuthStore.getState().refreshUser(),
    ]);
  };

  const error = (message: string) => setNotice({ message, tone: 'error' });

  const refreshWorkspace = async () => {
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ['workspace-members', activeWorkspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', activeWorkspaceId] }),
    ]);
  };

  const create = useMutation({
    mutationFn: () => workspacesApi.create({ name: createName.trim(), type: createType }),
    onSuccess: async () => {
      setCreateName('');
      setNotice({ message: 'Workspace created.', tone: 'success' });
      showToast('Workspace created.', 'success');
      await refresh();
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const rename = useMutation({
    mutationFn: () => workspacesApi.update(activeWorkspaceId!, { name: renameName.trim() }),
    onSuccess: async () => {
      setRenameName('');
      setNotice({ message: 'Workspace renamed.', tone: 'success' });
      showToast('Workspace renamed.', 'success');
      await refresh();
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const invite = useMutation({
    mutationFn: () => workspacesApi.invite(activeWorkspaceId!, { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: async () => {
      setInviteEmail('');
      setNotice({ message: 'Invitation sent.', tone: 'success' });
      showToast('Invitation sent.', 'success');
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['workspace-invitations', activeWorkspaceId] })]);
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const revoke = useMutation({
    mutationFn: (invitation: WorkspaceInvitation) => workspacesApi.revokeInvitation(activeWorkspaceId!, invitation.id),
    onSuccess: async () => {
      setPendingRevoke(null);
      setNotice({ message: 'Invitation revoked.', tone: 'success' });
      showToast('Invitation revoked.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['workspace-invitations', activeWorkspaceId] });
    },
    onError: (caught) => {
      setPendingRevoke(null);
      error(toApiError(caught).message);
    },
  });

  const acceptMembership = useMutation({
    mutationFn: ({ workspaceId, membershipId }: { workspaceId: string; membershipId: string }) =>
      workspacesApi.acceptMembership(workspaceId, membershipId),
    onSuccess: async () => {
      setNotice({ message: 'Invitation accepted.', tone: 'success' });
      showToast('Invitation accepted.', 'success');
      await refreshWorkspace();
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const previewInvitation = useMutation({
    mutationFn: (token: string) => workspacesApi.previewInvitation(token),
    onSuccess: (preview) => {
      setInvitationPreview(preview);
      setNotice(null);
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const acceptToken = useMutation({
    mutationFn: (token: string) => workspacesApi.acceptInvitationToken(token),
    onSuccess: async () => {
      setInvitationPreview(null);
      setInviteToken('');
      setNotice({ message: 'Invitation accepted.', tone: 'success' });
      showToast('Invitation accepted.', 'success');
      await refreshWorkspace();
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const changeRole = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: 'MANAGER' | 'MEMBER' }) =>
      workspacesApi.updateMemberRole(activeWorkspaceId!, membershipId, role),
    onSuccess: async () => {
      setNotice({ message: 'Member role updated.', tone: 'success' });
      showToast('Member role updated.', 'success');
      await refreshWorkspace();
    },
    onError: (caught) => error(toApiError(caught).message),
  });

  const removeMember = useMutation({
    mutationFn: (membershipId: string) => workspacesApi.removeMember(activeWorkspaceId!, membershipId),
    onSuccess: async () => {
      setPendingMemberAction(null);
      setNotice({ message: 'Member removed.', tone: 'success' });
      showToast('Member removed.', 'success');
      await refreshWorkspace();
    },
    onError: (caught) => {
      setPendingMemberAction(null);
      error(toApiError(caught).message);
    },
  });

  const transferOwnership = useMutation({
    mutationFn: (membershipId: string) => workspacesApi.transferOwnership(activeWorkspaceId!, membershipId),
    onSuccess: async () => {
      setPendingMemberAction(null);
      setNotice({ message: 'Ownership transferred.', tone: 'success' });
      showToast('Ownership transferred.', 'success');
      await refreshWorkspace();
    },
    onError: (caught) => {
      setPendingMemberAction(null);
      error(toApiError(caught).message);
    },
  });

  const emailValid = emailSchema.safeParse(inviteEmail.trim()).success;
  const nameValid = createName.trim().length >= 2;
  const renameValid = renameName.trim().length >= 2;
  const invitationsData = invitations.data ?? [];

  if (!ready) return <RoleGuardLoading label="Loading workspaces…" />;

  return (
    <Screen contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        eyebrow="Account"
        title="Workspaces"
        subtitle="Switch workspaces and manage your collaborators"
      />

      <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'error'} />

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Your workspaces" />
        {workspaces.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="55%" height={12} />
            </Card>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="65%" height={12} />
            </Card>
          </View>
        ) : null}
        {workspaces.isError ? (
          <ErrorState message="Workspaces could not be loaded." onRetry={() => void workspaces.refetch()} />
        ) : null}
        {workspaces.isSuccess && workspaces.data.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} color={colors.primaryDark} />}
            title="No workspaces"
            message="Provider accounts are linked to one or more workspaces."
          />
        ) : null}
        {workspaces.data?.map((workspace) => (
          <Card
            key={workspace.id}
            variant={workspace.id === activeWorkspaceId ? 'elevated' : 'default'}
            onPress={() => void useAuthStore.getState().selectWorkspace(workspace.id)}
          >
            <View style={styles.row}>
              <Building2 size={20} color={colors.primaryDark} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{workspace.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {[
                    humanize(workspace.type),
                    workspace.role ? humanize(workspace.role) : null,
                    typeof workspace.membershipStatus === 'string' ? humanize(workspace.membershipStatus) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {workspace.membershipStatus === 'INVITED' && workspace.membershipId ? (
                  <Button
                    label="Accept invite"
                    variant="secondary"
                    size="sm"
                    loading={acceptMembership.isPending}
                    onPress={() =>
                      acceptMembership.mutate({
                        workspaceId: workspace.id,
                        membershipId: workspace.membershipId,
                      })
                    }
                  />
                ) : null}
              </View>
              {workspace.id === activeWorkspaceId ? <Badge label="Active" tone="success" /> : null}
            </View>
          </Card>
        ))}
      </View>

      <Card variant="default">
        <SectionHeader title="Members" subtitle={activeWorkspace?.name ?? 'Choose a workspace first'} />
        {members.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={16} />
              <Skeleton width="60%" height={12} />
            </Card>
            <Card variant="muted">
              <Skeleton height={16} />
              <Skeleton width="70%" height={12} />
            </Card>
          </View>
        ) : null}
        {members.isError ? (
          <ErrorState message="Members could not be loaded." onRetry={() => void members.refetch()} />
        ) : null}
        {members.isSuccess && !members.data?.length ? (
          <EmptyState
            icon={<Users size={24} color={colors.primaryDark} />}
            title="No members yet"
            message="People with access to this workspace will appear here."
          />
        ) : null}
        {members.data?.map((member) => {
          const self = member.userId === user?.id;
          const owner = member.role === 'OWNER';
          const manageable = canManage && !owner && !self && member.status !== 'REMOVED';
          return (
            <View key={member.id} style={styles.memberRow}>
              {owner ? (
                <ShieldCheck size={18} color={colors.primaryDark} />
              ) : (
                <UserRound size={18} color={colors.textMuted} />
              )}
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text numberOfLines={1} style={[typography.small, { color: colors.text }]}>
                  {memberName(member)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {[humanize(member.role), humanize(member.status)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {member.status === 'INVITED' && self ? (
                <Button
                  label="Accept"
                  size="sm"
                  icon={<Check size={14} />}
                  loading={acceptMembership.isPending}
                  onPress={() => {
                    if (activeWorkspaceId) {
                      acceptMembership.mutate({ workspaceId: activeWorkspaceId, membershipId: member.id });
                    }
                  }}
                />
              ) : null}
              {manageable ? (
                <View style={styles.actions}>
                  {activeWorkspace?.role === 'OWNER' ? (
                    <Button
                      label={member.role === 'MANAGER' ? 'Make member' : 'Make manager'}
                      variant="secondary"
                      size="sm"
                      disabled={changeRole.isPending}
                      onPress={() =>
                        changeRole.mutate({
                          membershipId: member.id,
                          role: member.role === 'MANAGER' ? 'MEMBER' : 'MANAGER',
                        })
                      }
                    />
                  ) : null}
                  {activeWorkspace?.role === 'OWNER' && member.status === 'ACTIVE' ? (
                    <Button
                      label="Make owner"
                      variant="secondary"
                      size="sm"
                      disabled={transferOwnership.isPending}
                      onPress={() => setPendingMemberAction({ kind: 'transfer', member })}
                    />
                  ) : null}
                  <IconButton
                    icon={<Trash2 size={18} />}
                    label={`Remove ${memberName(member)}`}
                    variant="ghost"
                    tone="danger"
                    size={theme.hit.compact}
                    disabled={removeMember.isPending}
                    onPress={() => setPendingMemberAction({ kind: 'remove', member })}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      {canManage ? (
        <Card variant="default">
          <SectionHeader
            title="Active workspace tools"
            subtitle={activeWorkspace?.name ?? 'Choose a workspace first'}
          />
          <View style={styles.formGroup}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>WORKSPACE NAME</Text>
            <Input
              label="Rename workspace"
              value={renameName}
              onChangeText={setRenameName}
              placeholder={activeWorkspace?.name ?? 'Workspace name'}
              error={renameName.length > 0 && !renameValid ? 'Enter at least 2 characters.' : undefined}
            />
            <Button
              label="Save name"
              variant="secondary"
              disabled={!renameValid || rename.isPending}
              loading={rename.isPending}
              onPress={() => rename.mutate()}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>INVITATION</Text>
            <Input
              label="Invite by email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="teammate@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={inviteEmail.length > 0 && !emailValid ? 'Enter a valid email address' : undefined}
            />
            <SegmentedControl options={roleOptions} value={inviteRole} onChange={setInviteRole} />
            <Button
              label="Send invitation"
              disabled={!emailValid || invite.isPending}
              loading={invite.isPending}
              onPress={() => invite.mutate()}
              fullWidth
            />
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <SectionHeader title="Pending invitations" />
            {invitations.isPending ? (
              <Card variant="muted">
                <Skeleton height={16} />
                <Skeleton width="60%" height={12} />
              </Card>
            ) : null}
            {invitations.isError ? (
              <ErrorState
                message="Invitations could not be loaded."
                onRetry={() => void invitations.refetch()}
              />
            ) : null}
            {invitations.isSuccess && invitationsData.length === 0 ? (
              <EmptyState
                icon={<Mail size={24} color={colors.primaryDark} />}
                title="No pending invitations"
                message="Invitations you send will appear here."
              />
            ) : null}
            {invitationsData.map((invitation) => (
              <View key={invitation.id} style={styles.inviteRow}>
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text numberOfLines={1} style={[typography.small, { color: colors.text }]}>
                    {invitation.email}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {[humanize(invitation.role), typeof invitation.status === 'string' ? humanize(invitation.status) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <IconButton
                  icon={<Users size={18} />}
                  label={`Revoke invitation for ${invitation.email}`}
                  variant="ghost"
                  tone="danger"
                  size={theme.hit.compact}
                  disabled={revoke.isPending}
                  onPress={() => setPendingRevoke(invitation)}
                />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card variant="default">
        <SectionHeader title="Accept an invitation" subtitle="Paste the token from your invitation link" />
        <View style={styles.formGroup}>
          <Input
            label="Invitation token"
            value={inviteToken}
            onChangeText={setInviteToken}
            placeholder="Paste token"
            autoCapitalize="none"
          />
          <Button
            label="Preview invitation"
            variant="secondary"
            disabled={!inviteToken.trim() || previewInvitation.isPending}
            loading={previewInvitation.isPending}
            onPress={() => previewInvitation.mutate(inviteToken.trim())}
          />
          {invitationPreview ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={styles.row}>
                <Mail size={18} color={colors.primaryDark} />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>
                    {invitationPreview.workspace.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {[
                      invitationPreview.email,
                      humanize(invitationPreview.role),
                      `Invited by ${invitationPreview.inviterName}`,
                      `Expires ${new Date(invitationPreview.expiresAt).toLocaleDateString()}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
              <Button
                label="Accept invitation"
                disabled={acceptToken.isPending}
                loading={acceptToken.isPending}
                onPress={() => acceptToken.mutate(inviteToken.trim())}
                fullWidth
              />
            </View>
          ) : null}
        </View>
      </Card>

      <Card variant="elevated">
        <SectionHeader title="Create workspace" subtitle="A new workspace keeps your clients and team organised" />
        <View style={styles.formGroup}>
          <Input
            label="Name"
            value={createName}
            onChangeText={setCreateName}
            placeholder="My company"
            error={createName.length > 0 && !nameValid ? 'Enter at least 2 characters.' : undefined}
          />
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Workspace type</Text>
            <View style={styles.chips}>
              {providerTypes.map((providerType) => (
                <Chip
                  key={providerType}
                  label={humanize(providerType)}
                  selected={createType === providerType}
                  onPress={() => setCreateType(providerType)}
                />
              ))}
            </View>
          </View>
          <Button
            label="Create workspace"
            disabled={!nameValid || create.isPending}
            loading={create.isPending}
            onPress={() => create.mutate()}
            fullWidth
          />
        </View>
      </Card>

      <ConfirmDialog
        visible={Boolean(pendingRevoke)}
        title="Revoke this invitation?"
        message={`The invitation for ${pendingRevoke?.email ?? 'this person'} will no longer be valid.`}
        confirmLabel="Revoke"
        destructive
        loading={revoke.isPending}
        onConfirm={() => {
          if (pendingRevoke) revoke.mutate(pendingRevoke);
        }}
        onCancel={() => setPendingRevoke(null)}
      />

      <ConfirmDialog
        visible={Boolean(pendingMemberAction)}
        title={pendingMemberAction?.kind === 'transfer' ? 'Transfer ownership?' : 'Remove this member?'}
        message={
          pendingMemberAction
            ? pendingMemberAction.kind === 'transfer'
              ? `${memberName(pendingMemberAction.member)} will become the owner and you will become a manager.`
              : `${memberName(pendingMemberAction.member)} will lose access to this workspace.`
            : ''
        }
        confirmLabel={pendingMemberAction?.kind === 'transfer' ? 'Transfer ownership' : 'Remove member'}
        destructive
        loading={
          pendingMemberAction?.kind === 'transfer' ? transferOwnership.isPending : removeMember.isPending
        }
        onConfirm={() => {
          if (!pendingMemberAction) return;
          if (pendingMemberAction.kind === 'transfer') transferOwnership.mutate(pendingMemberAction.member.id);
          else removeMember.mutate(pendingMemberAction.member.id);
        }}
        onCancel={() => setPendingMemberAction(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  formGroup: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
