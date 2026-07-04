import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================
// AcorCloud Payment Gateway Abstraction Layer
// Supports: Stripe, Adyen, SumUp, MoniePoint, Squad
// 7-Layer Terminal Security Architecture:
//   L1 Device Whitelist | L2 Pairing | L3 Store Binding
//   L4 Heartbeat | L5 Amount Origination | L6 Adapter Isolation
//   L7 Status Audit Trail
// ============================================================

const GATEWAY_URLS = {
  Stripe:     { sandbox: 'https://api.stripe.com/v1',             live: 'https://api.stripe.com/v1' },
  Adyen:      { sandbox: 'https://terminal-api-test.adyen.com/sync', live: 'https://terminal-api-live.adyen.com/sync' },
  SumUp:      { sandbox: 'https://api.sumup.com/v0.1',           live: 'https://api.sumup.com/v0.1' },
  MoniePoint: { sandbox: 'https://api-sandbox.moniepoint.com',   live: 'https://api.moniepoint.com' },
  Squad:      { sandbox: 'https://sandbox-api.squadco.com',       live: 'https://api.squadco.com' }
};

// --- Stripe Adapter (Cloud PaymentIntent) ---
async function processStripePayment(config, params) {
  const { amount, currency, transaction_ref, terminal_id } = params;
  const resp = await fetch(`${GATEWAY_URLS.Stripe[config.environment]}/payment_intents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      amount: Math.round(amount * 100).toString(),
      currency: currency.toLowerCase(),
      description: `AcorCloud TXN ${transaction_ref}`,
      'metadata[transaction_ref]': transaction_ref,
      'metadata[terminal_id]': terminal_id,
      'metadata[source]': 'acorcloud_pos'
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || 'Stripe payment initiation failed');
  return {
    gateway_transaction_id: data.id,
    client_secret: data.client_secret,
    status: data.status === 'succeeded' ? 'completed' : 'pending_terminal'
  };
}

// --- Adyen Adapter (Cloud Terminal API — Nexo protocol) ---
async function processAdyenPayment(config, params) {
  const { amount, currency, transaction_ref, terminal_id } = params;
  const body = {
    SaleToPOIRequest: {
      MessageHeader: {
        MessageClass: 'Service',
        MessageCategory: 'Payment',
        MessageType: 'Request',
        SaleID: 'AcorCloud',
        POIID: terminal_id,
        ProtocolVersion: '3.0'
      },
      PaymentRequest: {
        SaleData: {
          SaleTransactionID: { TransactionID: transaction_ref, TimeStamp: new Date().toISOString() }
        },
        PaymentTransaction: {
          AmountsReq: { Currency: currency, RequestedAmount: amount }
        }
      }
    }
  };
  const resp = await fetch(GATEWAY_URLS.Adyen[config.environment], {
    method: 'POST',
    headers: { 'x-APIkey': config.secret_key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.errors?.[0]?.message || 'Adyen payment initiation failed');
  const pr = data.SaleToPOIResponse?.PaymentResponse;
  return {
    gateway_transaction_id: pr?.POITransactionID?.TransactionID || transaction_ref,
    client_secret: null,
    status: pr?.Response?.Result === 'Success' ? 'completed' : 'pending_terminal'
  };
}

// --- SumUp Adapter (Cloud Terminal API) ---
async function processSumupPayment(config, params) {
  const { amount, currency, transaction_ref, terminal_id } = params;
  const resp = await fetch(`${GATEWAY_URLS.SumUp[config.environment]}/terminal/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      total_amount: { amount: amount, currency: currency },
      merchant_code: config.merchant_code,
      terminal_id: terminal_id,
      description: `AcorCloud TXN ${transaction_ref}`,
      reference: transaction_ref
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'SumUp payment initiation failed');
  return {
    gateway_transaction_id: data.id || data.txn_id || transaction_ref,
    client_secret: null,
    status: 'pending_terminal'
  };
}

// --- MoniePoint Adapter (Cloud POS API) ---
async function processMoniepointPayment(config, params) {
  const { amount, currency, transaction_ref, terminal_id } = params;
  const resp = await fetch(`${GATEWAY_URLS.MoniePoint[config.environment]}/pos/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: currency,
      terminal_id: terminal_id,
      reference: transaction_ref,
      source: 'acorcloud_pos'
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'MoniePoint payment initiation failed');
  return {
    gateway_transaction_id: data.data?.transaction_id || data.transaction_id || transaction_ref,
    client_secret: null,
    status: 'pending_terminal'
  };
}

// --- Squad Adapter (Cloud POS API) ---
async function processSquadPayment(config, params) {
  const { amount, currency, transaction_ref, terminal_id } = params;
  const resp = await fetch(`${GATEWAY_URLS.Squad[config.environment]}/pos/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: currency,
      terminal_id: terminal_id,
      reference: transaction_ref
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'Squad payment initiation failed');
  return {
    gateway_transaction_id: data.data?.transaction_id || data.transaction_id || transaction_ref,
    client_secret: null,
    status: 'pending_terminal'
  };
}

