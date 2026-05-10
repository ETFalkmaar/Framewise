'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DnsRecord, DomainSetup, DomainStatus } from '@/lib/domain';

import {
  checkDomainVerificationAction,
  removeDomainSetupAction,
  submitDomainSetupAction,
} from './actions';

const STATUS_LABEL: Record<DomainStatus, string> = {
  pending_dns: 'Wachten op DNS records',
  ssl_pending: 'DNS gevonden, SSL wordt geprovisioneerd',
  active: 'Live + SSL actief',
  error: 'Fout bij verificatie',
};

const STATUS_TONE: Record<DomainStatus, string> = {
  pending_dns: 'text-amber-700 dark:text-amber-300',
  ssl_pending: 'text-blue-700 dark:text-blue-300',
  active: 'text-emerald-700 dark:text-emerald-300',
  error: 'text-destructive',
};

export interface DomainWizardProps {
  tenantId: string;
  /** When the tenant already has a custom_domain we resume the wizard there. */
  currentDomain: string | null;
}

export function DomainWizard({ tenantId, currentDomain }: DomainWizardProps) {
  const [step, setStep] = useState<'enter' | 'dns' | 'success'>(currentDomain ? 'dns' : 'enter');
  const [domain, setDomain] = useState(currentDomain ?? '');
  const [setup, setSetup] = useState<DomainSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitDomainSetupAction(tenantId, domain);
      if (!result.success || !result.setup) {
        setError(result.error ?? 'Domein kon niet worden gekoppeld');
        return;
      }
      setSetup(result.setup);
      setStep(result.setup.status === 'active' ? 'success' : 'dns');
    });
  };

  const handleVerify = () => {
    setError(null);
    startTransition(async () => {
      const result = await checkDomainVerificationAction(tenantId, domain);
      if (!result.success || !result.setup) {
        setError(result.error ?? 'Verificatie mislukt');
        return;
      }
      setSetup(result.setup);
      if (result.setup.status === 'active') setStep('success');
    });
  };

  const handleRemove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeDomainSetupAction(tenantId, domain);
      if (!result.success) {
        setError(result.error ?? 'Loskoppelen mislukt');
        return;
      }
      setDomain('');
      setSetup(null);
      setStep('enter');
    });
  };

  return (
    <div data-testid="domain-wizard" className="space-y-6">
      {step === 'enter' && (
        <Card data-testid="domain-step-enter">
          <CardHeader>
            <CardTitle>1. Voer het domein in</CardTitle>
            <CardDescription>
              Bijvoorbeeld <span className="font-mono">klant.nl</span> of{' '}
              <span className="font-mono">www.klant.com</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="domain">Domein</Label>
              <Input
                id="domain"
                data-testid="field-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value.toLowerCase())}
                placeholder="klant.nl"
              />
            </div>
            {error && (
              <p data-testid="domain-error" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending || domain.length < 4}
              data-testid="btn-submit-domain"
            >
              {pending ? 'Bezig…' : 'Volgende'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'dns' && (
        <Card data-testid="domain-step-dns">
          <CardHeader>
            <CardTitle>2. DNS records bij de registrar invoeren</CardTitle>
            <CardDescription>
              Voeg deze records toe bij de registrar van <span className="font-mono">{domain}</span>
              . DNS propagatie kan een paar minuten tot enkele uren duren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {setup?.dnsRecords && setup.dnsRecords.length > 0 ? (
              <DnsRecordsTable records={setup.dnsRecords} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Nog geen records ontvangen — klik op "Verificatie checken".
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {setup?.status && (
                <span
                  data-testid="domain-status"
                  className={`font-mono text-xs ${STATUS_TONE[setup.status]}`}
                >
                  Status: {STATUS_LABEL[setup.status]}
                </span>
              )}
              <Button
                type="button"
                onClick={handleVerify}
                disabled={pending}
                data-testid="btn-verify-domain"
                className="ml-auto"
              >
                {pending ? 'Bezig…' : 'Verificatie checken'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={pending}
                data-testid="btn-remove-domain"
              >
                Loskoppelen
              </Button>
            </div>
            {error && (
              <p data-testid="domain-error" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'success' && (
        <Card data-testid="domain-step-success" className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-emerald-700 dark:text-emerald-300">
              ✅ Domein is actief
            </CardTitle>
            <CardDescription>
              <span className="font-mono">{domain}</span> verwijst nu naar deze tenant. SSL wordt
              automatisch verlengd door Vercel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={pending}
              data-testid="btn-remove-domain"
            >
              Loskoppelen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  return (
    <div
      data-testid="dns-records-table"
      className="border-border rounded-md border font-mono text-xs"
    >
      <div className="bg-muted/40 text-muted-foreground grid grid-cols-[80px_1fr_2fr] gap-2 px-3 py-2">
        <span>Type</span>
        <span>Name</span>
        <span>Value</span>
      </div>
      {records.map((record, i) => (
        <div
          key={`${record.type}-${record.name}-${i}`}
          data-testid={`dns-record-${i}`}
          className="border-border/60 grid grid-cols-[80px_1fr_2fr] gap-2 border-t px-3 py-2"
        >
          <span className="font-semibold">{record.type}</span>
          <span className="break-all">{record.name}</span>
          <span className="break-all">{record.value}</span>
        </div>
      ))}
    </div>
  );
}
