import { keys, useApiQuery } from './query';

/** New messages the signed-in user has not read yet (couple or vendor). Polls while the app is open. */
export function useUnreadCount(): number {
  const q = useApiQuery<{ messages: number }>(keys.unread, '/api/unread', {
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  return q.data?.messages ?? 0;
}
