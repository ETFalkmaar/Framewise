'use client';

import { useState, useTransition, type Dispatch, type SetStateAction } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ONBOARDING_STEPS,
  type OnboardingFormData,
  type OnboardingResult,
  type OnboardingStep,
} from '@/lib/onboarding/types';
import {
  basicInfoSchema,
  countryStepSchema,
  taxInfoSchema,
  tenantDetailsSchema,
} from '@/lib/onboarding/validation';

import { submitOnboardingAction } from './actions';

const EMPTY_FORM: OnboardingFormData = {
  companyName: '',
  contactEmail: '',
  contactName: '',
  preferredLocale: 'nl',
  country: 'NL',
  tenantSlug: '',
  customDomain: null,
  planTier: 'pro',
  vatNumber: '',
  cribNumber: '',
  legalName: '',
  legalAddress: '',
  legalCity: '',
  legalPostalCode: '',
};

const STEP_LABELS: Record<OnboardingStep, string> = {
  'basic-info': 'Klantgegevens',
  country: 'Land',
  'tenant-details': 'Tenant',
  'tax-info': 'Tax & adres',
  review: 'Bevestigen',
};

export function OnboardingWizard() {
  const [step, setStep] = useState<OnboardingStep>('basic-info');
  const [data, setData] = useState<OnboardingFormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.success) {
    return (
      <SuccessCard
        result={result}
        onReset={() => resetAll(setStep, setData, setError, setResult)}
      />
    );
  }

  const validateCurrentStep = (): boolean => {
    setError(null);
    if (step === 'basic-info') {
      const r = basicInfoSchema.safeParse({
        companyName: data.companyName,
        contactEmail: data.contactEmail,
        contactName: data.contactName,
        preferredLocale: data.preferredLocale,
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Ongeldig');
        return false;
      }
      return true;
    }
    if (step === 'country') {
      const r = countryStepSchema.safeParse({ country: data.country });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Ongeldig');
        return false;
      }
      return true;
    }
    if (step === 'tenant-details') {
      const r = tenantDetailsSchema.safeParse({
        tenantSlug: data.tenantSlug,
        customDomain: data.customDomain,
        planTier: data.planTier,
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Ongeldig');
        return false;
      }
      return true;
    }
    if (step === 'tax-info') {
      const r = taxInfoSchema.safeParse({
        country: data.country,
        vatNumber: data.vatNumber ?? '',
        cribNumber: data.cribNumber ?? '',
        legalName: data.legalName,
        legalAddress: data.legalAddress,
        legalCity: data.legalCity,
        legalPostalCode: data.legalPostalCode,
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Ongeldig');
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    const idx = ONBOARDING_STEPS.indexOf(step);
    const next = ONBOARDING_STEPS[Math.min(idx + 1, ONBOARDING_STEPS.length - 1)];
    if (next) setStep(next);
  };

  const goBack = () => {
    setError(null);
    const idx = ONBOARDING_STEPS.indexOf(step);
    const prev = ONBOARDING_STEPS[Math.max(idx - 1, 0)];
    if (prev) setStep(prev);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const r = await submitOnboardingAction(data);
      if (!r.success) {
        setError(r.error ?? 'Onboarding mislukt');
        return;
      }
      setResult(r);
    });
  };

  return (
    <div data-testid="onboarding-wizard" className="space-y-6">
      <ProgressBar current={step} />

      <Card>
        <CardHeader>
          <CardTitle data-testid={`onboarding-step-title-${step}`}>{STEP_LABELS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'basic-info' && <BasicInfoStep data={data} setData={setData} />}
          {step === 'country' && <CountryStep data={data} setData={setData} />}
          {step === 'tenant-details' && <TenantDetailsStep data={data} setData={setData} />}
          {step === 'tax-info' && <TaxInfoStep data={data} setData={setData} />}
          {step === 'review' && <ReviewStep data={data} />}

          {error && (
            <p data-testid="onboarding-error" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={step === 'basic-info' || pending}
              data-testid="onboarding-back"
            >
              Vorige
            </Button>
            {step === 'review' ? (
              <Button
                type="button"
                onClick={submit}
                disabled={pending}
                data-testid="onboarding-submit"
              >
                {pending ? 'Bezig…' : 'Onboard klant'}
              </Button>
            ) : (
              <Button type="button" onClick={goNext} data-testid="onboarding-next">
                Volgende
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressBar({ current }: { current: OnboardingStep }) {
  const idx = ONBOARDING_STEPS.indexOf(current);
  return (
    <ol
      data-testid="onboarding-progress"
      className="text-muted-foreground flex flex-wrap gap-2 text-xs"
    >
      {ONBOARDING_STEPS.map((s, i) => {
        const status = i < idx ? 'done' : i === idx ? 'current' : 'pending';
        return (
          <li
            key={s}
            data-testid={`onboarding-progress-${s}`}
            data-status={status}
            className={
              status === 'current'
                ? 'text-foreground font-medium'
                : status === 'done'
                  ? 'text-foreground/70'
                  : ''
            }
          >
            {i + 1}. {STEP_LABELS[s]}
          </li>
        );
      })}
    </ol>
  );
}

interface StepProps {
  data: OnboardingFormData;
  setData: Dispatch<SetStateAction<OnboardingFormData>>;
}

function BasicInfoStep({ data, setData }: StepProps) {
  return (
    <>
      <Field id="companyName" label="Bedrijfsnaam">
        <Input
          id="companyName"
          data-testid="field-companyName"
          value={data.companyName}
          onChange={(e) => setData({ ...data, companyName: e.target.value })}
        />
      </Field>
      <Field id="contactName" label="Contactnaam">
        <Input
          id="contactName"
          data-testid="field-contactName"
          value={data.contactName}
          onChange={(e) => setData({ ...data, contactName: e.target.value })}
        />
      </Field>
      <Field id="contactEmail" label="Contact e-mail">
        <Input
          id="contactEmail"
          type="email"
          data-testid="field-contactEmail"
          value={data.contactEmail}
          onChange={(e) => setData({ ...data, contactEmail: e.target.value })}
        />
      </Field>
      <Field id="preferredLocale" label="Voorkeurstaal">
        <select
          id="preferredLocale"
          data-testid="field-preferredLocale"
          className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
          value={data.preferredLocale}
          onChange={(e) =>
            setData({
              ...data,
              preferredLocale: e.target.value as OnboardingFormData['preferredLocale'],
            })
          }
        >
          <option value="nl">Nederlands</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </Field>
    </>
  );
}

function CountryStep({ data, setData }: StepProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Land</legend>
      <CountryRadio
        value="NL"
        current={data.country}
        title="🇳🇱 Nederland"
        description="EUR · BTW · Europe/Amsterdam · Moneybird, Stripe, Mollie, …"
        onSelect={() => setData({ ...data, country: 'NL' })}
      />
      <CountryRadio
        value="CW"
        current={data.country}
        title="🇨🇼 Curaçao"
        description="ANG · CRIB · America/Curacao · e-Boekhouden, Stripe, …"
        onSelect={() => setData({ ...data, country: 'CW' })}
      />
    </fieldset>
  );
}

function CountryRadio({
  value,
  current,
  title,
  description,
  onSelect,
}: {
  value: 'NL' | 'CW';
  current: 'NL' | 'CW';
  title: string;
  description: string;
  onSelect: () => void;
}) {
  const checked = current === value;
  return (
    <label
      data-testid={`country-${value}`}
      data-checked={checked}
      className={`block cursor-pointer rounded-md border p-3 ${checked ? 'border-primary bg-primary/5' : 'border-input'}`}
    >
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="country"
          value={value}
          checked={checked}
          onChange={onSelect}
          className="h-4 w-4"
        />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
    </label>
  );
}

function TenantDetailsStep({ data, setData }: StepProps) {
  return (
    <>
      <Field
        id="tenantSlug"
        label="Tenant slug"
        hint="Lowercase, cijfers en streepjes; bv. acme-beach"
      >
        <Input
          id="tenantSlug"
          data-testid="field-tenantSlug"
          value={data.tenantSlug}
          onChange={(e) => setData({ ...data, tenantSlug: e.target.value.toLowerCase() })}
        />
      </Field>
      <Field id="customDomain" label="Custom domain (optioneel)">
        <Input
          id="customDomain"
          data-testid="field-customDomain"
          placeholder="klant.nl"
          value={data.customDomain ?? ''}
          onChange={(e) =>
            setData({
              ...data,
              customDomain: e.target.value === '' ? null : e.target.value.toLowerCase(),
            })
          }
        />
      </Field>
      <Field id="planTier" label="Plan">
        <select
          id="planTier"
          data-testid="field-planTier"
          className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
          value={data.planTier}
          onChange={(e) =>
            setData({ ...data, planTier: e.target.value as OnboardingFormData['planTier'] })
          }
        >
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </Field>
    </>
  );
}

function TaxInfoStep({ data, setData }: StepProps) {
  return (
    <>
      {data.country === 'NL' && (
        <Field id="vatNumber" label="BTW-nummer" hint="Format NL123456789B01">
          <Input
            id="vatNumber"
            data-testid="field-vatNumber"
            value={data.vatNumber ?? ''}
            onChange={(e) => setData({ ...data, vatNumber: e.target.value.toUpperCase() })}
          />
        </Field>
      )}
      {data.country === 'CW' && (
        <Field id="cribNumber" label="CRIB-nummer">
          <Input
            id="cribNumber"
            data-testid="field-cribNumber"
            value={data.cribNumber ?? ''}
            onChange={(e) => setData({ ...data, cribNumber: e.target.value })}
          />
        </Field>
      )}
      <Field id="legalName" label="Juridische naam">
        <Input
          id="legalName"
          data-testid="field-legalName"
          value={data.legalName}
          onChange={(e) => setData({ ...data, legalName: e.target.value })}
        />
      </Field>
      <Field id="legalAddress" label="Adres">
        <Input
          id="legalAddress"
          data-testid="field-legalAddress"
          value={data.legalAddress}
          onChange={(e) => setData({ ...data, legalAddress: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="legalCity" label="Plaats">
          <Input
            id="legalCity"
            data-testid="field-legalCity"
            value={data.legalCity}
            onChange={(e) => setData({ ...data, legalCity: e.target.value })}
          />
        </Field>
        <Field id="legalPostalCode" label="Postcode">
          <Input
            id="legalPostalCode"
            data-testid="field-legalPostalCode"
            value={data.legalPostalCode}
            onChange={(e) => setData({ ...data, legalPostalCode: e.target.value })}
          />
        </Field>
      </div>
    </>
  );
}

function ReviewStep({ data }: { data: OnboardingFormData }) {
  return (
    <dl
      data-testid="onboarding-review"
      className="text-muted-foreground grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2"
    >
      <Row label="Bedrijf">{data.companyName}</Row>
      <Row label="Contact">{`${data.contactName} <${data.contactEmail}>`}</Row>
      <Row label="Voorkeurstaal">{data.preferredLocale}</Row>
      <Row label="Land">{data.country}</Row>
      <Row label="Slug">{data.tenantSlug}</Row>
      <Row label="Plan">{data.planTier}</Row>
      <Row label="Custom domain">{data.customDomain ?? '—'}</Row>
      <Row label={data.country === 'NL' ? 'BTW' : 'CRIB'}>
        {(data.country === 'NL' ? data.vatNumber : data.cribNumber) || '—'}
      </Row>
      <Row label="Juridische naam">{data.legalName}</Row>
      <Row label="Adres">{`${data.legalAddress}, ${data.legalPostalCode} ${data.legalCity}`}</Row>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-foreground/80 font-medium">{label}</dt>
      <dd className="font-mono text-xs break-words">{children}</dd>
    </>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function SuccessCard({ result, onReset }: { result: OnboardingResult; onReset: () => void }) {
  return (
    <Card data-testid="onboarding-success">
      <CardHeader>
        <CardTitle>✅ Klant succesvol onboarded</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Stuur deze inloggegevens naar de klant — het wachtwoord wordt eenmalig getoond:
        </p>
        <div className="bg-muted space-y-1 rounded-md p-4 font-mono text-sm">
          <p>
            <span className="text-muted-foreground">Login URL:</span> /login
          </p>
          <p>
            <span className="text-muted-foreground">E-mail:</span> {result.contactEmail}
          </p>
          <p>
            <span className="text-muted-foreground">Wachtwoord:</span>{' '}
            <strong data-testid="initial-password">{result.initialPassword}</strong>
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          ⚠️ Sla het wachtwoord nu op — refresh van deze pagina is hem kwijt. De klant moet het bij
          eerste login wijzigen (gate komt in stap 56).
        </p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
          <li>
            Tenant id: <span className="font-mono">{result.tenantId}</span>
          </li>
          <li>
            Owner user id: <span className="font-mono">{result.ownerUserId}</span>
          </li>
          <li>Setup checklist is automatisch geseed; volg in admin paneel.</li>
        </ul>
        <Button type="button" variant="outline" onClick={onReset} data-testid="onboarding-reset">
          Volgende klant onboarden
        </Button>
      </CardContent>
    </Card>
  );
}

function resetAll(
  setStep: Dispatch<SetStateAction<OnboardingStep>>,
  setData: Dispatch<SetStateAction<OnboardingFormData>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setResult: Dispatch<SetStateAction<OnboardingResult | null>>
): void {
  setStep('basic-info');
  setData(EMPTY_FORM);
  setError(null);
  setResult(null);
}
