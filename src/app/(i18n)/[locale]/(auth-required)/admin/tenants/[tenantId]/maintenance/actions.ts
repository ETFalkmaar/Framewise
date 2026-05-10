'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isUserSuperAdmin, requireCurrentUser } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';

const maintenanceSettingsSchema = z.object({
  tenantId: z.string().min(1),
  messageNl: z.string().max(500).optional().or(z.literal('')),
  messageFr: z.string().max(500).optional().or(z.literal('')),
  messageEn: z.string().max(500).optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  contactEmail: z.string().email().optional().or(z.literal('')),
});

export interface UpdateMaintenanceResult {
  success: boolean;
  error?: string;
}

/**
 * Step 34 super-admin server action: writes the branded
 * maintenance fields on the tenant row.
 *
 * Empty-string inputs are normalised to `null` so the renderer
 * falls back to the framework default. The locale messages live
 * in a single JSONB column (`maintenance_message_translations`);
 * keys with empty values are dropped before we persist.
 */
export async function updateMaintenanceSettingsAction(
  raw: z.infer<typeof maintenanceSettingsSchema>
): Promise<UpdateMaintenanceResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }
  if (!isUserSuperAdmin(user.id)) {
    return { success: false, error: 'Alleen de super-admin mag onderhoudspagina instellen' };
  }

  const parsed = maintenanceSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: `Validatie mislukt: ${first?.message ?? 'onbekend'} (${first?.path?.join('.') ?? ''})`,
    };
  }

  const translations: Record<string, string> = {};
  if (parsed.data.messageNl) translations.nl = parsed.data.messageNl;
  if (parsed.data.messageFr) translations.fr = parsed.data.messageFr;
  if (parsed.data.messageEn) translations.en = parsed.data.messageEn;

  try {
    await tenantsRepo.update(parsed.data.tenantId, {
      maintenance_message_translations: Object.keys(translations).length > 0 ? translations : null,
      maintenance_logo_url: parsed.data.logoUrl ? parsed.data.logoUrl : null,
      maintenance_contact_email: parsed.data.contactEmail ? parsed.data.contactEmail : null,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Update mislukt',
    };
  }

  revalidatePath(`/admin/tenants/${parsed.data.tenantId}/maintenance`);
  return { success: true };
}
