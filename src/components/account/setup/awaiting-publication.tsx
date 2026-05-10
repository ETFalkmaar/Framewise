import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AwaitingPublicationCopy {
  title: string;
  readyMessage: string;
  notReadyMessage: string;
  contactInfo: string;
}

export interface AwaitingPublicationProps {
  /** When true, all required items are complete and Framewise can publish. */
  ready: boolean;
  copy: AwaitingPublicationCopy;
}

/**
 * Read-only card for customers (non super-admin) on the setup page
 * (step 32). Tells them whether Framewise can publish the site
 * yet — Framewise themselves still pull the trigger via the
 * `<PublishButton />` when they're logged in.
 */
export function AwaitingPublication({ ready, copy }: AwaitingPublicationProps) {
  return (
    <Card
      size="sm"
      data-testid="awaiting-publication"
      data-ready={ready ? 'true' : 'false'}
      className={ready ? 'border-blue-500/40 bg-blue-500/5' : 'border-amber-500/40 bg-amber-500/5'}
    >
      <CardHeader>
        <CardTitle className="text-sm">{copy.title}</CardTitle>
        <CardDescription className="text-xs">
          {ready ? copy.readyMessage : copy.notReadyMessage}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground font-mono text-xs">{copy.contactInfo}</p>
      </CardContent>
    </Card>
  );
}
