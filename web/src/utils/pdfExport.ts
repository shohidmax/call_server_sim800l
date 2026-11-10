/**
 * PDF Export Utility for SIM800L Calling & SMS Platform
 * Generates enterprise-grade, vector-quality PDF printable reports via native browser print/save-as-PDF dialog.
 */

export interface ReportMeta {
  title: string;
  subtitle?: string;
  dateRange?: { from?: string; to?: string };
  generatedBy?: string;
  summaryMetrics?: { label: string; value: string | number; color?: string }[];
}

export function openPrintPdfWindow(htmlContent: string) {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Please allow popups to generate and download the PDF report.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for styles and DOM to paint before triggering print
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 450);
}

/**
 * Generate PDF Report for Voice Calls & Broadcasts
 */
export function exportCallsPdf(
  meta: ReportMeta,
  jobs: Array<{
    _id: string;
    phone: string;
    targetName?: string;
    status: string;
    mac?: string;
    virtualId?: string;
    isAnonymous?: boolean;
    anonymousId?: string;
    durationSeconds?: number;
    audio?: string | null;
    userName?: string;
    feedbackDetails?: string;
    createdAt?: string;
  }>
) {
  const fromStr = meta.dateRange?.from || 'Start of Records';
  const toStr = meta.dateRange?.to || 'Current Moment';
  const dateStr = new Date().toLocaleString();

  const metricsHtml = (meta.summaryMetrics || [])
    .map(
      m => `
      <div class="kpi-card">
        <div class="kpi-label">${m.label}</div>
        <div class="kpi-value" style="color: ${m.color || '#0284c7'}">${m.value}</div>
      </div>
    `
    )
    .join('');

  const tableRows = jobs
    .map((j, idx) => {
      const dur = j.durationSeconds || 0;
      const m = Math.floor(dur / 60);
      const s = dur % 60;
      const durText = m > 0 ? `${m}m ${s}s` : `${s}s`;
      const routeText = j.isAnonymous ? `[Anon: ${j.anonymousId || 'CLOAK'}]` : (j.virtualId ? `[Virt: ${j.virtualId}]` : (j.mac || 'Auto Pool'));
      
      let badgeClass = 'badge-neutral';
      if (j.status === 'success' || j.status === 'received') badgeClass = 'badge-success';
      else if (j.status === 'rejected') badgeClass = 'badge-danger';
      else if (j.status === 'call_waiting') badgeClass = 'badge-info';
      else if (j.status === 'calling') badgeClass = 'badge-primary';
      else if (j.status === 'queued') badgeClass = 'badge-warning';

      return `
        <tr>
          <td class="text-muted font-mono">${idx + 1}</td>
          <td>
            <div class="font-bold">${j.phone}</div>
            <div class="text-muted text-xs">${j.targetName || '—'}</div>
          </td>
          <td><span class="badge ${badgeClass}">${j.status.toUpperCase()}</span></td>
          <td class="font-mono text-xs">${routeText}</td>
          <td class="font-bold">${durText}</td>
          <td class="font-mono text-xs">${j.audio ? 'Track ' + j.audio : '—'}</td>
          <td class="text-xs text-muted max-w-sm">${(j.feedbackDetails || 'Normal termination').replace(/</g, '&lt;')}</td>
          <td class="font-mono text-xs text-muted whitespace-nowrap">${j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '—'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${meta.title} - PDF Report</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm 10mm 15mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1e293b;
          background: #ffffff;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header h1 {
          font-size: 20px;
          margin: 0 0 4px 0;
          color: #0f172a;
          font-weight: 800;
        }
        .header p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
        }
        .meta-box {
          text-align: right;
          font-size: 10px;
          color: #475569;
        }
        .kpi-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
        }
        .kpi-label {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
        }
        .kpi-value {
          font-size: 16px;
          font-weight: 800;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-align: left;
          padding: 6px 8px;
          font-weight: 700;
          border-bottom: 1.5px solid #cbd5e1;
          font-size: 10px;
          text-transform: uppercase;
        }
        td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: 700; }
        .text-muted { color: #64748b; }
        .text-xs { font-size: 9.5px; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8.5px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #e0f2fe; color: #075985; }
        .badge-primary { background: #ede9fe; color: #5b21b6; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-neutral { background: #f1f5f9; color: #475569; }
        .footer {
          margin-top: 20px;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${meta.title}</h1>
          <p>${meta.subtitle || 'SIM800L ESP32 Cellular Gateway Performance & Forensic Report'}</p>
        </div>
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${fromStr} &rarr; ${toStr}</div>
          <div><strong>Generated:</strong> ${dateStr}</div>
          <div><strong>Auditor:</strong> ${meta.generatedBy || 'Administrator'}</div>
        </div>
      </div>

      ${metricsHtml ? `<div class="kpi-container">${metricsHtml}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Recipient Contact</th>
            <th>Carrier Status</th>
            <th>Route / Channel</th>
            <th>Duration</th>
            <th>Prompt</th>
            <th>Feedback / Carrier Trace</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #94a3b8;">No records found for the selected criteria</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>SIM800L Enterprise Calling Cluster &bull; High-Concurrency Dispatch Platform</div>
        <div>Page 1 of 1 (Vector PDF Generated Successfully)</div>
      </div>
    </body>
    </html>
  `;

  openPrintPdfWindow(html);
}

/**
 * Generate PDF Report for Cellular SMS Messages
 */
export function exportSmsPdf(
  meta: ReportMeta,
  smsList: Array<{
    _id: string;
    sender: string;
    direction: 'in' | 'out';
    mac?: string;
    message: string;
    timestamp?: string;
    receivedAt?: string;
  }>,
  decodeUCS2: (s: string) => string
) {
  const fromStr = meta.dateRange?.from || 'Start of Records';
  const toStr = meta.dateRange?.to || 'Current Moment';
  const dateStr = new Date().toLocaleString();

  const metricsHtml = (meta.summaryMetrics || [])
    .map(
      m => `
      <div class="kpi-card">
        <div class="kpi-label">${m.label}</div>
        <div class="kpi-value" style="color: ${m.color || '#0284c7'}">${m.value}</div>
      </div>
    `
    )
    .join('');

  const tableRows = smsList
    .map((s, idx) => {
      const decoded = decodeUCS2(s.message);
      const isIn = s.direction === 'in';
      const timeVal = s.timestamp || s.receivedAt;
      const formattedDate = timeVal ? new Date(timeVal).toLocaleString() : '—';

      return `
        <tr>
          <td class="text-muted font-mono">${idx + 1}</td>
          <td>
            <span class="badge ${isIn ? 'badge-info' : 'badge-primary'}">${isIn ? 'INBOUND' : 'OUTBOUND'}</span>
          </td>
          <td class="font-mono font-bold">${s.sender}</td>
          <td class="font-mono text-xs text-muted">${s.mac || 'System Line'}</td>
          <td style="line-height: 1.4;">${decoded.replace(/</g, '&lt;')}</td>
          <td class="font-mono text-xs text-muted whitespace-nowrap">${formattedDate}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${meta.title} - PDF Report</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 15mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1e293b;
          background: #ffffff;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #8b5cf6;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header h1 {
          font-size: 20px;
          margin: 0 0 4px 0;
          color: #0f172a;
          font-weight: 800;
        }
        .header p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
        }
        .meta-box {
          text-align: right;
          font-size: 10px;
          color: #475569;
        }
        .kpi-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
        }
        .kpi-label {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
        }
        .kpi-value {
          font-size: 16px;
          font-weight: 800;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-align: left;
          padding: 6px 8px;
          font-weight: 700;
          border-bottom: 1.5px solid #cbd5e1;
          font-size: 10px;
          text-transform: uppercase;
        }
        td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: 700; }
        .text-muted { color: #64748b; }
        .text-xs { font-size: 9.5px; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8.5px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge-info { background: #e0f2fe; color: #075985; }
        .badge-primary { background: #ede9fe; color: #5b21b6; }
        .footer {
          margin-top: 20px;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${meta.title}</h1>
          <p>${meta.subtitle || 'Cellular SMS Transmission & UCS2 Unicode Decoded Audit Trail'}</p>
        </div>
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${fromStr} &rarr; ${toStr}</div>
          <div><strong>Generated:</strong> ${dateStr}</div>
          <div><strong>Auditor:</strong> ${meta.generatedBy || 'Administrator'}</div>
        </div>
      </div>

      ${metricsHtml ? `<div class="kpi-container">${metricsHtml}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th style="width: 90px;">Direction</th>
            <th style="width: 120px;">Contact Number</th>
            <th style="width: 110px;">Transceiver</th>
            <th>Message Content (English / Bengali)</th>
            <th style="width: 120px;">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">No SMS records found</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>SIM800L Enterprise SMS Hub &bull; 2G/GPRS Modular Messaging System</div>
        <div>Confidential Audit Report &bull; Page 1 of 1</div>
      </div>
    </body>
    </html>
  `;

  openPrintPdfWindow(html);
}

/**
 * Generate PDF Report for Inbound Calls
 */
export function exportIncomingPdf(
  meta: ReportMeta,
  calls: Array<{
    id: string;
    callerNumber: string;
    deviceName: string;
    deviceMac: string;
    status: string;
    durationSeconds: number;
    timestamp: string;
    notes?: string;
  }>
) {
  const fromStr = meta.dateRange?.from || 'Start of Records';
  const toStr = meta.dateRange?.to || 'Current Moment';
  const dateStr = new Date().toLocaleString();

  const metricsHtml = (meta.summaryMetrics || [])
    .map(
      m => `
      <div class="kpi-card">
        <div class="kpi-label">${m.label}</div>
        <div class="kpi-value" style="color: ${m.color || '#0284c7'}">${m.value}</div>
      </div>
    `
    )
    .join('');

  const tableRows = calls
    .map((c, idx) => {
      let badgeClass = 'badge-neutral';
      if (c.status === 'answered') badgeClass = 'badge-success';
      else if (c.status === 'missed') badgeClass = 'badge-danger';
      else if (c.status === 'rejected') badgeClass = 'badge-neutral';
      else if (c.status === 'forwarded') badgeClass = 'badge-info';

      return `
        <tr>
          <td class="text-muted font-mono">${idx + 1}</td>
          <td class="font-mono font-bold">${c.callerNumber}</td>
          <td><span class="badge ${badgeClass}">${c.status.toUpperCase()}</span></td>
          <td>
            <div class="font-bold">${c.deviceName}</div>
            <div class="font-mono text-muted text-xs">${c.deviceMac}</div>
          </td>
          <td class="font-bold">${c.durationSeconds > 0 ? c.durationSeconds + 's' : '—'}</td>
          <td class="font-mono text-xs text-muted whitespace-nowrap">${new Date(c.timestamp).toLocaleString()}</td>
          <td class="text-xs text-muted">${c.notes || '—'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${meta.title} - PDF Report</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 15mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1e293b;
          background: #ffffff;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header h1 {
          font-size: 20px;
          margin: 0 0 4px 0;
          color: #0f172a;
          font-weight: 800;
        }
        .header p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
        }
        .meta-box {
          text-align: right;
          font-size: 10px;
          color: #475569;
        }
        .kpi-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
        }
        .kpi-label {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
        }
        .kpi-value {
          font-size: 16px;
          font-weight: 800;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-align: left;
          padding: 6px 8px;
          font-weight: 700;
          border-bottom: 1.5px solid #cbd5e1;
          font-size: 10px;
          text-transform: uppercase;
        }
        td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: 700; }
        .text-muted { color: #64748b; }
        .text-xs { font-size: 9.5px; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8.5px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #e0f2fe; color: #075985; }
        .badge-neutral { background: #f1f5f9; color: #475569; }
        .footer {
          margin-top: 20px;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${meta.title}</h1>
          <p>${meta.subtitle || 'Inbound Received Cellular Calls & Gateway Reception Log'}</p>
        </div>
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${fromStr} &rarr; ${toStr}</div>
          <div><strong>Generated:</strong> ${dateStr}</div>
          <div><strong>Auditor:</strong> ${meta.generatedBy || 'Administrator'}</div>
        </div>
      </div>

      ${metricsHtml ? `<div class="kpi-container">${metricsHtml}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Caller Phone Number</th>
            <th>Call Status</th>
            <th>Receiving Gateway Node</th>
            <th>Talk Time</th>
            <th>Timestamp</th>
            <th>Notes & Context</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">No incoming calls found</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>SIM800L Cellular Reception Center &bull; Inbound Voice Log</div>
        <div>Page 1 of 1</div>
      </div>
    </body>
    </html>
  `;

  openPrintPdfWindow(html);
}
