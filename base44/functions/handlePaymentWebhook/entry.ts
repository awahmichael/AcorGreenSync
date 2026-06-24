import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================
// AcorCloud Unified Webhook Reconciliation Endpoint
// Receives payment events from all 5 gateways.
// URL format: /handlePaymentWebhook?provider=Squad
// ============================================================

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    if (!provider) {
      return Response.json({ error: 'Missing ?provider= query parameter' }, { status: 400 });
    }

    const rawBody = await req.text();
    const base44 = createClientFromRequest(req);

    let transaction_ref = null;
    let gateway_transaction_id = null;
    let payment_status = null;
    let raw_amount = null;

    // --- Parse per-provider webhook payloads ---
    if (provider === 'Stripe') {
      // TODO: verify Stripe-Signature header using webhook_secret
      const event = JSON.parse(rawBody);
      if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
        const pi = event.data?.object;
        transaction_ref = pi?.metadata?.transaction_ref;
        gateway_transaction_id = pi?.id;
        payment_status = event.type === 'payment_intent.succeeded' ? 'completed' : 'failed';
        raw_amount = pi?.amount ? pi.amount / 100 : null;
      }
    } else if (provider === 'Squad') {
      const data = JSON.parse(rawBody);
      if (data.event === 'transaction.completed' || data.event === 'transaction.failed') {
        transaction_ref = data.data?.reference;
        gateway_transaction_id = data.data?.transaction_id;
        payment_status = data.event === 'transaction.completed' ? 'completed' : 'failed';
        raw_amount = data.data?.amount ? data.data.amount / 100 : null;
      }
    } else if (provider === 'SumUp') {
      const data = JSON.parse(rawBody);
      transaction_ref = data.reference || data.client_ref;
      gateway_transaction_id = data.id || data.transaction_id;
      payment_status = data.status === 'SUCCESSFUL' ? 'completed'
        : (data.status === 'FAILED' ? 'failed' : 'pending_terminal');
      raw_amount = data.amount;
    } else if (provider === 'Adyen') {
      const data = JSON.parse(rawBody);
      const item = data.notificationItems?.[0]?.NotificationRequestItem;
      if (item) {
        transaction_ref = item.merchantReference;
        gateway_transaction_id = item.pspReference;
        payment_status = item.eventCode === 'AUTHORISATION' && item.success === 'true' ? 'completed' : 'failed';
        raw_amount = item.amount?.value ? item.amount.value / 100 : null;
      }
    } else if (provider === 'MoniePoint') {
      const data = JSON.parse(rawBody);
      transaction_ref = data.reference || data.data?.reference;
      gateway_transaction_id = data.transaction_id || data.data?.transaction_id;
      payment_status = (data.status === 'success' || data.data?.status === 'success') ? 'completed' : 'failed';
      raw_amount = data.amount ? data.amount / 100 : null;
    } else {
      return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    if (!transaction_ref && !gateway_transaction_id) {
      return Response.json({ error: 'Could not identify transaction from webhook payload' }, { status: 400 });
    }

    // --- Find the matching transaction ---
    let txns = null;
    if (transaction_ref) {
      txns = await base44.asServiceRole.entities.Transaction.filter({ transaction_ref });
    }
    if ((!txns || txns.length === 0) && gateway_transaction_id) {
      txns = await base44.asServiceRole.entities.Transaction.filter({ gateway_transaction_id });
    }
    if (!txns || txns.length === 0) {
      return Response.json({ error: 'Transaction not found', transaction_ref, gateway_transaction_id }, { status: 404 });
    }

    const txn = txns[0];

    // --- Reconcile: update transaction with final payment status ---
    await base44.asServiceRole.entities.Transaction.update(txn.id, {
      payment_status: payment_status,
      gateway_transaction_id: gateway_transaction_id || txn.gateway_transaction_id
    });

    // --- Restore terminal to idle ---
    if (txn.terminal_id) {
      const terminals = await base44.asServiceRole.entities.PaymentTerminal.filter({ terminal_id: txn.terminal_id });
      if (terminals?.[0]) {
        await base44.asServiceRole.entities.PaymentTerminal.update(terminals[0].id, {
          status: 'online',
          last_heartbeat: new Date().toISOString()
        });
      }
    }

    return Response.json({
      success: true,
      transaction_ref: txn.transaction_ref,
      payment_status,
      provider
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});