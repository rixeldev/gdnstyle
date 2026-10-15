import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured")
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    })

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("No authorization header")
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error("Unauthorized")
    }

    const body = await req.json()
    const { action } = body

    // Obtener el stripe_account_id del proveedor
    const { data: providerData, error: providerError } = await supabase
      .from("providers")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single()

    if (providerError || !providerData || !providerData.stripe_account_id) {
      throw new Error("Provider Stripe account not found")
    }

    const stripeAccountId = providerData.stripe_account_id

    // LISTAR CUENTAS BANCARIAS
    if (action === "list") {
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId)

        const bankAccounts = []

        if (account.external_accounts) {
          const externalAccounts = account.external_accounts.data

          for (const extAccount of externalAccounts) {
            if (extAccount.object === "bank_account") {
              bankAccounts.push({
                id: extAccount.id,
                bankName: extAccount.bank_name || "Banco",
                last4: extAccount.last4,
                country: extAccount.country,
                currency: extAccount.currency,
                routingNumber: extAccount.routing_number,
                accountHolderName: extAccount.account_holder_name,
                accountHolderType: extAccount.account_holder_type,
                status: extAccount.status,
                isDefault: extAccount.default_for_currency,
              })
            }
          }
        }

        return new Response(JSON.stringify({ bankAccounts }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      } catch (error) {
        console.error("Error listing accounts:", error)
        return new Response(JSON.stringify({ bankAccounts: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }
    }

    // CREAR ACCOUNT LINK PARA GESTIONAR CUENTAS
    if (action === "create_account_link") {
      const { returnUrl, refreshUrl } = body

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: refreshUrl || `${returnUrl}?refresh=true`,
        return_url: returnUrl,
        type: "account_onboarding",
        collect: "eventually_due",
      })

      return new Response(
        JSON.stringify({
          url: accountLink.url,
          expires_at: accountLink.expires_at,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      )
    }

    // OBTENER ESTADO DE LA CUENTA
    if (action === "get_account_status") {
      const account = await stripe.accounts.retrieve(stripeAccountId)

      return new Response(
        JSON.stringify({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          requirements: {
            currently_due: account.requirements?.currently_due || [],
            eventually_due: account.requirements?.eventually_due || [],
            past_due: account.requirements?.past_due || [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      )
    }

    throw new Error("Invalid action")
  } catch (error) {
    console.error("Error managing bank accounts:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
