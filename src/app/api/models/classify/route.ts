import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { setModelPricingStatus, toggleModel } from "@/lib/providers";
import { PRICING_STATUSES } from "@/lib/ai/types";
import { audit } from "@/lib/audit";

const Schema = z.object({
  providerId: z.string().min(1).max(80),
  modelId: z.string().min(1).max(300),
  pricingStatus: z.enum(PRICING_STATUSES as [string, ...string[]]).optional(),
  confirmation: z.string().max(500).optional().nullable(),
  enabled: z.boolean().optional(),
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, Schema);
  if (body.enabled !== undefined) {
    toggleModel(auth.user.id, body.providerId, body.modelId, body.enabled);
  }
  if (body.pricingStatus) {
    setModelPricingStatus(
      auth.user.id,
      body.providerId,
      body.modelId,
      body.pricingStatus as any,
      body.confirmation ?? null,
    );
  }
  audit(request, auth.user.id, "model.classification_changed", `${body.providerId}/${body.modelId}`, {
    pricingStatus: body.pricingStatus,
    enabled: body.enabled,
  });
  return json({ ok: true });
});
