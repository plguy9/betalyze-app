import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { upsertStripeSubscription } from "@/lib/auth/db";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe/webhook] signature invalide", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = Number(session.client_reference_id ?? 0);
        const customerId = String(session.customer ?? "");
        const subscriptionId = String(session.subscription ?? "");
        if (userId && customerId && subscriptionId) {
          await upsertStripeSubscription({
            userId,
            customerId,
            subscriptionId,
            status: "trialing",
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        await upsertStripeSubscription({
          userId: Number(sub.metadata?.userId ?? 0),
          customerId: String(sub.customer),
          subscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
        const subId = invoice.subscription ?? "";
        if (subId) {
          await upsertStripeSubscription({
            userId: 0,
            customerId: String(invoice.customer),
            subscriptionId: subId,
            status: "past_due",
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error", err);
  }

  return NextResponse.json({ received: true });
}
