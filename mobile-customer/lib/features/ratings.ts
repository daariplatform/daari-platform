/**
 * Order rating feature.
 *
 * Backend:
 *   POST /orders/:id/rate { stars: number; comment?: string } → OrderRating
 *
 * `GET /orders/:id` now returns `rating: OrderRating | null` on the order
 * payload, so the detail screen reads it straight off the order object —
 * no extra fetch needed.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface OrderRating {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export function useRateOrder(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stars: number; comment?: string }) =>
      (await api.post<OrderRating>(`/orders/${orderId}/rate`, input)).data,
    onSuccess: () => {
      // Refetch the order so the screen flips from "rate me" → "your rating".
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['customer', 'orders'] });
    },
  });
}
