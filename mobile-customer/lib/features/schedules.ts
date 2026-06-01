/**
 * Scheduled / recurring auto-refill feature hooks.
 *
 * Backend (may 404 until deployed — screens handle that gracefully):
 *   GET    /customers/me/schedules        → RefillSchedule[]
 *   POST   /customers/me/schedules        → RefillSchedule
 *   PATCH  /customers/me/schedules/:id     → RefillSchedule   (toggle/edit)
 *   DELETE /customers/me/schedules/:id     → { ok: true }
 *
 * Shape assumed (documented in the task brief).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type Cadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface RefillSchedule {
  id: string;
  cadence: Cadence;
  /** ISO date of the next auto-order. */
  nextRunAt: string;
  /** Optional saved-address id to deliver to. */
  addressId?: string | null;
  active: boolean;
  createdAt?: string;
}

export interface ScheduleInput {
  cadence: Cadence;
  nextRunAt: string;
  addressId?: string | null;
  active?: boolean;
}

export const scheduleKeys = {
  all: ['customer', 'schedules'] as const,
};

export function useMySchedules() {
  return useQuery<RefillSchedule[]>({
    queryKey: scheduleKeys.all,
    queryFn: async () =>
      (await api.get<RefillSchedule[]>('/customers/me/schedules')).data,
    staleTime: 30_000,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInput) => {
      // CreateScheduleDto whitelists ONLY these fields and the API runs
      // forbidNonWhitelisted, so sending `active` (or anything else) → 400.
      // Send exactly the allowed subset; the server defaults active=true.
      const body = {
        cadence: input.cadence,
        nextRunAt: input.nextRunAt,
        ...(input.addressId ? { addressId: input.addressId } : {}),
      };
      return (await api.post<RefillSchedule>('/customers/me/schedules', body)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ScheduleInput> & { id: string }) =>
      (await api.patch<RefillSchedule>(`/customers/me/schedules/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/customers/me/schedules/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export const CADENCE_META: Record<Cadence, { text: string; days: number }> = {
  WEEKLY: { text: 'كل أسبوع', days: 7 },
  BIWEEKLY: { text: 'كل أسبوعين', days: 14 },
  MONTHLY: { text: 'كل شهر', days: 30 },
};
