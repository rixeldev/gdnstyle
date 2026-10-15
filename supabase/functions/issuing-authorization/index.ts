import Stripe from "https://esm.sh/stripe@14.21.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
})

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  const secret =
    Deno.env.get("STRIPE_ISSUING_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  let event: Stripe.Event
  try {
    if (!secret || !signature) throw new Error("Falta la firma del webhook")
    event = await stripe.webhooks.constructEventAsync(body, signature, secret)
  } catch (error) {
    console.error("Firma de Issuing inválida:", error)
    return new Response(JSON.stringify({ approved: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (event.type !== "issuing_authorization.request") {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  const authorization = event.data.object as Stripe.Issuing.Authorization
  const amount = authorization.pending_request?.amount ?? authorization.amount ?? 0
  const accountId = event.account

  if (!accountId || amount <= 0) {
    return new Response(JSON.stringify({ approved: false }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId })
    const available = (balance.issuing?.available || [])
      .filter((item) => item.currency === (authorization.currency || "usd"))
      .reduce((sum, item) => sum + item.amount, 0)
    const approved = amount <= available
    console.log("Autorización Issuing", { accountId, amount, available, approved })
    return new Response(JSON.stringify({ approved }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("No se pudo leer el saldo Issuing:", error)
    return new Response(JSON.stringify({ approved: false }), {
      headers: { "Content-Type": "application/json" },
    })
  }
})
