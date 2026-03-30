import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAuthUserFromRequest } from "@/lib/auth/session";
import { upsertStripeSubscription } from "@/lib/auth/db";

export async function POST(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let sessionId: string;
  try {
    const body = await req.json() as { sessionId?: string };
    sessionId = String(body.sessionId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId manquant" }, { status: 400 });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify this session belongs to the logged-in user
    if (String(checkoutSession.client_reference_id) !== String(session.user.id)) {
      return NextResponse.json({ error: "Session invalide" }, { status: 403 });
    }

    const customerId = String(checkoutSession.customer ?? "");
    const subscriptionId = String(checkoutSession.subscription ?? "");

    if (!customerId || !subscriptionId) {
      return NextResponse.json({ error: "Données Stripe incomplètes" }, { status: 400 });
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    await upsertStripeSubscription({
      userId: session.user.id,
      customerId,
      subscriptionId,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null,
    });

    return NextResponse.json({ ok: true, status: sub.status });
  } catch (err) {
    console.error("[stripe/fulfill]", err);
    return NextResponse.json({ error: "Erreur Stripe" }, { status: 500 });
  }
}
