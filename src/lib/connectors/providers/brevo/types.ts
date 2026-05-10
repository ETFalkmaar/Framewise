/**
 * Brevo (formerly Sendinblue) — types.
 *
 * First newsletter / email-marketing connector. Brevo's free tier
 * covers 300 emails/day with unlimited contacts — more than enough
 * for the AI-agent → newsletter flow that lands in step 23+.
 *
 * Authentication: customer-issued API key. Brevo uses a CUSTOM
 * `api-key` header (NOT `Authorization: Bearer`) — see
 * `client.ts` for the wire shape.
 */

/**
 * Subset of `GET /v3/account` we surface on the connection. Brevo
 * returns more than this (security keys, marketing automation, …)
 * but everything past plan + address is irrelevant to the
 * connection-card UI.
 */
export interface BrevoAccount {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  address?: {
    street?: string;
    city?: string;
    zipCode?: string;
    country?: string;
  };
  /**
   * Plan list. Brevo can return MULTIPLE entries because the free
   * marketing plan and a paid SMTP add-on can co-exist on the same
   * account. We surface the first entry as "primary" and sum
   * `credits` across all entries.
   */
  plan?: BrevoPlan[];
}

/**
 * One row of the `plan` array. `type` values seen in the wild:
 * `free` (entry tier), `payAsYouGo`, `subscription` (paid plans),
 * `sms`, `cc` (campaign credits add-on).
 */
export interface BrevoPlan {
  type: string;
  /** `sendLimit` (marketing) | `email` (transactional) | `sms`. */
  creditsType?: string;
  credits?: number;
  startDate?: string;
  endDate?: string | null;
  userLimit?: number;
}

/** Credentials persisted via the vault. */
export interface BrevoCredentials {
  api_key: string;
}

/**
 * Subset of `BrevoAccount` we persist into
 * `provider_connections.metadata`. All fields optional so the
 * connection card can render gracefully when older rows lack newer
 * keys.
 */
export interface BrevoMetadata {
  email?: string;
  company_name?: string;
  /** `${firstName} ${lastName}` joined and trimmed. */
  full_name?: string;
  country?: string;
  /** Type of the primary plan — `free`, `subscription`, `payAsYouGo`, … */
  plan_type?: string;
  /** Sum of `credits` across all plan entries. */
  credits_remaining?: number;
  /**
   * `true` when the primary plan is `free`. Drives the "Free tier"
   * badge on the connection card.
   */
  is_free_tier?: boolean;
}
