/**
 * Domain wizard types (step 33, fase 10).
 *
 * `DomainSetup` is the read model the wizard renders: where the
 * domain is in its lifecycle, which DNS records the customer has
 * to add at their registrar, and (once verified) when the SSL
 * certificate finished provisioning.
 */

export type DomainStatus =
  /** Domain registered with Vercel; waiting for the customer's DNS records. */
  | 'pending_dns'
  /** DNS resolves to the right values; Vercel is now provisioning the SSL cert. */
  | 'ssl_pending'
  /** Live: DNS + SSL both ready. */
  | 'active'
  /** Vercel reports the verification failed or the domain hit a registrar issue. */
  | 'error';

export type DnsRecordType = 'A' | 'CNAME' | 'TXT';

export interface DnsRecord {
  type: DnsRecordType;
  /** Hostname relative to the apex, e.g. `@` for the apex or `www`. */
  name: string;
  /** The value the customer copies into their DNS provider. */
  value: string;
}

export interface DomainSetup {
  tenantId: string;
  domain: string;
  status: DomainStatus;
  dnsRecords: DnsRecord[];
  /** ISO timestamp when the domain first went `active`. */
  verifiedAt: string | null;
  errorMessage: string | null;
}
