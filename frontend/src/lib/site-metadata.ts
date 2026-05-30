import type { Metadata } from "next";

const SITE = "Business Plan Tunisie";

export function pageMetadata(
  title: string,
  description: string
): Metadata {
  return {
    title: `${title} | ${SITE}`,
    description,
  };
}
