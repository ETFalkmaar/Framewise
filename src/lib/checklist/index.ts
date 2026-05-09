/**
 * Onboarding checklist domain.
 *
 * Application code imports from `@/lib/checklist`. The internals
 * (`templates.ts`, `generator.ts`, `progress.ts`) can be reorganised
 * without touching call sites.
 */

export type {
  AutoCompleteSource,
  ChecklistActionType,
  ChecklistCategory,
  ChecklistItemTemplate,
} from './templates';
export { allTemplates, getTemplatesForCountryAndPlan, getTemplateById } from './templates';

export { ensureChecklistForTenant, getTemplatesForTenant } from './generator';

export type {
  ChecklistProgress,
  ChecklistProgressItem,
  EffectiveChecklistStatus,
} from './progress';
export { computeChecklistProgress } from './progress';
