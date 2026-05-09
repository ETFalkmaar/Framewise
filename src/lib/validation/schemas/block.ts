import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';

const ctaSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(2048),
  variant: z.enum(['default', 'outline', 'ghost', 'link']).optional(),
});

const heroData = z.object({
  headline: z.string().min(1).max(200).optional(),
  subline: z.string().max(400).optional(),
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(400).optional(),
  cta: ctaSchema.optional(),
  cta_label: z.string().max(60).optional(),
  cta_href: z.string().max(2048).optional(),
  image_url: z.string().max(2048).optional(),
});

const textData = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  content: z.string().min(1).max(20000).optional(),
});

const imageData = z.object({
  mediaId: uuidSchema.optional(),
  media_id: uuidSchema.optional(),
  caption: z.string().max(400).optional(),
  alignment: z.enum(['left', 'center', 'right', 'full']).optional(),
});

const galleryData = z.object({
  mediaIds: z.array(uuidSchema).min(1).max(20).optional(),
  images: z.array(z.string().min(1).max(2048)).min(1).max(20).optional(),
});

const ctaBlockData = z.object({
  headline: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  cta_label: z.string().max(60).optional(),
  cta_href: z.string().max(2048).optional(),
  button: ctaSchema.optional(),
});

const faqData = z.object({
  items: z
    .array(
      z.object({
        question: z.string().min(1).max(400),
        answer: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(50),
});

const pricingData = z.object({
  plans: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        price: z.string().min(1).max(40),
        features: z.array(z.string().min(1).max(200)).max(20),
      })
    )
    .min(1)
    .max(10)
    .optional(),
  from_price_cents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  label: z.string().max(40).optional(),
});

const contactData = z.object({
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  address: z.string().max(400).optional(),
});

export const blockTypeSchema = z.enum([
  'hero',
  'text',
  'image',
  'gallery',
  'cta',
  'faq',
  'pricing',
  'contact',
]);

const blockBaseSchema = {
  page_id: uuidSchema,
  order_index: z.number().int().min(0),
};

export const blockInsertSchema = z.discriminatedUnion('block_type', [
  z.object({ ...blockBaseSchema, block_type: z.literal('hero'), data: heroData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('text'), data: textData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('image'), data: imageData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('gallery'), data: galleryData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('cta'), data: ctaBlockData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('faq'), data: faqData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('pricing'), data: pricingData }),
  z.object({ ...blockBaseSchema, block_type: z.literal('contact'), data: contactData }),
]);

export const blockUpdateSchema = z
  .object({
    block_type: blockTypeSchema.optional(),
    order_index: z.number().int().min(0).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type BlockInsert = z.infer<typeof blockInsertSchema>;
export type BlockUpdate = z.infer<typeof blockUpdateSchema>;
