"use client";
/** @registry name="settings-billing" type="block" title="Billing settings" description="Current plan with status and renewal, usage meters, payment method, invoices, and cancel or resume with confirmation." */
/**
 * Billing settings: the current plan with its status and renewal, usage meters, the payment method, and
 * invoices. Changing plan, updating the card and opening invoices are links or callbacks into your billing
 * provider (Stripe, Polar, Paddle). Cancel asks for confirmation.
 */
import { useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "../../badge";
import { Button, buttonClass } from "../../button";
import { Dialog } from "../../dialog";
import { Progress } from "../../progress";
import { SettingsSection } from "./settings-layout";
import {
  INVOICE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  cardBrand,
  cardExpired,
  money,
  settleResult,
  shortDate,
  usageRatio,
  type InvoiceStatus,
  type PlanStatus,
  type SettingsResult,
} from "./settings-utils";

export interface BillingPlan {
  name: string;
  /** Cents per interval; 0 for a free plan. */
  amount: number;
  currency?: string;
  interval?: "month" | "year" | "once";
  status: PlanStatus;
  /** Next renewal (active), trial end (trialing) or end of access (canceled). */
  periodEnd?: Date | string | number | null;
  /** The plan will end at periodEnd instead of renewing (cancel at period end). */
  cancelAtPeriodEnd?: boolean;
  /** Seats or other quantity, shown as "× 5 seats". */
  quantity?: { value: number; unit: string };
}

export interface BillingUsage {
  label: string;
  used: number;
  /** null: unlimited. */
  limit: number | null;
  /** Formats the numbers, e.g. (n) => `${n} GB`. */
  format?: (n: number) => string;
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface Invoice {
  id: string;
  number?: string;
  date: Date | string | number;
  amount: number;
  currency?: string;
  status: InvoiceStatus;
  /** PDF or hosted invoice page. */
  href?: string;
}

export interface BillingSettingsProps {
  plan: BillingPlan;
  usage?: BillingUsage[];
  paymentMethod?: PaymentMethod | null;
  invoices?: Invoice[];
  /** A pricing page or your provider's plan picker. */
  changePlanHref?: string;
  onChangePlan?: () => void;
  /** The change-plan button text, e.g. "Upgrade to lifetime". Default "Change plan". */
  changePlanLabel?: string;
  /** Opens your provider's billing portal. Shows a "Manage billing" button that spins until the promise settles. */
  onManageBilling?: () => void | Promise<unknown>;
  manageLabel?: string;
  /** A line under the plan instead of the renewal text, e.g. "Paid once. Updates included." */
  planNote?: ReactNode;
  /** Hide the payment method section (when cards live only in a provider portal). Default true. */
  showPaymentMethod?: boolean;
  /** Under the Invoices title; default "Your last invoices, newest first." */
  invoicesDescription?: ReactNode;
  /** Opens your provider's card form or portal. */
  onUpdatePayment?: () => void;
  /** Cancels at period end. Without it there's no Cancel button. */
  onCancel?: () => Promise<SettingsResult>;
  /** Undoes a pending cancellation. */
  onResume?: () => Promise<SettingsResult>;
  /** For "expires soon" and the like; defaults to now. */
  now?: number;
  locale?: string;
}

const PLAN_TONE: Record<PlanStatus, BadgeTone> = { active: "success", trialing: "info", past_due: "danger", canceled: "neutral" };
const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = { paid: "success", open: "warning", void: "neutral", uncollectible: "danger", refunded: "neutral" };
const PER: Record<NonNullable<BillingPlan["interval"]>, string> = { month: "/ month", year: "/ year", once: "one-time" };

export function BillingSettings({
  plan,
  usage = [],
  paymentMethod,
  invoices = [],
  changePlanHref,
  onChangePlan,
  changePlanLabel = "Change plan",
  onManageBilling,
  manageLabel = "Manage billing",
  planNote,
  showPaymentMethod = true,
  invoicesDescription,
  onUpdatePayment,
  onCancel,
  onResume,
  now = Date.now(),
  locale = "en-US",
}: BillingSettingsProps) {
  const [managing, setManaging] = useState(false);
  const manage = async () => {
    if (!onManageBilling) return;
    setManaging(true);
    try {
      await onManageBilling();
    } finally {
      setManaging(false);
    }
  };
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const currency = plan.currency ?? "usd";
  const ends = shortDate(plan.periodEnd, locale);

  const run = async (fn: () => Promise<SettingsResult>) => {
    setBusy(true);
    const r = await settleResult(fn());
    setBusy(false);
    setResult(r);
    if (r.ok) setConfirm(false);
  };

  let renewal: ReactNode = null;
  if (plan.status === "trialing" && ends) renewal = `Trial ends ${ends}`;
  else if (plan.status === "canceled") renewal = ends ? `Access ended ${ends}` : "Canceled";
  else if (plan.cancelAtPeriodEnd && ends) renewal = `Cancels on ${ends}`;
  else if (plan.status === "past_due") renewal = "The last payment failed. Update your card to keep access.";
  else if (plan.interval !== "once" && ends) renewal = `Renews ${ends}`;

  const changePlan = changePlanHref ? (
    <a href={changePlanHref} className={buttonClass("secondary", "sm")}>
      {changePlanLabel}
    </a>
  ) : onChangePlan ? (
    <Button size="sm" variant="secondary" onClick={onChangePlan}>
      {changePlanLabel}
    </Button>
  ) : null;
  const planActions =
    changePlan || onManageBilling ? (
      <>
        {onManageBilling && (
          <Button size="sm" variant={changePlan ? "ghost" : "secondary"} loading={managing} onClick={() => void manage()}>
            {manageLabel}
          </Button>
        )}
        {changePlan}
      </>
    ) : null;

  return (
    <>
      <SettingsSection
        title="Plan"
        actions={planActions}
        footer={
          (onCancel && plan.status !== "canceled" && !plan.cancelAtPeriodEnd) || (onResume && plan.cancelAtPeriodEnd) || result ? (
            <>
              <span role="status" aria-live="polite" className={result && !result.ok ? "text-red-600 dark:text-red-400" : undefined}>
                {result ? (result.ok ? (result.message ?? "Done.") : result.error) : "You keep access until the end of the period you paid for."}
              </span>
              {onResume && plan.cancelAtPeriodEnd ? (
                <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(onResume)}>
                  Keep my plan
                </Button>
              ) : onCancel && plan.status !== "canceled" ? (
                <Button size="sm" variant="ghost" onClick={() => (setResult(null), setConfirm(true))}>
                  Cancel plan
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-semibold tracking-[-0.01em]">{plan.name}</span>
              {/* An active free plan has no billing state worth a badge. */}
              {!(plan.amount === 0 && plan.status === "active") && (
                <Badge tone={plan.cancelAtPeriodEnd ? "warning" : PLAN_TONE[plan.status]} dot>
                  {plan.cancelAtPeriodEnd && plan.status !== "canceled" ? "Canceling" : PLAN_STATUS_LABEL[plan.status]}
                </Badge>
              )}
            </div>
            {(planNote ?? renewal) && <p className={!planNote && plan.status === "past_due" ? "mt-1 text-[13px] text-red-600 dark:text-red-400" : "mt-1 text-[13px] text-muted-foreground"}>{planNote ?? renewal}</p>}
          </div>
          {/* "Free" once: skip the price when the plan's name already says it. */}
          {!(plan.amount === 0 && /^free$/i.test(plan.name.trim())) && (
          <div className="text-right tabular-nums">
            <span className="text-[22px] font-semibold tracking-[-0.02em]">{plan.amount === 0 ? "Free" : money(plan.amount, currency, locale)}</span>
            {plan.amount > 0 && plan.interval && <span className="ml-1 text-[13px] text-muted-foreground">{PER[plan.interval]}</span>}
            {plan.quantity && <div className="text-[12px] text-muted-foreground">{`× ${plan.quantity.value} ${plan.quantity.unit}`}</div>}
          </div>
          )}
        </div>

        {usage.length > 0 && (
          <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
            {usage.map((u) => {
              const f = u.format ?? ((n: number) => n.toLocaleString(locale));
              const ratio = usageRatio(u.used, u.limit);
              return (
                <div key={u.label} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium">{u.label}</span>
                    <span className="text-muted-foreground tabular-nums">{u.limit === null ? `${f(u.used)} (unlimited)` : `${f(u.used)} of ${f(u.limit)}`}</span>
                  </div>
                  {u.limit !== null && <Progress value={ratio * 100} valueLabel="none" size="sm" tone={ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "neutral"} aria-label={`${u.label} used`} />}
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {showPaymentMethod && (
      <SettingsSection
        title="Payment method"
        actions={
          onUpdatePayment && (
            <Button size="sm" variant="secondary" onClick={onUpdatePayment}>
              {paymentMethod ? "Update" : "Add card"}
            </Button>
          )
        }
      >
        {paymentMethod ? (
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-8 w-12 place-items-center rounded-md border bg-muted text-[10px] font-semibold tracking-wide uppercase">
              {cardBrand(paymentMethod.brand).slice(0, 4)}
            </span>
            <div className="text-[13.5px]">
              <div className="font-medium">{`${cardBrand(paymentMethod.brand)} ending in ${paymentMethod.last4}`}</div>
              <div className={cardExpired(paymentMethod.expMonth, paymentMethod.expYear, now) ? "text-[12.5px] text-red-600 dark:text-red-400" : "text-[12.5px] text-muted-foreground"}>
                {`${cardExpired(paymentMethod.expMonth, paymentMethod.expYear, now) ? "Expired" : "Expires"} ${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">No card on file.</p>
        )}
      </SettingsSection>
      )}

      <SettingsSection title="Invoices" description={invoicesDescription ?? (invoices.length ? "Your last invoices, newest first." : undefined)}>
        {invoices.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="-my-2 divide-y" aria-label="Invoices">
            {invoices.map((inv) => (
              <li key={inv.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <div className="min-w-0">
                  <div className="font-medium">{shortDate(inv.date, locale)}</div>
                  {inv.number && <div className="truncate font-mono text-[11.5px] text-muted-foreground">{inv.number}</div>}
                </div>
                <span className="text-right tabular-nums">{money(inv.amount, inv.currency ?? currency, locale)}</span>
                <span className="col-start-1 sm:col-start-auto">
                  <Badge tone={INVOICE_TONE[inv.status]} size="sm">
                    {INVOICE_STATUS_LABEL[inv.status]}
                  </Badge>
                </span>
                <span className="text-right">
                  {inv.href ? (
                    <a href={inv.href} target="_blank" rel="noreferrer" className="rounded text-[13px] underline-offset-[3px] hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Download invoice ${inv.number ?? shortDate(inv.date, locale)}`}>
                      Download
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      {onCancel && (
        <Dialog
          open={confirm}
          onOpenChange={setConfirm}
          size="sm"
          title={`Cancel ${plan.name}?`}
          description={ends ? `You keep everything until ${ends}. After that the plan won't renew.` : "Your plan won't renew."}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep plan
              </Button>
              <Button variant="destructive" loading={busy} onClick={() => void run(onCancel)}>
                Cancel plan
              </Button>
            </>
          }
        >
          {result && !result.ok && (
            <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
              {result.error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
