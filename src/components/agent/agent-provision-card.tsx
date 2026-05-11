'use client';

import { useTransition } from 'react';

import { provisionAgent } from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/actions';

export interface AgentProvisionCardCopy {
  title: string;
  subtitle: string;
  features: string[];
  button: string;
  provisioning: string;
  errorGeneric: string;
}

export interface AgentProvisionCardProps {
  copy: AgentProvisionCardCopy;
}

/**
 * Empty-state hero shown before the tenant has clicked "Activate".
 * Calls `provisionAgent` server action via `useTransition` so the
 * button can show a pending spinner without blocking the rest of
 * the page. On success the server-side `revalidatePath` will
 * re-render this page in the `active` branch.
 */
export function AgentProvisionCard({ copy }: AgentProvisionCardProps): React.ReactElement {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const r = await provisionAgent();
      if (!r.success) {
        // The server-side revalidate handles the success path; for
        // errors the page reload is the simplest way to pick up the
        // freshly-flipped `error` status without manually re-fetching.
        window.alert(copy.errorGeneric);
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <section
      data-testid="agent-provision-card"
      className="border-border bg-muted/20 rounded-lg border p-8 text-center"
    >
      <h2 className="text-2xl font-semibold">{copy.title}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">{copy.subtitle}</p>

      <ul className="mx-auto mt-6 inline-block max-w-md space-y-1 text-left text-sm">
        {copy.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span aria-hidden className="text-emerald-500">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        data-testid="provision-button"
        className="bg-primary text-primary-foreground mt-6 rounded-md px-6 py-3 text-sm font-medium disabled:opacity-50"
      >
        {pending ? copy.provisioning : copy.button}
      </button>
    </section>
  );
}
