import type { LocaleCode, Translation, TranslationNamespace } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface TranslationsRepository {
  findByReference(
    tenantId: string,
    namespace: TranslationNamespace,
    referenceId: string
  ): Promise<Translation[]>;
  upsert(
    tenantId: string,
    namespace: TranslationNamespace,
    referenceId: string,
    locale: LocaleCode,
    content: Record<string, unknown>
  ): Promise<Translation>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<TranslationsRepository>('translationsRepo');
export const translationsRepo = proxy;
export const setTranslationsRepo = set;
