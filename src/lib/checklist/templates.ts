import type { CountryCode, LocalisedString, ProviderCategory } from '@/lib/countries';
import type { SubscriptionPlanCode } from '@/types/database';

/** What kind of action the user takes to complete the item. */
export type ChecklistActionType = 'domain' | 'connection' | 'info' | 'manual';

/** Where the system reads the "this is done" signal. */
export type AutoCompleteSource =
  | { type: 'connection'; category: ProviderCategory }
  | { type: 'tenant_field'; field: 'custom_domain' | 'vat_number' | 'crib_number' }
  | { type: 'manual' };

/** Categories used to group items in the UI. */
export type ChecklistCategory =
  | 'domain'
  | 'accounting'
  | 'payments'
  | 'phone'
  | 'crm'
  | 'newsletter'
  | 'content'
  | 'legal';

/**
 * Code-defined onboarding template. The set of templates that applies to
 * a tenant is determined by `(country, plan)`; per-tenant progress lives
 * in the `tenant_checklist_status` table keyed by `template.id`.
 */
export interface ChecklistItemTemplate {
  id: string;
  country: CountryCode;
  planCodes: SubscriptionPlanCode[];
  category: ChecklistCategory;
  required: boolean;
  orderIndex: number;
  actionType: ChecklistActionType;
  label: LocalisedString;
  description: LocalisedString;
  /**
   * Page to deep-link to when the user clicks the item card. `null` for
   * items that don't have a sensible target yet.
   */
  href: string | null;
  autoCompleteSource: AutoCompleteSource;
}

const ALL_PLANS: SubscriptionPlanCode[] = ['basic', 'pro', 'enterprise'];
const PRO_AND_UP: SubscriptionPlanCode[] = ['pro', 'enterprise'];
const ENTERPRISE_ONLY: SubscriptionPlanCode[] = ['enterprise'];

/**
 * The complete list of templates. Adding a new step is a one-line append
 * here; the generator + progress + UI pick it up automatically.
 *
 * Convention: `orderIndex` keeps required items above optional ones for
 * the same country.
 */
