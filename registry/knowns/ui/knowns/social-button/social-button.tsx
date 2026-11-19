"use client";
/** @registry name="social-button" type="ui" title="Social Button" description="A sign-in button for 24 providers plus your own: an outline, a brand (official styles for Google, Apple and Microsoft) or an icon-only variant, in the Button sizes, with loading and a verb prop." */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { SOCIAL_MARKS } from "@/registry/knowns/lib/knowns/icons/social-icons.data";
import { Button, type ButtonProps } from "../button";
import { Tooltip } from "../tooltip";
import { actionLabel, brandSurface, isDarkMark, PROVIDER_NAME, type SocialProvider, type SocialVariant } from "./social-utils";

export { PROVIDER_NAME, SOCIAL_PROVIDERS, type SocialProvider, type SocialVariant } from "./social-utils";

/** A provider we don't ship a mark for (an SSO, your own IdP). */
export interface CustomProvider {
  id: string;
  label: string;
  icon?: ReactNode;
}

export type ProviderOption = SocialProvider | CustomProvider;

export const providerId = (p: ProviderOption) => (typeof p === "string" ? p : p.id);
export const providerLabel = (p: ProviderOption) => (typeof p === "string" ? PROVIDER_NAME[p] : p.label);

/** The mark of one built-in provider. Google and Microsoft are drawn in full colour, as their sign-in rules require; the rest are one path. */
export function SocialMark({ provider, colored = false, className }: { provider: SocialProvider; colored?: boolean; className?: string }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={className}>
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.8Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
        <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.86 8.88 4.75 12 4.75Z" />
      </svg>
    );
  }
  if (provider === "microsoft") {
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={className}>
        <path fill="#F25022" d="M1 1h6.5v6.5H1z" />
        <path fill="#7FBA00" d="M8.5 1H15v6.5H8.5z" />
        <path fill="#00A4EF" d="M1 8.5h6.5V15H1z" />
        <path fill="#FFB900" d="M8.5 8.5H15V15H8.5z" />
      </svg>
    );
  }
  const m = SOCIAL_MARKS[provider];
  if (!m) return null;
  // A near-black mark keeps the text colour so it turns white on a dark surface; the others take their brand colour when `colored`.
  const own = colored && !isDarkMark(m.hex) ? ({ color: `#${m.hex}` } as CSSProperties) : undefined;
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" className={className} style={own}>
      <path d={m.d} />
    </svg>
  );
}

export const GitHubIcon = () => <SocialMark provider="github" />;
export const GoogleIcon = () => <SocialMark provider="google" />;
export const MicrosoftIcon = () => <SocialMark provider="microsoft" />;
export const AppleIcon = () => <SocialMark provider="apple" />;

// Brand surface: the colours come in as variables so light and dark each get their own, and hover mixes toward the ink.
const BRAND =
  "bg-[color:var(--sb-bg-l)] text-[color:var(--sb-ink-l)] shadow-[0_0_0_1px_var(--sb-ring-l)] not-disabled:hover:bg-[color-mix(in_srgb,var(--sb-bg-l),var(--sb-ink-l)_9%)] not-disabled:hover:text-[color:var(--sb-ink-l)] dark:bg-[color:var(--sb-bg-d)] dark:text-[color:var(--sb-ink-d)] dark:shadow-[0_0_0_1px_var(--sb-ring-d)] dark:not-disabled:hover:bg-[color-mix(in_srgb,var(--sb-bg-d),var(--sb-ink-d)_9%)] dark:not-disabled:hover:text-[color:var(--sb-ink-d)]";

export interface SocialButtonProps extends Omit<ButtonProps, "variant" | "icon" | "iconRight" | "children"> {
  /** A built-in provider, or `{ id, label, icon }` for your own. */
  provider: ProviderOption;
  /**
   * outline: the neutral Button surface with the full-colour mark (default).
   * brand: the provider's own colour with a black or white mark; Google, Apple and Microsoft use only their official light and dark styles.
   * icon: a square, icon-only outline button with a tooltip.
   */
  variant?: SocialVariant;
  /** "Continue with" by default; "Sign in with" and "Sign up with" are the usual others. */
  verb?: string;
  /** Show the verb in the label ("Continue with GitHub") instead of only the name. Default: on for the brand variant, whose official styles ask for it. */
  showVerb?: boolean;
}

/**
 * One OAuth sign-in button. A real button with an aria-label of "<verb> <Name>" and an aria-hidden mark; the app starts
 * the OAuth flow in onClick. Sizes, loading and disabled are the Button's own.
 */
export function SocialButton({ provider, variant = "outline", verb = "Continue with", showVerb, size = "md", className, style, ...rest }: SocialButtonProps) {
  const name = providerLabel(provider);
  const action = actionLabel(verb, name);
  const builtin = typeof provider === "string" ? provider : null;
  const brand = variant === "brand" && builtin ? brandSurface(builtin, `#${SOCIAL_MARKS[builtin]?.hex ?? "000000"}`) : null;
  const vars = brand
    ? ({ "--sb-bg-l": brand.bg.l, "--sb-bg-d": brand.bg.d, "--sb-ink-l": brand.ink.l, "--sb-ink-d": brand.ink.d, "--sb-ring-l": brand.ring.l, "--sb-ring-d": brand.ring.d } as CSSProperties)
    : undefined;
  const mark = builtin ? <SocialMark provider={builtin} colored={!brand} /> : (provider as CustomProvider).icon;
  const iconOnly = variant === "icon";
  const button = (
    <Button
      {...rest}
      variant={brand ? "ghost" : "secondary"}
      size={size}
      icon={mark}
      aria-label={action}
      className={cn(brand && BRAND, className)}
      style={{ ...vars, ...style }}
    >
      {iconOnly ? undefined : (showVerb ?? variant === "brand") ? action : name}
    </Button>
  );
  return iconOnly ? <Tooltip content={action}>{button}</Tooltip> : button;
}
