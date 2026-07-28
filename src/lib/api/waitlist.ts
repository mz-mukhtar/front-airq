import { apiRequest } from './client';
import {
  InvitationCheck,
  InvitationLink,
  InvitationRegisterRequest,
  RegisterResponse,
  SignupConfig,
  SignupSettings,
  SignupSettingsUpdate,
  WaitlistEntry,
  WaitlistJoinRequest,
  WaitlistJoinResponse,
  WaitlistPendingCount,
  WaitlistStatus,
} from './types';

// ── Public ───────────────────────────────────────────────────────────────────

// Which signup form the login page should render. Public — no session needed.
export async function getSignupConfig(): Promise<SignupConfig> {
  return apiRequest<SignupConfig>('/auth/signup-config', {
    requireAuth: false,
  });
}

// Ask for access. Backend always answers with the same generic 202.
export async function joinWaitlist(
  data: WaitlistJoinRequest
): Promise<WaitlistJoinResponse> {
  return apiRequest<WaitlistJoinResponse>('/auth/waitlist', {
    method: 'POST',
    body: JSON.stringify(data),
    requireAuth: false,
  });
}

// Validate a registration link before showing the account form.
export async function checkInvitation(token: string): Promise<InvitationCheck> {
  return apiRequest<InvitationCheck>(
    `/auth/invitations/${encodeURIComponent(token)}`,
    { requireAuth: false }
  );
}

// Redeem a registration link and create the account.
export async function registerWithInvitation(
  data: InvitationRegisterRequest
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register/invitation', {
    method: 'POST',
    body: JSON.stringify(data),
    requireAuth: false,
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function getSignupSettings(): Promise<SignupSettings> {
  return apiRequest<SignupSettings>('/admin/signup-settings');
}

// Partial update: omitted fields are left alone by the backend.
export async function updateSignupSettings(
  update: SignupSettingsUpdate
): Promise<SignupSettings> {
  return apiRequest<SignupSettings>('/admin/signup-settings', {
    method: 'PUT',
    body: JSON.stringify(update),
  });
}

// Backs the sidebar badge, so it stays a bare count and is polled.
export async function getWaitlistPendingCount(): Promise<WaitlistPendingCount> {
  return apiRequest<WaitlistPendingCount>('/admin/waitlist/pending-count');
}

export async function getWaitlistEntries(
  status?: WaitlistStatus
): Promise<WaitlistEntry[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<WaitlistEntry[]>(`/admin/waitlist${query}`);
}

// Approving mints the registration link. The response carries it in plaintext
// exactly once — the caller must surface it before discarding the result.
// Omitting expiresInDays lets the backend apply the configured default.
export async function approveWaitlistEntry(
  entryId: string,
  expiresInDays?: number
): Promise<InvitationLink> {
  return apiRequest<InvitationLink>(`/admin/waitlist/${entryId}/approve`, {
    method: 'POST',
    body: JSON.stringify(
      expiresInDays ? { expires_in_days: expiresInDays } : {}
    ),
  });
}

// Mint a replacement link (revokes the previous one) for an approved entry.
export async function regenerateRegistrationLink(
  entryId: string,
  expiresInDays?: number
): Promise<InvitationLink> {
  return apiRequest<InvitationLink>(
    `/admin/waitlist/${entryId}/registration-link`,
    {
      method: 'POST',
      body: JSON.stringify(
        expiresInDays ? { expires_in_days: expiresInDays } : {}
      ),
    }
  );
}

export async function rejectWaitlistEntry(
  entryId: string
): Promise<WaitlistEntry> {
  return apiRequest<WaitlistEntry>(`/admin/waitlist/${entryId}/reject`, {
    method: 'POST',
  });
}

export async function deleteWaitlistEntry(
  entryId: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/admin/waitlist/${entryId}`, {
    method: 'DELETE',
  });
}
