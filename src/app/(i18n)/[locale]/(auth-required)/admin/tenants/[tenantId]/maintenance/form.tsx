'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { updateMaintenanceSettingsAction } from './actions';

export interface MaintenanceFormState {
  messageNl: string;
  messageFr: string;
  messageEn: string;
  logoUrl: string;
  contactEmail: string;
}

export function MaintenanceSettingsForm({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: MaintenanceFormState;
}) {
  const [state, setState] = useState<MaintenanceFormState>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const update = (key: keyof MaintenanceFormState, value: string) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const submit = () => {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await updateMaintenanceSettingsAction({
        tenantId,
        messageNl: state.messageNl,
        messageFr: state.messageFr,
        messageEn: state.messageEn,
        logoUrl: state.logoUrl,
        contactEmail: state.contactEmail,
      });
      if (!result.success) {
        setError(result.error ?? 'Opslaan mislukt');
        return;
      }
      setSavedAt(new Date().toISOString());
    });
  };

  return (
    <div data-testid="maintenance-form" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription className="text-xs">
            URL van het tenant-logo (vierkant, 200×200 of groter). Laat leeg om de eerste letter van
            de bedrijfsnaam te tonen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              data-testid="field-logoUrl"
              value={state.logoUrl}
              onChange={(e) => update('logoUrl', e.target.value)}
              placeholder="https://…/logo.png"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Contact e-mail</Label>
            <Input
              id="contactEmail"
              data-testid="field-contactEmail"
              type="email"
              value={state.contactEmail}
              onChange={(e) => update('contactEmail', e.target.value)}
              placeholder="hello@klant.nl"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bericht per taal</CardTitle>
          <CardDescription className="text-xs">
            Korte uitleg waarom de site offline is. Eén taal volstaat — de renderer valt terug op de
            standaardtaal van de tenant en daarna op een Framewise default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormTextArea
            id="messageNl"
            label="Nederlands"
            value={state.messageNl}
            onChange={(v) => update('messageNl', v)}
          />
          <FormTextArea
            id="messageFr"
            label="Français"
            value={state.messageFr}
            onChange={(v) => update('messageFr', v)}
          />
          <FormTextArea
            id="messageEn"
            label="English"
            value={state.messageEn}
            onChange={(v) => update('messageEn', v)}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={submit}
          disabled={pending}
          data-testid="btn-save-maintenance"
        >
          {pending ? 'Bezig met opslaan…' : 'Opslaan'}
        </Button>
        {savedAt && (
          <span data-testid="maintenance-saved" className="text-muted-foreground text-xs">
            ✓ Opgeslagen
          </span>
        )}
        {error && (
          <span data-testid="maintenance-error" className="text-destructive text-xs">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function FormTextArea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="bg-background border-input focus-visible:ring-ring placeholder:text-muted-foreground/60 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
