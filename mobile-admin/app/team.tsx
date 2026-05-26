import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import {
  useTeam,
  useInviteTeamMember,
  useUpdateTeamMember,
  useRemoveTeamMember,
  type TeamMember,
  type TeamRole,
} from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

const ROLE_META: Record<
  TeamRole,
  { label: string; bg: string; fg: string }
> = {
  OWNER: { label: 'المالك', bg: '#ccfbf1', fg: '#0c7a6e' },
  MANAGER: { label: 'مدير', bg: '#dbeafe', fg: '#1d4ed8' },
  ACCOUNTANT: { label: 'محاسب', bg: '#fef3c7', fg: '#92400e' },
};

type EditableRole = 'MANAGER' | 'ACCOUNTANT';

const EDITABLE_ROLES: { key: EditableRole; label: string }[] = [
  { key: 'MANAGER', label: 'مدير' },
  { key: 'ACCOUNTANT', label: 'محاسب' },
];

/**
 * Team management — list current members, invite new ones, toggle
 * active state, reassign role. OWNER is never editable from here:
 * the row renders without action buttons. New invites surface a
 * one-shot modal with the temp password + Share button so the owner
 * can pass it along (typically WhatsApp).
 */
export default function TeamScreen() {
  const router = useRouter();
  const teamQuery = useTeam();
  const invite = useInviteTeamMember();
  const update = useUpdateTeamMember();
  const remove = useRemoveTeamMember();

  // Backend gates all team write actions to OWNER only. Without this guard
  // a logged-in MANAGER would see the "+ إضافة عضو" FAB and the per-row
  // role / activate / remove buttons, tap one, and watch it dead-end with
  // a confusing 403 alert. Hide the write affordances entirely for
  // non-owners and surface a read-only banner instead.
  const currentRole = useAuth((s) => s.user?.role);
  const canManageTeam = currentRole === 'OWNER';

  const [showInactive, setShowInactive] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<TeamMember | null>(null);
  const [credentials, setCredentials] = useState<{
    fullName: string;
    phone: string;
    tempPassword: string;
  } | null>(null);

  const { active, inactive } = useMemo(() => {
    const list = teamQuery.data ?? [];
    return {
      active: list.filter((m) => m.isActive),
      inactive: list.filter((m) => !m.isActive),
    };
  }, [teamQuery.data]);

  async function handleToggleActive(member: TeamMember) {
    try {
      await update.mutateAsync({
        userId: member.id,
        isActive: !member.isActive,
      });
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر تحديث الحالة');
    }
  }

  async function handleChangeRole(member: TeamMember, role: EditableRole) {
    try {
      await update.mutateAsync({ userId: member.id, role });
      setActionTarget(null);
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر تحديث الدور');
    }
  }

  async function handleRemove(member: TeamMember) {
    Alert.alert(
      'حذف العضو',
      `سيتم حذف ${member.fullName} نهائياً. لا يمكن التراجع.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove.mutateAsync(member.id);
              setActionTarget(null);
            } catch (err: any) {
              Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الحذف');
            }
          },
        },
      ],
    );
  }

  async function handleInvite(input: {
    fullName: string;
    phone: string;
    role: EditableRole;
  }) {
    try {
      const res = await invite.mutateAsync(input);
      setInviteOpen(false);
      setCredentials({
        fullName: res.user.fullName,
        phone: res.user.phone,
        tempPassword: res.tempPassword,
      });
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إضافة العضو');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => safeBack(router)}
              hitSlop={8}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#0f172a" />
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
              فريق العمل
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#64748b' }}>
            {((teamQuery.data?.length ?? 0)).toLocaleString('en-US')} أعضاء
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={teamQuery.isFetching && !teamQuery.isLoading}
            onRefresh={() => teamQuery.refetch()}
          />
        }
      >
        {teamQuery.isLoading && (
          <>
            <SkeletonCard height={80} />
            <SkeletonCard height={80} />
            <SkeletonCard height={80} />
          </>
        )}

        {teamQuery.isError && !teamQuery.data && (
          <EmptyState
            icon="cloud-off"
            title="تعذّر تحميل الفريق"
            actionLabel="إعادة المحاولة"
            onAction={() => teamQuery.refetch()}
          />
        )}

        {teamQuery.data && (
          <>
            {/* Read-only banner — only OWNER can add/edit/remove team
                members. Surface that fact instead of silently dropping
                action buttons. */}
            {!canManageTeam && (
              <View
                style={{
                  backgroundColor: '#fff7ed',
                  borderColor: '#fed7aa',
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <MaterialIcons name="visibility" size={20} color="#c2410c" />
                <Text
                  style={{
                    color: '#9a3412',
                    fontSize: 12,
                    fontWeight: '700',
                    flex: 1,
                    textAlign: 'right',
                  }}
                >
                  إدارة الفريق متاحة لمالك المعمل فقط — أنت تعرض القراءة فقط.
                </Text>
              </View>
            )}
            <SectionHeader title="الأعضاء النشطون" count={active.length} />
            {active.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="لا يوجد أعضاء نشطون"
                subtitle="استخدم زر «+ إضافة عضو» لإضافة مدير أو محاسب."
              />
            ) : (
              active.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onToggleActive={() => handleToggleActive(m)}
                  onOpenActions={canManageTeam ? () => setActionTarget(m) : undefined}
                  busy={update.isPending}
                />
              ))
            )}

            {/* Collapsible inactive section — collapsed by default. */}
            <Pressable
              onPress={() => setShowInactive((s) => !s)}
              style={({ pressed }) => ({
                marginTop: 18,
                marginBottom: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: '#fff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="block" size={18} color="#94a3b8" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#475569' }}>
                  المعطّلون
                </Text>
                <View
                  style={{
                    backgroundColor: '#f1f5f9',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '800' }}>
                    {inactive.length.toLocaleString('en-US')}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={showInactive ? 'expand-less' : 'expand-more'}
                size={22}
                color="#94a3b8"
              />
            </Pressable>

            {showInactive &&
              (inactive.length === 0 ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#94a3b8',
                    textAlign: 'center',
                    paddingVertical: 16,
                  }}
                >
                  لا يوجد أعضاء معطّلون.
                </Text>
              ) : (
                inactive.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onToggleActive={() => handleToggleActive(m)}
                    onOpenActions={canManageTeam ? () => setActionTarget(m) : undefined}
                    busy={update.isPending}
                  />
                ))
              ))}
          </>
        )}
      </ScrollView>

      {/* Floating add-member FAB — only the OWNER can invite. */}
      {canManageTeam && (
        <View
          style={{
            position: 'absolute',
            bottom: 24,
            left: 18,
            right: 18,
          }}
        >
          <Pressable
            onPress={() => setInviteOpen(true)}
            style={({ pressed }) => ({
              borderRadius: 18,
              overflow: 'hidden',
              opacity: pressed ? 0.9 : 1,
              shadowColor: '#0e9384',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 6,
            })}
          >
            <LinearGradient
              colors={['#14b8a6', '#0e9384']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: 14,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <MaterialIcons name="person-add" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                إضافة عضو
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      <ActionSheet
        member={actionTarget}
        onClose={() => setActionTarget(null)}
        onChangeRole={(role) => actionTarget && handleChangeRole(actionTarget, role)}
        onToggleActive={() => actionTarget && handleToggleActive(actionTarget)}
        onRemove={() => actionTarget && handleRemove(actionTarget)}
        busy={update.isPending || remove.isPending}
      />

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={handleInvite}
        submitting={invite.isPending}
      />

      <CredentialsModal creds={credentials} onClose={() => setCredentials(null)} />
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '900',
          color: '#0f172a',
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: '#ccfbf1',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
        }}
      >
        <Text style={{ fontSize: 10, color: '#0c7a6e', fontWeight: '900' }}>
          {count.toLocaleString('en-US')}
        </Text>
      </View>
    </View>
  );
}

function MemberRow({
  member,
  onToggleActive,
  onOpenActions,
  busy,
}: {
  member: TeamMember;
  onToggleActive: () => void;
  // Optional — when the current user can't manage the team, the parent
  // omits this and the row turns into a read-only card.
  onOpenActions?: () => void;
  busy: boolean;
}) {
  const meta = ROLE_META[member.role];
  const initial = (member.fullName ?? '?').trim().charAt(0) || '؟';
  const lastSeen = member.lastLoginAt
    ? formatDistanceToNow(new Date(member.lastLoginAt), {
        addSuffix: true,
        locale: arSA,
      })
    : 'لم يدخل بعد';
  // The OWNER row is always read-only (you can't demote yourself). A
  // missing `onOpenActions` also disables the row — that's how the
  // non-OWNER read-only view gets locked.
  const locked = member.role === 'OWNER' || !onOpenActions;

  return (
    <Pressable
      onPress={locked ? undefined : onOpenActions}
      disabled={locked}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: locked ? '#99f6e4' : '#e2e8f0',
        opacity: pressed && !locked ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: meta.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: meta.fg, fontWeight: '900', fontSize: 18 }}>{initial}</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}
              numberOfLines={1}
            >
              {member.fullName}
            </Text>
            <View
              style={{
                backgroundColor: meta.bg,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: meta.fg, fontWeight: '900', fontSize: 9 }}>
                {meta.label}
              </Text>
            </View>
            {locked && <MaterialIcons name="lock" size={12} color="#94a3b8" />}
          </View>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
            {member.phone}
          </Text>
          <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            آخر دخول: {lastSeen}
          </Text>
        </View>

        {!locked && (
          <Pressable
            onPress={onToggleActive}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => ({
              padding: 6,
              borderRadius: 999,
              backgroundColor: member.isActive ? '#dcfce7' : '#fee2e2',
              opacity: pressed || busy ? 0.7 : 1,
            })}
          >
            <MaterialIcons
              name={member.isActive ? 'toggle-on' : 'toggle-off'}
              size={28}
              color={member.isActive ? '#10b981' : '#94a3b8'}
            />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function ActionSheet({
  member,
  onClose,
  onChangeRole,
  onToggleActive,
  onRemove,
  busy,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onChangeRole: (role: EditableRole) => void;
  onToggleActive: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  if (!member) return null;
  // OWNER should never reach here (its rows are locked), but guard
  // anyway in case a future change opens that path by accident.
  if (member.role === 'OWNER') return null;
  const otherRole: EditableRole = member.role === 'MANAGER' ? 'ACCOUNTANT' : 'MANAGER';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 18,
            paddingBottom: 26,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#cbd5e1',
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              fontSize: 15,
              fontWeight: '900',
              color: '#0f172a',
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {member.fullName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#64748b',
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            {member.phone}
          </Text>

          <ActionButton
            icon="swap-horiz"
            label={`تعديل الدور إلى ${ROLE_META[otherRole].label}`}
            onPress={() => onChangeRole(otherRole)}
            disabled={busy}
          />
          <ActionButton
            icon={member.isActive ? 'block' : 'check-circle'}
            label={member.isActive ? 'تعطيل العضو' : 'تفعيل العضو'}
            onPress={() => {
              onToggleActive();
              onClose();
            }}
            tint={member.isActive ? '#f59e0b' : '#10b981'}
            disabled={busy}
          />
          <ActionButton
            icon="delete-outline"
            label="حذف"
            tint="#dc2626"
            onPress={onRemove}
            disabled={busy}
          />
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: 6,
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13 }}>إلغاء</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  tint = '#0e9384',
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  tint?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
        backgroundColor: '#fff',
        opacity: pressed || disabled ? 0.7 : 1,
      })}
    >
      <MaterialIcons name={icon} size={20} color={tint} />
      <Text style={{ flex: 1, color: tint, fontWeight: '800', fontSize: 13, textAlign: 'right' }}>
        {label}
      </Text>
      <MaterialIcons name="chevron-left" size={20} color="#cbd5e1" />
    </Pressable>
  );
}

function InviteModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { fullName: string; phone: string; role: EditableRole }) => void;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<EditableRole>('MANAGER');

  // Trim before validating — accidental trailing spaces shouldn't block.
  const nameTrim = fullName.trim();
  const phoneTrim = phone.trim();
  const validationError =
    nameTrim.length < 2
      ? 'أدخل اسماً صحيحاً (حرفان على الأقل)'
      : phoneTrim.length < 10
        ? 'أدخل رقم هاتف صحيح'
        : null;

  function reset() {
    setFullName('');
    setPhone('');
    setRole('MANAGER');
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleSubmit() {
    if (validationError) {
      Alert.alert('تحقّق', validationError);
      return;
    }
    onSubmit({ fullName: nameTrim, phone: phoneTrim, role });
    reset();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.55)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: 22,
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                إضافة عضو
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={6}
                style={({ pressed }) => ({
                  padding: 6,
                  borderRadius: 999,
                  backgroundColor: '#f1f5f9',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MaterialIcons name="close" size={18} color="#475569" />
              </Pressable>
            </View>

            <Field
              label="الاسم الكامل"
              value={fullName}
              onChangeText={setFullName}
              placeholder="مثال: علي حسن"
              icon="person"
            />
            <Field
              label="رقم الهاتف"
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXXX"
              icon="phone"
              keyboardType="phone-pad"
            />

            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#475569',
                textAlign: 'right',
                marginBottom: 6,
              }}
            >
              الدور
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 14 }}>
              {EDITABLE_ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setRole(r.key)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 11,
                      borderRadius: 14,
                      backgroundColor: active ? '#0e9384' : '#fff',
                      borderWidth: 1,
                      borderColor: active ? '#0e9384' : '#e2e8f0',
                      alignItems: 'center',
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: active ? '#fff' : '#475569',
                        fontWeight: '800',
                        fontSize: 13,
                      }}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {validationError && (
              <View
                style={{
                  backgroundColor: '#fef2f2',
                  borderColor: '#fecaca',
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <MaterialIcons name="error-outline" size={16} color="#dc2626" />
                <Text style={{ color: '#991b1b', fontSize: 11, fontWeight: '700' }}>
                  {validationError}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !!validationError}
              style={({ pressed }) => ({
                borderRadius: 16,
                overflow: 'hidden',
                opacity: pressed || submitting || validationError ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={validationError ? ['#cbd5e1', '#94a3b8'] : ['#14b8a6', '#0e9384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 14,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="person-add" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                      إنشاء
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: '#475569',
          textAlign: 'right',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <MaterialIcons name={icon} size={18} color="#0e9384" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType ?? 'default'}
          style={{
            flex: 1,
            fontSize: 14,
            color: '#0f172a',
            textAlign: 'right',
            paddingVertical: 2,
          }}
        />
      </View>
    </View>
  );
}

function CredentialsModal({
  creds,
  onClose,
}: {
  creds: { fullName: string; phone: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  if (!creds) return null;

  async function shareCreds() {
    try {
      await Share.share({
        message: `مرحباً ${creds!.fullName}\n\nتمت إضافتك إلى فريق العمل في تطبيق داري.\n\nرقم الهاتف: ${creds!.phone}\nكلمة المرور المؤقتة: ${creds!.tempPassword}\n\nقم بتغيير كلمة المرور بعد أول دخول.`,
      });
    } catch {
      // user cancelled the sheet — nothing to do.
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            padding: 22,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <LinearGradient
              colors={['#14b8a6', '#0e9384']}
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <MaterialIcons name="check" size={36} color="#fff" />
            </LinearGradient>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
              تم إنشاء الحساب
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              شارك هذه البيانات مع العضو ليدخل التطبيق
            </Text>
          </View>

          <CredField label="الاسم" value={creds.fullName} />
          <CredField label="رقم الهاتف" value={creds.phone} />
          <CredField label="كلمة المرور المؤقتة" value={creds.tempPassword} mono />

          <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={shareCreds}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: 14,
                overflow: 'hidden',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <LinearGradient
                colors={['#14b8a6', '#0e9384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MaterialIcons name="share" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>مشاركة</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13 }}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CredField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right' }}>{label}</Text>
      <Text
        selectable
        style={{
          fontSize: 15,
          fontWeight: '900',
          color: '#0f172a',
          marginTop: 4,
          textAlign: 'right',
          fontFamily: mono
            ? Platform.select({ ios: 'Menlo', android: 'monospace' })
            : undefined,
          letterSpacing: mono ? 1.2 : 0,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
