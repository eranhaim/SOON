import { expoClient } from '@better-auth/expo/client';
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import type { UserRole } from '@soon/shared';

import { API_URL } from './config';

/**
 * On iOS/Android the session is kept in SecureStore; on web the client falls back to
 * regular cookies (expoClient is a pass-through there).
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: 'include' },
  plugins: [
    expoClient({ scheme: 'soon', storagePrefix: 'soon', storage: SecureStore }),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        role: { type: 'string', required: false, input: false },
        phone: { type: 'string', required: false, input: false },
      },
    }),
  ],
});

export type SessionUser = typeof authClient.$Infer.Session.user & { role?: UserRole | null };
