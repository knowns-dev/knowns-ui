/** @registry part-of="social-button" */
/**
 * Pure helpers for the social sign-in button: the provider list and names, and the colour rules. No React here.
 * The marks themselves live in lib/knowns/icons/social-icons.data.ts.
 */

/** Every built-in provider. The first four are the original set and keep their order. */
export const SOCIAL_PROVIDERS = [
  "github", "google", "microsoft", "apple",
  "gitlab", "x", "facebook", "linkedin", "discord", "slack", "figma", "notion", "dropbox", "spotify", "twitch", "reddit",
  "tiktok", "instagram", "telegram", "whatsapp", "amazon", "bitbucket", "auth0", "okta",
] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const PROVIDER_NAME: Record<SocialProvider, string> = {
  github: "GitHub", google: "Google", microsoft: "Microsoft", apple: "Apple",
  gitlab: "GitLab", x: "X", facebook: "Facebook", linkedin: "LinkedIn", discord: "Discord", slack: "Slack", figma: "Figma", notion: "Notion",
  dropbox: "Dropbox", spotify: "Spotify", twitch: "Twitch", reddit: "Reddit", tiktok: "TikTok", instagram: "Instagram", telegram: "Telegram",
  whatsapp: "WhatsApp", amazon: "Amazon", bitbucket: "Bitbucket", auth0: "Auth0", okta: "Okta",
};

export type SocialVariant = "outline" | "brand" | "icon";

/** WCAG relative luminance of a hex colour, 0 (black) to 1 (white). Accepts "#rrggbb" or "rrggbb". */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever reads better on `bg` (the one with the higher contrast ratio). */
export function brandInk(bg: string): "#000000" | "#ffffff" {
  const l = luminance(bg);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
}

/** A mark this dark disappears on a dark surface, so it takes the text colour instead of its own. */
export const isDarkMark = (hex: string) => luminance(hex) < 0.12;

/** The colours of the brand variant. `l` is light mode, `d` is dark mode. */
export interface BrandSurface {
  bg: { l: string; d: string };
  ink: { l: string; d: string };
  ring: { l: string; d: string };
}

/**
 * Providers whose own sign-in rules fix the button (Google, Apple, Microsoft): used as they are, a light and a dark
 * style that swap with the page theme. Colours are those the rules publish.
 */
const OFFICIAL: Partial<Record<SocialProvider, BrandSurface>> = {
  google: { bg: { l: "#ffffff", d: "#131314" }, ink: { l: "#1f1f1f", d: "#e3e3e3" }, ring: { l: "#747775", d: "#8e918f" } },
  apple: { bg: { l: "#000000", d: "#ffffff" }, ink: { l: "#ffffff", d: "#000000" }, ring: { l: "#000000", d: "#ffffff" } },
  microsoft: { bg: { l: "#ffffff", d: "#2f2f2f" }, ink: { l: "#5e5e5e", d: "#ffffff" }, ring: { l: "#8c8c8c", d: "#2f2f2f" } },
};

/** Providers with an official style: the brand variant may only use that one. */
export const isOfficial = (p: SocialProvider) => p in OFFICIAL;

/** The brand variant's colours for a provider: its official surface, else its own colour with black or white ink. */
export function brandSurface(p: SocialProvider, hex: string): BrandSurface {
  const official = OFFICIAL[p];
  if (official) return official;
  const ink = brandInk(hex);
  // A near-black fill needs a hairline on a dark page, or the button is lost.
  const edge = isDarkMark(hex) ? { l: hex, d: "#ffffff33" } : { l: hex, d: hex };
  return { bg: { l: hex, d: hex }, ink: { l: ink, d: ink }, ring: edge };
}

/** What a screen reader and the tooltip say: "Continue with GitHub". */
export const actionLabel = (verb: string, name: string) => `${verb} ${name}`;
