import apiClient from "@app/services/apiClient";

export type LicenseTier = "FREE" | "PRO" | "ENTERPRISE";

export interface UserLicense {
  /** The tier in effect right now (FREE if the stored tier has expired). */
  tier: LicenseTier;
  /** The stored tier, regardless of expiry. */
  storedTier: LicenseTier;
  /** ISO timestamp when the subscription expires, or null for no expiry. */
  expiresAt: string | null;
}

/**
 * AziralPDF subscription service — talks to the per-user license API.
 */
export const subscriptionService = {
  /** Current user's own subscription. */
  async getMyLicense(): Promise<UserLicense> {
    const response = await apiClient.get<UserLicense>("/api/v1/license/me", {
      suppressErrorToast: true,
    });
    return response.data;
  },

  /** Admin: assign or extend a user's subscription tier. */
  async assignLicense(
    username: string,
    tier: LicenseTier,
    durationDays?: number,
  ): Promise<void> {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("tier", tier);
    if (durationDays != null) {
      formData.append("durationDays", durationDays.toString());
    }
    await apiClient.post("/api/v1/license/admin/assign", formData, {
      suppressErrorToast: true,
    });
  },
};
