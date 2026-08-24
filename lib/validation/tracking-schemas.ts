import { z } from "zod";

export const identifySchema = z.object({
  trck_user_id: z.string().trim().min(1).optional(),
  fbp: z.string().trim().optional(),
  fbc: z.string().trim().optional(),
  ga_client_id: z.string().trim().optional(),
  ga_session_id: z.string().trim().optional(),
  utm_source: z.string().trim().max(255).optional(),
  utm_medium: z.string().trim().max(255).optional(),
  utm_campaign: z.string().trim().max(255).optional(),
  utm_term: z.string().trim().max(255).optional(),
  utm_content: z.string().trim().max(255).optional(),
  referrer: z.string().trim().max(2048).optional(),
  landing_url: z.string().trim().max(2048).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(32).optional(),
});

export type IdentifyInput = z.infer<typeof identifySchema>;

export const eventSchema = z.object({
  event_id: z.string().trim().min(1, { error: "event_id é obrigatório." }),
  event_name: z.string().trim().min(1, { error: "event_name é obrigatório." }),
  trck_user_id: z.string().trim().min(1, { error: "trck_user_id é obrigatório." }),
  event_source_url: z.string().trim().max(2048).optional(),
  value: z.coerce.number().optional(),
  currency: z.string().trim().length(3).optional(),
  content_ids: z.array(z.string()).optional(),
  content_name: z.string().trim().max(255).optional(),
  content_type: z.string().trim().max(64).optional(),
  fbp: z.string().trim().optional(),
  fbc: z.string().trim().optional(),
  ga_client_id: z.string().trim().optional(),
  ga_session_id: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(32).optional(),
  name: z.string().trim().max(255).optional(),
  utm_source: z.string().trim().max(255).optional(),
  utm_medium: z.string().trim().max(255).optional(),
  utm_campaign: z.string().trim().max(255).optional(),
  utm_term: z.string().trim().max(255).optional(),
  utm_content: z.string().trim().max(255).optional(),
  server_only: z.boolean().optional(),
});

export type EventInput = z.infer<typeof eventSchema>;
