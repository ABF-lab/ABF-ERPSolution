import { defineCollection, z } from "astro:content";

const baseEntry = z.object({
  title: z.string(),
  tagline: z.string().optional(),
  summary: z.string(),
  heroImage: z.string().optional(),
  thumbnailIcon: z
    .enum([
      "heart", "drop", "book", "sprout", "shield", "megaphone",
      "first-aid", "vote", "shoes", "ball", "mosque", "chart",
      "sparkle", "compass", "people", "handshake",
    ])
    .default("sparkle"),
  thumbnailAccent: z.enum(["yellow", "red", "ink", "cream"]).default("yellow"),
  startedAt: z.string().optional(),
  status: z.enum(["active", "ongoing", "concluded", "recurring"]).default("active"),
  partners: z.array(z.string()).default([]),
  stats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .default([]),
  ctaPhone: z.string().optional(),
  order: z.number().default(100),
});

const projects = defineCollection({
  type: "content",
  schema: baseEntry.extend({
    flagship: z.boolean().default(false),
  }),
});

const relief = defineCollection({
  type: "content",
  schema: baseEntry.extend({
    location: z.string().optional(),
    occurredOn: z.string().optional(),
  }),
});

const events = defineCollection({
  type: "content",
  schema: baseEntry.extend({
    location: z.string().optional(),
    occurredOn: z.string().optional(),
    relatedProject: z.string().optional(),
  }),
});

const updates = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    issue: z.string().optional(),
    publishedOn: z.coerce.date(),
    summary: z.string(),
    coverImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { projects, relief, events, updates };
