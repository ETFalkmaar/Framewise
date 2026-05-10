import type { DnsRecord, DomainStatus } from './types';

/**
 * Subset of the Vercel Domains API shape we need (step 33). The
 * real Vercel response has many more fields but for the wizard we
 * only care about the verification state and the DNS instructions
 * Vercel hands us back when we `POST /v10/projects/{id}/domains`.
 */
export interface VercelDomainInfo {
  name: string;
  /** `true` once Vercel sees the customer's DNS records resolve correctly. */
  verified: boolean;
  /** Step 33 simplification: a single record list flat-mapped from Vercel's `verification` array. */
  verificationRecords: DnsRecord[];
  /** Vercel-side status, mapped 1:1 onto our `DomainStatus`. */
  status: DomainStatus;
  /** Set when Vercel raised an issue (e.g. domain already on another project). */
  errorMessage?: string;
}

export interface VercelDomainsClient {
  addDomain(domain: string): Promise<VercelDomainInfo>;
  verifyDomain(domain: string): Promise<VercelDomainInfo>;
  removeDomain(domain: string): Promise<void>;
  getDomain(domain: string): Promise<VercelDomainInfo | null>;
}

/**
 * In-memory mock client used in dev / tests / CI (step 33). Real
 * Vercel API integration ships once we wire `VERCEL_API_TOKEN`
 * into the production secret store.
 *
 * Behaviour:
 *  - `addDomain` always succeeds, returns `pending_dns` with a
 *    deterministic instruction set (A record → 76.76.21.21, TXT
 *    `_vercel.<domain>` → `framewise-verify-<slug>`).
 *  - `verifyDomain` advances the lifecycle on each call:
 *    `pending_dns` → `ssl_pending` → `active`. Two calls reach
 *    `active`, which is enough to exercise the wizard polling
 *    flow in tests.
 *  - `removeDomain` deletes the entry from the in-memory map.
 *  - `getDomain` returns `null` for unknown names.
 */
export class MockVercelDomainsClient implements VercelDomainsClient {
  private domains = new Map<string, VercelDomainInfo>();

  async addDomain(domain: string): Promise<VercelDomainInfo> {
    const info: VercelDomainInfo = {
      name: domain,
      verified: false,
      status: 'pending_dns',
      verificationRecords: buildMockDnsInstructions(domain),
    };
    this.domains.set(domain, info);
    return info;
  }

  async verifyDomain(domain: string): Promise<VercelDomainInfo> {
    const current = this.domains.get(domain);
    if (!current) {
      throw new Error(`Domain ${domain} not found in mock client`);
    }
    const next: VercelDomainInfo = (() => {
      if (current.status === 'pending_dns') {
        return { ...current, status: 'ssl_pending' };
      }
      if (current.status === 'ssl_pending') {
        return { ...current, status: 'active', verified: true };
      }
      return current;
    })();
    this.domains.set(domain, next);
    return next;
  }

  async removeDomain(domain: string): Promise<void> {
    this.domains.delete(domain);
  }

  async getDomain(domain: string): Promise<VercelDomainInfo | null> {
    return this.domains.get(domain) ?? null;
  }
}

export function buildMockDnsInstructions(domain: string): DnsRecord[] {
  const slug = domain.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return [
    { type: 'A', name: '@', value: '76.76.21.21' },
    { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
    { type: 'TXT', name: `_vercel.${domain}`, value: `framewise-verify-${slug}` },
  ];
}

let cachedClient: VercelDomainsClient | null = null;

/**
 * Resolve the Vercel client to use. Defaults to the mock; tests
 * inject their own by calling `setVercelDomainsClient()`. Step 88
 * wires the real API client behind `VERCEL_API_TOKEN`.
 */
export function getVercelDomainsClient(): VercelDomainsClient {
  if (!cachedClient) cachedClient = new MockVercelDomainsClient();
  return cachedClient;
}

export function setVercelDomainsClient(client: VercelDomainsClient | null): void {
  cachedClient = client;
}
