import { describe, expect, it } from 'vitest';

import { MockVercelDomainsClient, buildMockDnsInstructions } from '../vercel-client';

describe('buildMockDnsInstructions', () => {
  it('returns an A + CNAME + TXT triple keyed on the domain', () => {
    const records = buildMockDnsInstructions('klant.nl');
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual({ type: 'A', name: '@', value: '76.76.21.21' });
    expect(records[1]).toEqual({ type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' });
    expect(records[2]).toEqual({
      type: 'TXT',
      name: '_vercel.klant.nl',
      value: 'framewise-verify-klant-nl',
    });
  });

  it('normalises non-alphanumeric characters in the verify token', () => {
    const records = buildMockDnsInstructions('Sub.Example.CO.UK');
    const txt = records.find((r) => r.type === 'TXT')!;
    expect(txt.value).toBe('framewise-verify-sub-example-co-uk');
  });
});

describe('MockVercelDomainsClient', () => {
  it('addDomain returns pending_dns with the DNS instructions', async () => {
    const client = new MockVercelDomainsClient();
    const info = await client.addDomain('klant.nl');
    expect(info.status).toBe('pending_dns');
    expect(info.verified).toBe(false);
    expect(info.verificationRecords).toHaveLength(3);
  });

  it('verifyDomain advances pending_dns -> ssl_pending on the first call', async () => {
    const client = new MockVercelDomainsClient();
    await client.addDomain('klant.nl');
    const info = await client.verifyDomain('klant.nl');
    expect(info.status).toBe('ssl_pending');
    expect(info.verified).toBe(false);
  });

  it('verifyDomain advances ssl_pending -> active on the second call', async () => {
    const client = new MockVercelDomainsClient();
    await client.addDomain('klant.nl');
    await client.verifyDomain('klant.nl');
    const info = await client.verifyDomain('klant.nl');
    expect(info.status).toBe('active');
    expect(info.verified).toBe(true);
  });

  it('verifyDomain stays on active for any further calls', async () => {
    const client = new MockVercelDomainsClient();
    await client.addDomain('klant.nl');
    await client.verifyDomain('klant.nl');
    await client.verifyDomain('klant.nl');
    const info = await client.verifyDomain('klant.nl');
    expect(info.status).toBe('active');
  });

  it('verifyDomain throws when called for an unknown domain', async () => {
    const client = new MockVercelDomainsClient();
    await expect(client.verifyDomain('unknown.nl')).rejects.toThrow(/not found/);
  });

  it('getDomain returns null for unknown domain', async () => {
    const client = new MockVercelDomainsClient();
    expect(await client.getDomain('nothing.nl')).toBeNull();
  });

  it('removeDomain wipes the entry', async () => {
    const client = new MockVercelDomainsClient();
    await client.addDomain('klant.nl');
    await client.removeDomain('klant.nl');
    expect(await client.getDomain('klant.nl')).toBeNull();
  });
});
