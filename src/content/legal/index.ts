import { TERMS_MD } from "./terms";
import { PRIVACY_MD } from "./privacy";
import { ACCEPTABLE_USE_MD } from "./acceptable-use";

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  body: string;
};

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    description: "The agreement between you and the operator of this CodePilot AI instance.",
    body: TERMS_MD,
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    description: "What this instance stores, why, and where it is sent.",
    body: PRIVACY_MD,
  },
  "acceptable-use": {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    description: "Prohibited activity and enforcement.",
    body: ACCEPTABLE_USE_MD,
  },
};

export const LEGAL_PLACEHOLDERS = [
  "[OPERATOR LEGAL NAME]",
  "[LEGAL CONTACT EMAIL]",
  "[GOVERNING JURISDICTION]",
  "[EFFECTIVE DATE]",
  "[PRIVACY CONTACT]",
  "[SECURITY CONTACT EMAIL]",
  "[SERVICE ADDRESS IF REQUIRED]",
];

export function unresolvedPlaceholders(body: string): string[] {
  return LEGAL_PLACEHOLDERS.filter((placeholder) => body.includes(placeholder));
}

/**
 * Production deployments must not present unfinished legal documents as final.
 * Set LEGAL_PLACEHOLDERS_RESOLVED=1 only after completing every placeholder.
 */
export function legalIsFinal(body: string): boolean {
  return process.env.LEGAL_PLACEHOLDERS_RESOLVED === "1" && unresolvedPlaceholders(body).length === 0;
}