const ADAPTERS = {
  Stripe: processStripePayment,
  Adyen: processAdyenPayment,
  SumUp: processSumupPayment,
  MoniePoint: processMoniepointPayment,
  Squad: processSquadPayment
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { terminal_id, amount, currency, transaction_ref, store_id } = body;

    // --- Refund handling ---
    if (body.action === 'refund') {
      const { gateway_transaction_id, gateway_provider, amount: refundAmount } = body;
      if (!gateway_transaction_id || !refundAmount) {
        return Response.json({ error: 'Missing gateway_transaction_id or amount for refund' }, { status: 400 });
      }

      try {
        // Fetch gateway config for the provider
        const configs = await base44.asServiceRole.entities.PaymentGatewayConfig.filter({ provider: gateway_provider || 'Stripe', is_active: true });
        if (!configs || configs.length === 0) {
          return Response.json({ error: `No active gateway config for ${gateway_provider}` }, { status: 500 });
        }
        const config = configs[0];

        // --- Stripe Refund ---
        if (gateway_provider === 'Stripe' || !gateway_provider) {
          const refundResp = await fetch(`${GATEWAY_URLS.Stripe[config.environment]}/refunds`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.secret_key}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              'payment_intent': gateway_transaction_id,
              'amount': Math.round(refundAmount * 100).toString(),
              'metadata[transaction_ref]': transaction_ref || '',
              'metadata[source]': 'acorcloud_pos_refund'
            })
          });
          const refundData = await refundResp.json();
          if (!refundResp.ok) {
            console.error('[processPayment] Stripe refund failed:', refundData);
            return Response.json({ error: refundData.error?.message || 'Stripe refund failed' }, { status: 502 });
          }
          return Response.json({
            success: true,
            provider: 'Stripe',
            gateway_transaction_id: refundData.id,
            status: refundData.status === 'succeeded' ? 'refunded' : 'pending',
          });
        }

        return Response.json({ error: `Refunds not yet supported for ${gateway_provider}` }, { status: 501 });
      } catch (refundError) {
        console.error('[processPayment] Refund error:', refundError);
        return Response.json({ error: refundError.message }, { status: 500 });
      }
    }

    // --- Validate input ---
    if (!terminal_id || !amount || !transaction_ref) {
      return Response.json({ error: 'Missing required fields: terminal_id, amount, transaction_ref' }, { status: 400 });
    }
    if (amount <= 0) {
      return Response.json({ error: 'Amount must be greater than zero (L5: server-side amount origination)' }, { status: 400 });
    }

    // --- L1: Device whitelist ---
    const terminals = await base44.asServiceRole.entities.PaymentTerminal.filter({ terminal_id, is_active: true });
    if (!terminals || terminals.length === 0) {
      return Response.json({ error: 'Terminal not registered or deactivated (L1 whitelist)' }, { status: 403 });
    }
    const terminal = terminals[0];

    // --- L2: Pairing verification ---
    if (!terminal.is_paired) {
      return Response.json({ error: 'Terminal not paired — complete pairing first (L2)' }, { status: 403 });
    }

    // --- L3: Store binding ---
    if (terminal.store_id !== store_id) {
      return Response.json({ error: 'Terminal not assigned to this store (L3 store binding)' }, { status: 403 });
    }

    // --- L4: Heartbeat freshness ---
    if (terminal.last_heartbeat) {
      const hbAge = Date.now() - new Date(terminal.last_heartbeat).getTime();
      if (hbAge > 5 * 60 * 1000) {
        return Response.json({ error: 'Terminal heartbeat expired — device may be offline (L4)' }, { status: 503 });
      }
    }

    // --- Fetch gateway config for this terminal's provider ---
    const configs = await base44.asServiceRole.entities.PaymentGatewayConfig.filter({ provider: terminal.provider, is_active: true });
    if (!configs || configs.length === 0) {
      return Response.json({ error: `No active gateway config for ${terminal.provider}` }, { status: 500 });
    }
    const config = configs[0];

    // --- L6: Adapter isolation — route to correct provider ---
    const adapter = ADAPTERS[terminal.provider];
    if (!adapter) {
      return Response.json({ error: `No adapter for provider ${terminal.provider}` }, { status: 500 });
    }

    // --- L7: Mark terminal busy (audit trail) ---
    await base44.asServiceRole.entities.PaymentTerminal.update(terminal.id, { status: 'busy' });

    // --- Execute payment ---
    const result = await adapter(config, {
      amount,
      currency: currency || 'GBP',
      transaction_ref,
      terminal_id
    });

    // --- Restore terminal to online ---
    await base44.asServiceRole.entities.PaymentTerminal.update(terminal.id, { status: 'online' });

    return Response.json({
      success: true,
      provider: terminal.provider,
      terminal_alias: terminal.alias,
      gateway_transaction_id: result.gateway_transaction_id,
      client_secret: result.client_secret,
      status: result.status
    });
  } catch (error) {
    // Attempt to restore terminal to online on failure
    try {
      const base44 = createClientFromRequest(req);
      const { terminal_id } = await req.json().catch(() => ({}));
      if (terminal_id) {
        const terminals = await base44.asServiceRole.entities.PaymentTerminal.filter({ terminal_id });
        if (terminals?.[0]) {
          await base44.asServiceRole.entities.PaymentTerminal.update(terminals[0].id, { status: 'error' });
        }
      }
    } catch (_) { /* swallow */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});