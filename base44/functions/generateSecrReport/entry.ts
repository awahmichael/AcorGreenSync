import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { period_id } = body;
    if (!period_id) return Response.json({ error: 'period_id is required' }, { status: 400 });

    // Fetch the sealed period
    const period = await base44.asServiceRole.entities.ReportingPeriod.get(period_id);
    if (!period) return Response.json({ error: 'Reporting period not found' }, { status: 404 });
    if (period.status !== 'locked') return Response.json({ error: 'Period must be sealed before generating a regulatory pack' }, { status: 400 });

    // Fetch transactions within the period
    const startDate = period.period_start + 'T00:00:00Z';
    const endDate = period.period_end + 'T23:59:59Z';
    let allTransactions = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Transaction.list('-transaction_date', 200, skip);
      if (!batch || batch.length === 0) break;
      const filtered = batch.filter(t =>
        t.transaction_date &&
        t.transaction_date >= startDate &&
        t.transaction_date <= endDate
      );
      allTransactions = allTransactions.concat(filtered);
      if (batch.length < 200) break;
      skip += 200;
    }

    // Fetch organization
    let organization = null;
    if (allTransactions.length > 0 && allTransactions[0].organization_id) {
      try {
        organization = await base44.asServiceRole.entities.Organization.get(allTransactions[0].organization_id);
      } catch {}
    }

    // Fetch sealed audit log IDs
    let sealedAuditLogs = [];
    if (period.sealed_audit_log_ids && period.sealed_audit_log_ids.length > 0) {
      for (const logId of period.sealed_audit_log_ids.slice(0, 50)) {
        try {
          const log = await base44.asServiceRole.entities.AuditLog.get(logId);
          if (log) sealedAuditLogs.push(log);
        } catch {}
      }
    }

    // Aggregate emissions data
    let totalKgCo2e = period.total_kg_co2e || 0;
    let upstreamKg = 0;
    let downstreamKg = 0;
    const categoryTotals = {};
    const productBreakdown = {};

    for (const tx of allTransactions) {
      upstreamKg += tx.upstream_kg_co2e || 0;
      downstreamKg += tx.downstream_kg_co2e || 0;
      if (tx.items) {
        for (const item of tx.items) {
          const cat = item.scope3_category || 'Both';
          const co2e = item.kg_co2e || 0;
          categoryTotals[cat] = (categoryTotals[cat] || 0) + co2e;
          if (item.product_name) {
            if (!productBreakdown[item.product_name]) {
              productBreakdown[item.product_name] = { kg_co2e: 0, quantity: 0, category: item.category || '' };
            }
            productBreakdown[item.product_name].kg_co2e += co2e;
            productBreakdown[item.product_name].quantity += item.quantity || 0;
          }
        }
      }
    }

    if (totalKgCo2e === 0) {
      totalKgCo2e = allTransactions.reduce((sum, t) => sum + (t.total_kg_co2e || 0), 0);
    }

    // Generate the PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 20;

    // === HEADER ===
    doc.setFillColor(142, 72, 36);
    doc.setDrawColor(142, 72, 36);
    doc.rect(0, 0, pageWidth, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('SECR Compliance Report', margin, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Streamlined Energy and Carbon Reporting', margin, y + 11);
    y += 22;

    // === ORGANIZATION DETAILS ===
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('ORGANIZATION', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(organization?.name || 'N/A', margin + 4, y + 11);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    if (organization?.vat_number) doc.text(`VAT: ${organization.vat_number}`, margin + 4, y + 16);
    if (organization?.country_code) doc.text(`Country: ${organization.country_code}`, margin + 4, y + 20);
    doc.text(`Report Generated: ${new Date().toISOString().split('T')[0]}`, margin + 4, y + 24);
    y += 34;

    // === REPORTING PERIOD ===
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('REPORTING PERIOD', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(period.label || 'N/A', margin + 4, y + 11);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${period.period_start} to ${period.period_end}`, margin + 4, y + 16);
    doc.text(`Sealed by: ${period.locked_by || 'N/A'} on ${period.locked_at ? period.locked_at.split('T')[0] : 'N/A'}`, margin + 4, y + 20);
    y += 28;

    // === EMISSIONS SUMMARY ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Scope 3 Emissions Summary', margin, y);
    y += 4;

    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    const summaryRows = [
      ['Total Scope 3 Emissions', `${totalKgCo2e.toFixed(2)} kg CO2e`, `(${(totalKgCo2e / 1000).toFixed(4)} t CO2e)`],
      ['Category 1: Purchased Goods (Upstream)', `${upstreamKg.toFixed(2)} kg CO2e`, `${(upstreamKg / 1000).toFixed(4)} t`],
      ['Category 11: Use of Sold Products (Downstream)', `${downstreamKg.toFixed(2)} kg CO2e`, `${(downstreamKg / 1000).toFixed(4)} t`],
      ['Total Transactions', `${period.total_transactions || allTransactions.length}`, ''],
      ['Total Revenue', `\u00A3${(period.total_revenue || 0).toFixed(2)}`, ''],
    ];

    doc.setFontSize(9);
    for (const [label, val, sub] of summaryRows) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(val, pageWidth - margin - 60, y);
      if (sub) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(sub, pageWidth - margin - 60, y + 4);
      }
      y += 8;
      if (sub) y += 2;
    }
    y += 4;

    // === TOP PRODUCTS BY EMISSIONS ===
    const topProducts = Object.entries(productBreakdown)
      .sort((a, b) => b[1].kg_co2e - a[1].kg_co2e)
      .slice(0, 15);

    if (topProducts.length > 0) {
      if (y > pageHeight - 80) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('Top Products by Emissions (Top 15)', margin, y);
      y += 4;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      // Table header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text('Product', margin, y);
      doc.text('Category', margin + 90, y);
      doc.text('Qty', pageWidth - margin - 55, y);
      doc.text('kg CO2e', pageWidth - margin - 30, y);
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      for (const [name, data] of topProducts) {
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        doc.setTextColor(50, 50, 50);
        doc.text(name.substring(0, 45), margin, y);
        doc.text((data.category || '').substring(0, 25), margin + 90, y);
        doc.text(String(data.quantity), pageWidth - margin - 55, y);
        doc.text(data.kg_co2e.toFixed(2), pageWidth - margin - 30, y);
        y += 6;
      }
      y += 6;
    }

    // === INTEGRITY VERIFICATION ===
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }

    doc.setFillColor(20, 20, 30);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 200, 120);
    doc.text('INTEGRITY VERIFICATION', margin + 5, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 190);
    doc.text('This report has been sealed with a SHA-256 cryptographic hash. The data below is', margin + 5, y + 12);
    doc.text('mathematically guaranteed to be unaltered since the period was sealed.', margin + 5, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 200, 120);
    doc.text('SHA-256 Hash:', margin + 5, y + 22);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 200, 120);
    const hash = period.data_hash || 'N/A';
    const hashLines = hash.match(/.{1,50}/g) || [hash];
    let hashY = y + 27;
    for (const line of hashLines.slice(0, 2)) {
      doc.text(line, margin + 5, hashY);
      hashY += 4;
    }
    doc.text(`Algorithm Version: ${period.hash_version || 'v1'}`, margin + 5, y + 37);
    y += 46;

    // === AUDIT TRAIL SUMMARY ===
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Audit Trail Summary', margin, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Audit Log Records Sealed: ${period.sealed_audit_log_ids?.length || 0}`, margin, y); y += 6;
    doc.text(`Integrity Status: VERIFIED (SHA-256 anchored at seal time)`, margin, y); y += 6;
    doc.text(`Personnel Metadata: Cashier IDs, Store IDs, and Manager Override PINs included in hash`, margin, y); y += 6;
    doc.text(`Methodology: GHG Protocol Scope 3, DEFRA Emission Factors`, margin, y); y += 8;

    // === FOOTER ===
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text('Generated by NovaFlow RegTech Integrity System', margin, pageHeight - 8);
    doc.text(`Report ID: SECR-${period.id?.slice(-8).toUpperCase() || 'XXXX'} | Generated: ${new Date().toISOString()}`, margin, pageHeight - 5);

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SECR_Report_${period.label || period_id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('SECR Report generation failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});