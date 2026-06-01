/**
 * Saved-addresses feature hooks.
 *
 * Backend (may 404 until deployed — screens handle that gracefully):
 *   GET    /customers/me/addresses              → SavedAddress[]
 *   POST   /customers/me/addresses              → SavedAddress
 *   PATCH  /customers/me/addresses/:id          → SavedAddress
 *   DELETE /customers/me/addresses/:id          → { ok: true }
 *   POST   /customers/me/addresses/:id/make-default → { ok: true }
 *
 * Shape assumed (documented in the task brief): each address carries an id,
 * a human label, the free-text line, optional GPS pin, and an isDefault flag.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

/** Pre-defined labels the customer can pick + a custom escape hatch. */
export type AddressLabel = 'HOME' | 'WORK' | 'CUSTOM';

export interface SavedAddress {
  id: string;
  /** Machine label so the UI can show the right icon. */
  label: AddressLabel;
  /** Free-text the customer typed (e.g. "بيت العائلة - شارع ٦٢"). */
  title: string;
  addressLine: string;
  district?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
  createdAt?: string;
}

/** Payload for create/update. id-less so it's reusable for both. */
export interface AddressInput {
  label: AddressLabel;
  title: string;
  addressLine: string;
  district?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export const addressKeys = {
  all: ['customer', 'addresses'] as const,
};

/**
 * The backend stores a SINGLE free-text `label` (no separate enum/title and
 * rejects unknown fields via forbidNonWhitelisted). We keep the nicer
 * enum+title UX in the app and translate at this boundary:
 *  - READ:  backend `label` (string) → UI `title` + a derived enum for the icon.
 *  - WRITE: collapse {enum,title} → one `label` string; omit null GPS (the
 *           backend validates lng/lat as real coordinates, so null would 400).
 */
interface RawAddress {
  id: string;
  label: string;
  addressLine: string;
  district?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
  createdAt?: string;
}

function deriveLabel(raw: string): AddressLabel {
  if (raw.includes('بيت') || raw.toLowerCase().includes('home')) return 'HOME';
  if (raw.includes('عمل') || raw.includes('شغل') || raw.toLowerCase().includes('work'))
    return 'WORK';
  return 'CUSTOM';
}

function toSaved(r: RawAddress): SavedAddress {
  return {
    id: r.id,
    label: deriveLabel(r.label ?? ''),
    title: r.label ?? '',
    addressLine: r.addressLine,
    district: r.district ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    isDefault: !!r.isDefault,
    createdAt: r.createdAt,
  };
}

function toBackend(input: AddressInput) {
  // The backend wants a non-empty `label` + required `district`, and rejects
  // null coordinates. Build a clean, validation-safe body.
  const label =
    (input.title && input.title.trim()) || ADDRESS_LABEL_META[input.label].text;
  const body: Record<string, unknown> = {
    label,
    addressLine: input.addressLine,
    district: (input.district && input.district.trim()) || 'غير محدد',
  };
  if (typeof input.lng === 'number') body.lng = input.lng;
  if (typeof input.lat === 'number') body.lat = input.lat;
  return body;
}

export function useMyAddresses() {
  return useQuery<SavedAddress[]>({
    queryKey: addressKeys.all,
    queryFn: async () => {
      const rows = (await api.get<RawAddress[]>('/customers/me/addresses')).data;
      return (rows ?? []).map(toSaved);
    },
    staleTime: 30_000,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddressInput) =>
      toSaved((await api.post<RawAddress>('/customers/me/addresses', toBackend(input))).data),
    onSuccess: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AddressInput & { id: string }) =>
      toSaved(
        (await api.patch<RawAddress>(`/customers/me/addresses/${id}`, toBackend(input))).data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/customers/me/addresses/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  });
}

export function useMakeDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/customers/me/addresses/${id}/make-default`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  });
}

/** Per-label visual metadata so screens stay consistent. */
export const ADDRESS_LABEL_META: Record<
  AddressLabel,
  { text: string; icon: 'home' | 'business' | 'location'; grad: [string, string] }
> = {
  HOME: { text: 'البيت', icon: 'home', grad: ['#22d3ee', '#0891b2'] },
  WORK: { text: 'العمل', icon: 'business', grad: ['#34d399', '#059669'] },
  CUSTOM: { text: 'مخصص', icon: 'location', grad: ['#a78bfa', '#7c3aed'] },
};
