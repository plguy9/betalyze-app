import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAuthUserFromRequest } from "@/lib/auth/session";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authSession = await getAuthUserFromRequest(req);
    const user = authSession?.user;
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const origin = new URL(req.url).origin;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      client_reference_id: String(user.id),
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          userId: String(user.id),
        },
      },
      success_url: `${origin}/nba/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/nba/billing?canceled=1`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "Erreur Stripe" }, { status: 500 });
  }
}
