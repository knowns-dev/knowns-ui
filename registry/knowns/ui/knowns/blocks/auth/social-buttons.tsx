"use client";
/** @registry part-of="auth-card" */
/** OAuth sign-in buttons for the built-in providers or your own. Callbacks only; the app starts the OAuth flow. Built on SocialButton. */
import { SocialButton, providerId, type ProviderOption, type SocialVariant } from "../../social-button/social-button";
import type { ButtonSize } from "../../button";

export { AppleIcon, GitHubIcon, GoogleIcon, MicrosoftIcon, providerId, providerLabel, type CustomProvider, type ProviderOption } from "../../social-button/social-button";

export interface SocialButtonsProps {
  providers: ProviderOption[];
  /** Called with the built-in provider name, or the custom provider object. */
  onSelect: (provider: ProviderOption) => void;
  /** The provider id whose redirect is starting (shows a spinner on it, disables the rest). */
  pending?: string | null;
  disabled?: boolean;
  /** "Continue with" by default. */
  verb?: string;
  /** outline (default), brand or icon; see SocialButton. */
  variant?: SocialVariant;
  size?: ButtonSize;
}

export function SocialButtons({ providers, onSelect, pending = null, disabled, verb = "Continue with", variant = "outline", size }: SocialButtonsProps) {
  if (providers.length === 0) return null;
  const iconOnly = variant === "icon";
  return (
    <div
      className={iconOnly ? "flex flex-wrap gap-2" : "grid gap-2"}
      style={!iconOnly && providers.length > 1 ? { gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))" } : undefined}
    >
      {providers.map((p) => {
        const id = providerId(p);
        return (
          <SocialButton
            key={id}
            provider={p}
            variant={variant}
            verb={verb}
            size={size}
            className={iconOnly ? undefined : "w-full"}
            loading={pending === id}
            disabled={disabled || (pending !== null && pending !== id)}
            onClick={() => onSelect(p)}
          />
        );
      })}
    </div>
  );
}
