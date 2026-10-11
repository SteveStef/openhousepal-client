import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { normalizeImageUrl } from '@/lib/utils';
import { BuyerCashNeededPublicResponse, SellerNetSheetPublicResponse } from '@/types';
import { formatMoney } from '@/lib/cma';
import { computeAllScenarios as computeSnsScenarios } from '@/lib/sellerNetSheet';
import { computeAllScenarios as computeBcnScenarios, computeMonthlyPrincipalAndInterest, LOAN_TYPE_LABELS } from '@/lib/buyerCashNeeded';

Font.registerHyphenationCallback(word => [word]);
Font.register({ family: 'Montserrat', fonts: [{ src: '/fonts/montserrat-v31-latin-regular.ttf' }] });
Font.register({ family: 'Playfair Display', fonts: [{ src: '/fonts/playfair-display-v40-latin-regular.ttf' }] });

const COLORS = {
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  line: '#E5E7EB',
  panel: '#F8F7F4',
  white: '#FFFFFF',
  border: '#E7E5E4',
  accent: '#8b7355',
  gold: '#C9A24D',
};

const s = StyleSheet.create({
  page: { padding: 34, paddingBottom: 56, fontFamily: 'Montserrat', fontSize: 9, color: COLORS.text, backgroundColor: COLORS.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2 solid ${COLORS.text}`, paddingBottom: 10 },
  sectionLabel: { fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.gold, marginBottom: 4 },
  h1: { fontSize: 16, fontFamily: 'Playfair Display', fontWeight: 700, marginBottom: 2 },
  h2: { fontSize: 11.5, fontFamily: 'Playfair Display', fontWeight: 700, marginBottom: 6 },
  card: { backgroundColor: COLORS.panel, borderRadius: 8, padding: 10, border: `1 solid ${COLORS.border}` },
  table: { marginTop: 4 },
  tableRow: { flexDirection: 'row', borderBottom: `1 solid ${COLORS.line}`, paddingVertical: 5 },
  tableHeaderRow: { flexDirection: 'row', borderBottom: `2 solid ${COLORS.text}`, paddingBottom: 5, marginBottom: 1 },
  tableCell: { flex: 1, fontSize: 8.5 },
  footer: { position: 'absolute', bottom: 22, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between', borderTop: `1 solid ${COLORS.line}`, paddingTop: 8 },
  footerText: { fontSize: 7, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
});

interface PdfAgent {
  name: string;
  headshot_url?: string | null;
  brokerage?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
}

function PdfFooter({ agent, pageLabel }: { agent: PdfAgent; pageLabel: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{agent.name} {agent.brokerage ? `· ${agent.brokerage}` : ''}</Text>
      <Text style={s.footerText}>{pageLabel}</Text>
    </View>
  );
}

function PdfHeader({ agent, eyebrow, address, cityStateZip, clientName }: {
  agent: PdfAgent; eyebrow: string; address: string; cityStateZip: string; clientName?: string | null;
}) {
  return (
    <View style={s.headerRow}>
      <View style={{ minWidth: 0, flex: 1 }}>
        <Text style={{ fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 2, color: COLORS.gold, marginBottom: 3 }}>{eyebrow}</Text>
        <Text style={s.h1}>{address || 'Property'}</Text>
        <Text style={{ fontSize: 8.5, color: COLORS.subtext }}>{cityStateZip}</Text>
        {clientName && <Text style={{ fontSize: 7.5, color: COLORS.muted, marginTop: 2 }}>Prepared for {clientName}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 8 }}>
        {agent.logo_url && <Image src={normalizeImageUrl(agent.logo_url)} style={{ width: 70, height: 28, objectFit: 'contain' }} />}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 9, fontWeight: 700 }}>{agent.name}</Text>
          <Text style={{ fontSize: 7.5, color: COLORS.muted }}>{agent.brokerage || ''}</Text>
          <Text style={{ fontSize: 7, color: COLORS.muted, marginTop: 2 }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        </View>
      </View>
    </View>
  );
}

function scenarioCardWidth(count: number): string {
  if (count <= 1) return '100%';
  if (count === 2) return '48.5%';
  if (count === 3) return '31.5%';
  return '23.5%';
}

// ============================================================================
// Seller Net Sheet
// ============================================================================

export function SellerNetSheetPdfDocument({ report, agent }: { report: SellerNetSheetPublicResponse; agent: PdfAgent }) {
  const { property } = report;
  const results = computeSnsScenarios(report);
  const cardWidth = scenarioCardWidth(results.length);

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <PdfHeader
          agent={agent}
          eyebrow="Seller Net Sheet"
          address={property.street_address || 'Property'}
          cityStateZip={[property.city, property.state, property.zipcode].filter(Boolean).join(', ')}
          clientName={report.client_name}
        />

        <Text style={[s.sectionLabel, { marginTop: 16 }]}>If You Sell For...</Text>
        <Text style={s.h2}>Estimated Net Proceeds</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {results.map(r => (
            <View key={r.scenario.id} style={[s.card, { width: cardWidth }]}>
              <Text style={{ fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted }}>{r.scenario.label || 'Scenario'}</Text>
              <Text style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{formatMoney(r.scenario.sale_price)}</Text>
              <View style={{ borderTop: `1 solid ${COLORS.border}`, marginTop: 6, paddingTop: 6 }}>
                <Text style={{ fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.gold }}>Est. Net Proceeds</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.accent, marginTop: 2 }}>{formatMoney(r.netProceeds)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[s.sectionLabel, { marginTop: 16 }]}>The Breakdown</Text>
        <Text style={s.h2}>How This Was Calculated</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.tableCell, { flex: 1.4 }]}></Text>
            {results.map(r => <Text key={r.scenario.id} style={[s.tableCell, { fontWeight: 700 }]}>{r.scenario.label}</Text>)}
          </View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Sale Price</Text>{results.map(r => <Text key={r.scenario.id} style={[s.tableCell, { fontWeight: 700 }]}>{formatMoney(r.scenario.sale_price)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Mortgage / Liens</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney(report.mortgage_payoffs.reduce((sum, i) => sum + (i.amount || 0), 0))}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Agent Compensation</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney(r.compensationTotal)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Closing Costs</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney(report.closing_costs.reduce((sum, i) => sum + (i.amount || 0), 0))}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Tax Proration</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney(report.tax_proration.amount || 0)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Repairs / Expenses</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney(report.repairs.reduce((sum, i) => sum + (i.amount || 0), 0))}</Text>)}</View>
          <View style={[s.tableRow, { borderBottom: 'none', borderTop: `2 solid ${COLORS.text}`, marginTop: 2 }]}>
            <Text style={[s.tableCell, { flex: 1.4, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', fontSize: 7.5 }]}>Net Proceeds</Text>
            {results.map(r => <Text key={r.scenario.id} style={[s.tableCell, { fontWeight: 700, fontSize: 11, color: COLORS.accent }]}>{formatMoney(r.netProceeds)}</Text>)}
          </View>
        </View>

        {report.notes && (
          <View style={{ marginTop: 12 }}>
            <Text style={s.sectionLabel}>Notes</Text>
            <Text style={{ fontSize: 8, lineHeight: 1.4 }}>{report.notes}</Text>
          </View>
        )}

        {report.disclaimer && (
          <Text style={{ fontSize: 6.5, color: COLORS.muted, lineHeight: 1.4, marginTop: 12 }}>{report.disclaimer}</Text>
        )}

        <PdfFooter agent={agent} pageLabel="Seller Net Sheet" />
      </Page>
    </Document>
  );
}

// ============================================================================
// Buyer Closing Costs (a.k.a. Buyer Cash Needed)
// ============================================================================

export function BuyerCashNeededPdfDocument({ report, agent }: { report: BuyerCashNeededPublicResponse; agent: PdfAgent }) {
  const { property } = report;
  const results = computeBcnScenarios(report);
  const cardWidth = scenarioCardWidth(results.length);
  const primaryLoanAmount = results[0]?.loanAmount || 0;
  const monthlyPI = report.monthly_context.include ? computeMonthlyPrincipalAndInterest(primaryLoanAmount, report.monthly_context.interest_rate || 0, report.monthly_context.loan_term_years) : 0;
  const monthlyTaxes = (property.annual_taxes || 0) / 12;
  const monthlyHoa = property.hoa_fee || 0;
  const monthlyInsurance = report.monthly_context.homeowners_insurance_monthly || 0;
  const estimatedMonthlyTotal = monthlyPI + monthlyTaxes + monthlyHoa + monthlyInsurance;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <PdfHeader
          agent={agent}
          eyebrow="Buyer Closing Costs"
          address={property.street_address || 'Property'}
          cityStateZip={[property.city, property.state, property.zipcode].filter(Boolean).join(', ')}
          clientName={report.client_name}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
          <View>
            <Text style={s.sectionLabel}>Purchase Price</Text>
            <Text style={s.h1}>{formatMoney(report.purchase_price.amount)}</Text>
          </View>
          <Text style={{ fontSize: 8, color: COLORS.subtext }}>Financing: {LOAN_TYPE_LABELS[report.loan_type] || report.loan_type}</Text>
        </View>

        <Text style={[s.sectionLabel, { marginTop: 10 }]}>How Much Cash Do I Need?</Text>
        <Text style={s.h2}>Cash Needed by Down Payment</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {results.map(r => (
            <View key={r.scenario.id} style={[s.card, { width: cardWidth }]}>
              <Text style={{ fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted }}>{r.scenario.percent}% Down</Text>
              <Text style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2 }}>{formatMoney(r.cashDown)} down · {formatMoney(r.loanAmount)} loan</Text>
              <View style={{ borderTop: `1 solid ${COLORS.border}`, marginTop: 6, paddingTop: 6 }}>
                <Text style={{ fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.gold }}>Cash Needed</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.accent, marginTop: 2 }}>{formatMoney(r.remainingCashNeeded)}</Text>
                <Text style={{ fontSize: 6.5, color: COLORS.muted, marginTop: 2 }}>Total cash investment: {formatMoney(r.totalCashInvestment)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[s.sectionLabel, { marginTop: 14 }]}>The Breakdown</Text>
        <Text style={s.h2}>How This Was Calculated</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.tableCell, { flex: 1.4 }]}></Text>
            {results.map(r => <Text key={r.scenario.id} style={[s.tableCell, { fontWeight: 700 }]}>{r.scenario.percent}% Down</Text>)}
          </View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Down Payment</Text>{results.map(r => <Text key={r.scenario.id} style={[s.tableCell, { fontWeight: 700 }]}>{formatMoney(r.cashDown)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Closing Costs</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>+{formatMoney(r.closingCostsTotal)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Prepaid Expenses</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>+{formatMoney(r.prepaidsTotal)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Inspections</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>+{formatMoney(r.inspectionsTotal)}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Credits</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney((report.credits.seller_credit || 0) + (report.credits.lender_credit || 0))}</Text>)}</View>
          <View style={s.tableRow}><Text style={[s.tableCell, { flex: 1.4, color: COLORS.subtext }]}>Earnest Money Already Paid</Text>{results.map(r => <Text key={r.scenario.id} style={s.tableCell}>−{formatMoney(report.earnest_money.amount || 0)}</Text>)}</View>
          <View style={[s.tableRow, { borderBottom: 'none', borderTop: `2 solid ${COLORS.text}`, marginTop: 2 }]}>
            <Text style={[s.tableCell, { flex: 1.4, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', fontSize: 7.5 }]}>Remaining Cash Needed</Text>
            {results.map(r => <Text key={r.scenario.id} style={[s.tableCell, { fontWeight: 700, fontSize: 11, color: COLORS.accent }]}>{formatMoney(r.remainingCashNeeded)}</Text>)}
          </View>
        </View>

        {report.monthly_context.include && (
          <View style={[s.card, { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <View>
              <Text style={{ fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.gold }}>Estimated Monthly Payment</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Playfair Display', fontWeight: 700, marginTop: 2 }}>{formatMoney(estimatedMonthlyTotal)} / month</Text>
            </View>
            <Text style={{ fontSize: 7.5, color: COLORS.subtext, maxWidth: 260, textAlign: 'right' }}>P&amp;I {formatMoney(monthlyPI)} · Taxes {formatMoney(monthlyTaxes)} · Insurance {formatMoney(monthlyInsurance)} · HOA {formatMoney(monthlyHoa)}</Text>
          </View>
        )}

        {report.notes && (
          <View style={{ marginTop: 10 }}>
            <Text style={s.sectionLabel}>Notes</Text>
            <Text style={{ fontSize: 8, lineHeight: 1.4 }}>{report.notes}</Text>
          </View>
        )}

        {report.disclaimer && (
          <Text style={{ fontSize: 6.5, color: COLORS.muted, lineHeight: 1.4, marginTop: 10 }}>{report.disclaimer}</Text>
        )}

        <PdfFooter agent={agent} pageLabel="Buyer Closing Costs" />
      </Page>
    </Document>
  );
}
