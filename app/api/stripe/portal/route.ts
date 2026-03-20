import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAuthUserFromRequest } from "@/lib/auth/session";
import { getStripeCustomerId } from "@/lib/auth/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthUserFromRequest(req);
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const customerId = await getStripeCustomerId(user.id);
    if (!customerId) {
      return NextResponse.json({ error: "Aucun abonnement trouvé" }, { status: 404 });
    }

    const origin = new URL(req.url).origin;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/nba/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return NextResponse.json({ error: "Erreur Stripe" }, { status: 500 });
  }
}