export const allTemplates: ChecklistItemTemplate[] = [
  // ─── 🇳🇱 NETHERLANDS ───────────────────────────────────────────────
  {
    id: 'nl-domain',
    country: 'NL',
    planCodes: ALL_PLANS,
    category: 'domain',
    required: true,
    orderIndex: 10,
    actionType: 'domain',
    href: '/account',
    autoCompleteSource: { type: 'tenant_field', field: 'custom_domain' },
    label: {
      nl: 'Domein gekoppeld',
      fr: 'Domaine connecté',
      en: 'Domain connected',
    },
    description: {
      nl: 'Koppel je eigen domeinnaam aan deze site (bv. mijnzaak.nl) zodat bezoekers je via dat adres kunnen vinden.',
      fr: 'Reliez votre nom de domaine à ce site (ex. monaffaire.nl) pour que les visiteurs puissent vous trouver.',
      en: 'Hook up your own domain (e.g. mybusiness.nl) so visitors can find you at that address.',
    },
  },
  {
    id: 'nl-vat',
    country: 'NL',
    planCodes: ALL_PLANS,
    category: 'legal',
    required: true,
    orderIndex: 20,
    actionType: 'info',
    href: '/account',
    autoCompleteSource: { type: 'tenant_field', field: 'vat_number' },
    label: {
      nl: 'BTW-nummer ingevuld',
      fr: 'Numéro de TVA renseigné',
      en: 'VAT number entered',
    },
    description: {
      nl: 'Vul je Nederlandse BTW-nummer in (NL...B01) zodat we het automatisch op facturen en in de footer kunnen tonen.',
      fr: 'Saisissez votre numéro de TVA néerlandais (NL...B01) pour qu’il apparaisse automatiquement sur les factures et dans le pied de page.',
      en: 'Enter your Dutch VAT number (NL…B01) so it appears automatically on invoices and in the footer.',
    },
  },
  {
    id: 'nl-accounting',
    country: 'NL',
    planCodes: ALL_PLANS,
    category: 'accounting',
    required: true,
    orderIndex: 30,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'accounting' },
    label: {
      nl: 'Boekhouding gekoppeld',
      fr: 'Comptabilité connectée',
      en: 'Accounting connected',
    },
    description: {
      nl: 'Verbind Moneybird, e-Boekhouden, Exact Online of Twinfield zodat facturen automatisch worden geboekt.',
      fr: 'Connectez Moneybird, e-Boekhouden, Exact Online ou Twinfield pour comptabiliser automatiquement vos factures.',
      en: 'Connect Moneybird, e-Boekhouden, Exact Online or Twinfield so invoices land in your books automatically.',
    },
  },
  {
    id: 'nl-privacy',
    country: 'NL',
    planCodes: ALL_PLANS,
    category: 'legal',
    required: true,
    orderIndex: 40,
    actionType: 'manual',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: {
      nl: 'Privacybeleid en cookies geverifieerd',
      fr: 'Politique de confidentialité et cookies vérifiés',
      en: 'Privacy policy and cookies verified',
    },
    description: {
      nl: 'Controleer dat het privacybeleid klopt en dat de cookie-banner een opt-in vraagt voor niet-functionele cookies.',
      fr: 'Vérifiez que la politique de confidentialité est exacte et que le bandeau cookies demande un opt-in pour les cookies non essentiels.',
      en: 'Verify the privacy policy is accurate and the cookie banner asks for opt-in on non-essential cookies.',
    },
  },
  {
    id: 'nl-pro-payments',
    country: 'NL',
    planCodes: PRO_AND_UP,
    category: 'payments',
    required: false,
    orderIndex: 110,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'payments' },
    label: {
      nl: 'Betaalmethode gekoppeld',
      fr: 'Moyen de paiement connecté',
      en: 'Payment method connected',
    },
    description: {
      nl: 'Verbind Mollie, Stripe of PayPal Business om online betalingen op deze site te accepteren.',
      fr: 'Connectez Mollie, Stripe ou PayPal Business pour accepter les paiements en ligne sur ce site.',
      en: 'Connect Mollie, Stripe or PayPal Business to accept online payments on this site.',
    },
  },
  {
    id: 'nl-pro-phone',
    country: 'NL',
    planCodes: PRO_AND_UP,
    category: 'phone',
    required: false,
    orderIndex: 120,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'phone' },
    label: {
      nl: 'Telefonie gekoppeld voor de AI-agent',
      fr: 'Téléphonie connectée pour l’agent IA',
      en: 'Phone connected for the AI agent',
    },
    description: {
      nl: 'Verbind Twilio zodat de AI-agent inkomende oproepen kan beantwoorden en uitgaande SMS kan versturen.',
      fr: 'Connectez Twilio pour que l’agent IA puisse répondre aux appels entrants et envoyer des SMS.',
      en: 'Connect Twilio so the AI agent can take inbound calls and send SMS.',
    },
  },
  {
    id: 'nl-pro-newsletter',
    country: 'NL',
    planCodes: PRO_AND_UP,
    category: 'newsletter',
    required: false,
    orderIndex: 130,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'newsletter' },
    label: {
      nl: 'Nieuwsbrief gekoppeld',
      fr: 'Newsletter connectée',
      en: 'Newsletter connected',
    },
    description: {
      nl: 'Verbind Brevo of Mailchimp om aanmeldingen vanuit het inschrijfformulier op te vangen.',
      fr: 'Connectez Brevo ou Mailchimp pour collecter les inscriptions depuis le formulaire d’abonnement.',
      en: 'Connect Brevo or Mailchimp to capture sign-ups from the subscription form.',
    },
  },
  {
    id: 'nl-pro-content-review',
    country: 'NL',
    planCodes: PRO_AND_UP,
    category: 'content',
    required: true,
    orderIndex: 50,
    actionType: 'manual',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: {
      nl: 'Content review afgerond',
      fr: 'Revue de contenu terminée',
      en: 'Content review completed',
    },
    description: {
      nl: 'Loop alle pagina’s door, controleer copy en afbeeldingen op feitelijke fouten of typos voordat je live gaat.',
      fr: 'Relisez toutes les pages, vérifiez les textes et les images pour détecter erreurs et fautes avant la mise en ligne.',
      en: 'Walk through every page and check copy + imagery for factual errors or typos before going live.',
    },
  },
  {
    id: 'nl-enterprise-crm',
    country: 'NL',
    planCodes: ENTERPRISE_ONLY,
    category: 'crm',
    required: false,
    orderIndex: 140,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'crm' },
    label: {
      nl: 'CRM gekoppeld',
      fr: 'CRM connecté',
      en: 'CRM connected',
    },
    description: {
      nl: 'Verbind HubSpot of Pipedrive zodat leads vanuit de site automatisch in je CRM landen.',
      fr: 'Connectez HubSpot ou Pipedrive pour que les leads du site arrivent automatiquement dans votre CRM.',
      en: 'Connect HubSpot or Pipedrive so leads from the site flow into your CRM automatically.',
    },
  },

  // ─── 🇨🇼 CURAÇAO ──────────────────────────────────────────────────
  {
    id: 'cw-domain',
    country: 'CW',
    planCodes: ALL_PLANS,
    category: 'domain',
    required: true,
    orderIndex: 10,
    actionType: 'domain',
    href: '/account',
    autoCompleteSource: { type: 'tenant_field', field: 'custom_domain' },
    label: {
      nl: 'Domein gekoppeld',
      fr: 'Domaine connecté',
      en: 'Domain connected',
    },
    description: {
      nl: 'Koppel je eigen domein (.cw of internationaal) aan deze site zodat klanten je makkelijk vinden.',
      fr: 'Reliez votre domaine (.cw ou international) à ce site pour que les clients vous trouvent facilement.',
      en: 'Hook up your own domain (.cw or international) so customers can find you easily.',
    },
  },
  {
    id: 'cw-crib',
    country: 'CW',
    planCodes: ALL_PLANS,
    category: 'legal',
    required: true,
    orderIndex: 20,
    actionType: 'info',
    href: '/account',
    autoCompleteSource: { type: 'tenant_field', field: 'crib_number' },
    label: {
      nl: 'CRIB-nummer ingevuld',
      fr: 'Numéro CRIB renseigné',
      en: 'CRIB number entered',
    },
    description: {
      nl: 'Vul het CRIB-nummer (9 cijfers) in zodat het automatisch op facturen en in de footer verschijnt.',
      fr: 'Saisissez le numéro CRIB (9 chiffres) pour qu’il apparaisse automatiquement sur les factures et dans le pied de page.',
      en: 'Enter the CRIB number (9 digits) so it appears automatically on invoices and in the footer.',
    },
  },
  {
    id: 'cw-accounting',
    country: 'CW',
    planCodes: ALL_PLANS,
    category: 'accounting',
    required: true,
    orderIndex: 30,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'accounting' },
    label: {
      nl: 'Boekhouding of accountant aangewezen',
      fr: 'Comptabilité ou cabinet désigné',
      en: 'Accounting or accountant in place',
    },
    description: {
      nl: 'Koppel Xero, QuickBooks of geef aan dat een lokale accountant (bv. BDO Curaçao) de boekhouding doet.',
      fr: 'Connectez Xero, QuickBooks ou indiquez qu’un cabinet local (ex. BDO Curaçao) gère la comptabilité.',
      en: 'Connect Xero, QuickBooks, or note that a local firm (e.g. BDO Curaçao) handles the books.',
    },
  },
  {
    id: 'cw-privacy',
    country: 'CW',
    planCodes: ALL_PLANS,
    category: 'legal',
    required: true,
    orderIndex: 40,
    actionType: 'manual',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: {
      nl: 'Privacybeleid en cookies geverifieerd',
      fr: 'Politique de confidentialité et cookies vérifiés',
      en: 'Privacy policy and cookies verified',
    },
    description: {
      nl: 'Curaçao kent geen verplichte cookie-banner, maar zodra je EU-bezoekers verwerkt geldt GDPR. Laat het beleid een keer controleren.',
      fr: 'Curaçao n’impose pas de bandeau cookies, mais le RGPD s’applique dès que vous traitez des visiteurs européens. Faites relire la politique.',
      en: 'Curaçao has no mandatory cookie banner, but GDPR kicks in once you serve EU visitors. Have the policy reviewed.',
    },
  },
  {
    id: 'cw-pro-payments',
    country: 'CW',
    planCodes: PRO_AND_UP,
    category: 'payments',
    required: false,
    orderIndex: 110,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'payments' },
    label: {
      nl: 'Betaalmethode gekoppeld',
      fr: 'Moyen de paiement connecté',
      en: 'Payment method connected',
    },
    description: {
      nl: 'Verbind Stripe (via Atlas of EU-entiteit) of PayPal Business om online betalingen te accepteren.',
      fr: 'Connectez Stripe (via Atlas ou une entité UE) ou PayPal Business pour accepter les paiements en ligne.',
      en: 'Connect Stripe (via Atlas or an EU entity) or PayPal Business to accept online payments.',
    },
  },
  {
    id: 'cw-pro-stripe-atlas',
    country: 'CW',
    planCodes: PRO_AND_UP,
    category: 'payments',
    required: false,
    orderIndex: 115,
    actionType: 'info',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: {
      nl: 'Stripe Atlas-info gelezen',
      fr: 'Information Stripe Atlas lue',
      en: 'Stripe Atlas information reviewed',
    },
    description: {
      nl: 'Stripe is in Curaçao alleen via Stripe Atlas (US-route) of een EU-entiteit beschikbaar. Lees de checklist en bevestig dat je de optie kent.',
      fr: 'À Curaçao, Stripe nécessite Stripe Atlas (voie américaine) ou une entité UE. Parcourez la checklist et confirmez que vous connaissez l’option.',
      en: 'Stripe in Curaçao requires Stripe Atlas (US route) or an EU entity. Read the checklist and confirm you understand the route.',
    },
  },
  {
    id: 'cw-pro-phone',
    country: 'CW',
    planCodes: PRO_AND_UP,
    category: 'phone',
    required: false,
    orderIndex: 120,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'phone' },
    label: {
      nl: 'Telefonie gekoppeld',
      fr: 'Téléphonie connectée',
      en: 'Phone connected',
    },
    description: {
      nl: 'Verbind Telnyx voor +599-nummers zodat de AI-agent klanten lokaal kan bedienen.',
      fr: 'Connectez Telnyx pour les numéros +599 afin que l’agent IA puisse répondre localement.',
      en: 'Connect Telnyx for +599 numbers so the AI agent can answer locally.',
    },
  },
  {
    id: 'cw-pro-kyc',
    country: 'CW',
    planCodes: PRO_AND_UP,
    category: 'phone',
    required: false,
    orderIndex: 125,
    actionType: 'info',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: {
      nl: 'Telnyx KYC-documenten ingediend',
      fr: 'Documents KYC Telnyx déposés',
      en: 'Telnyx KYC documents submitted',
    },
    description: {
      nl: 'Voor +599-nummers vraagt Telnyx een KYC-dossier (paspoort + uittreksel KvK Curaçao). Dit duurt 1–3 werkdagen.',
      fr: 'Pour les numéros +599, Telnyx exige un dossier KYC (passeport + extrait KvK Curaçao). Comptez 1 à 3 jours ouvrés.',
      en: 'For +599 numbers Telnyx requires a KYC packet (passport + Curaçao Chamber of Commerce excerpt). Expect 1–3 business days.',
    },
  },
  {
    id: 'cw-pro-newsletter',
    country: 'CW',
    planCodes: PRO_AND_UP,
    category: 'newsletter',
    required: false,
    orderIndex: 130,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'newsletter' },
    label: {
      nl: 'Nieuwsbrief gekoppeld',
      fr: 'Newsletter connectée',
      en: 'Newsletter connected',
    },
    description: {
      nl: 'Verbind Brevo of Mailchimp om gasten te informeren over nieuwe periodes en promoties.',
      fr: 'Connectez Brevo ou Mailchimp pour informer les clients sur les nouvelles périodes et promotions.',
      en: 'Connect Brevo or Mailchimp to keep guests informed about new dates and promotions.',
    },
  },
  {
    id: 'cw-pro-content-review',
    country: 'CW',
    planCodes: PRO_AND_UP,
    category: 'content',
    required: true,
    orderIndex: 50,
    actionType: 'manual',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: {
      nl: 'Content review afgerond',
      fr: 'Revue de contenu terminée',
      en: 'Content review completed',
    },
    description: {
      nl: 'Loop alle pagina’s door, controleer copy en afbeeldingen op feitelijke fouten of typos voordat je live gaat.',
      fr: 'Relisez toutes les pages, vérifiez les textes et les images pour détecter erreurs et fautes avant la mise en ligne.',
      en: 'Walk through every page and check copy + imagery for factual errors or typos before going live.',
    },
  },
  {
    id: 'cw-enterprise-crm',
    country: 'CW',
    planCodes: ENTERPRISE_ONLY,
    category: 'crm',
    required: false,
    orderIndex: 140,
    actionType: 'connection',
    href: '/account/connections',
    autoCompleteSource: { type: 'connection', category: 'crm' },
    label: {
      nl: 'CRM gekoppeld',
      fr: 'CRM connecté',
      en: 'CRM connected',
    },
    description: {
      nl: 'Verbind HubSpot of Pipedrive zodat boekingen en contactaanvragen automatisch in je CRM landen.',
      fr: 'Connectez HubSpot ou Pipedrive pour que réservations et demandes de contact arrivent dans votre CRM.',
      en: 'Connect HubSpot or Pipedrive so bookings and contact requests flow into your CRM.',
    },
  },
];

/**
 * Returns the templates that apply to a `(country, plan)` pair, sorted
 * by `orderIndex` (required items always above optional ones because of
 * how the `orderIndex` constants are spaced).
 */
export function getTemplatesForCountryAndPlan(
  country: CountryCode,
  planCode: SubscriptionPlanCode
): ChecklistItemTemplate[] {
  return allTemplates
    .filter((t) => t.country === country && t.planCodes.includes(planCode))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function getTemplateById(id: string): ChecklistItemTemplate | undefined {
  return allTemplates.find((t) => t.id === id);
}
