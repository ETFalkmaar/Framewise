export type { DnsRecord, DnsRecordType, DomainSetup, DomainStatus } from './types';
export {
  removeDomainSetup,
  startDomainSetup,
  verifyDomainSetup,
  type DomainSetupResult,
  type StartDomainSetupInput,
  type VerifyDomainSetupInput,
} from './setup';
export {
  MockVercelDomainsClient,
  buildMockDnsInstructions,
  getVercelDomainsClient,
  setVercelDomainsClient,
  type VercelDomainInfo,
  type VercelDomainsClient,
} from './vercel-client';
