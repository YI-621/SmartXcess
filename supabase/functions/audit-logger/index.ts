import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // 1. CORS Headers (Allows your React app to connect)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Catch the data sent from your React app
    const { userEmail, action, documentName } = await req.json()

    // 3. Get and normalize secrets
    const rawElasticUrl = (Deno.env.get('ELASTIC_URL') ?? '').trim();
    const rawElasticApiKey = (Deno.env.get('ELASTIC_API_KEY') ?? '').trim();

    if (!rawElasticUrl || !rawElasticApiKey) {
      throw new Error("Missing Elastic Cloud configuration!");
    }

    // Accept accidental pasted labels/text by taking the first URL-like token
    const elasticUrl = rawElasticUrl.split(/\s+/)[0].replace(/\/+$/, '');
    const elasticApiKey = rawElasticApiKey.split(/\s+/).filter(Boolean).slice(-1)[0];

    let validatedUrl: URL;
    try {
      validatedUrl = new URL(elasticUrl);
    } catch {
      throw new Error("ELASTIC_URL is not a valid URL. Please store only the base URL.");
    }

    if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
      throw new Error("ELASTIC_URL must start with http:// or https://");
    }

    // 4. Format the audit log
    const auditEvent = {
      "@timestamp": new Date().toISOString(),
      user_email: userEmail,
      action: action,
      documentName: documentName,
      system: "SmartXcess"
    }

    // 5. Send DIRECTLY to Elastic Cloud (to an index named 'exam-audit-logs')
    const response = await fetch(`${validatedUrl.origin}/exam-audit-logs/_doc`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${elasticApiKey}` 
      },
      body: JSON.stringify(auditEvent)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Elasticsearch rejected the log: ${errorBody}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Log securely saved in Elastic Cloud!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})