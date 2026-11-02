import React from 'react';
import { Document, Page, Text, View, Image, Link, StyleSheet, Font } from '@react-pdf/renderer';
import { normalizeImageUrl } from '@/lib/utils';
import type { BlogBlock } from '@/types';

// A blog article as a plain, readable PDF - for Admin -> Tools -> Grading (owner, 11/01): the admin
// saves any agent's article and sends it to an outside grader. Everything a reader sees is here in
// reading order, cards included (payment example, town spotlight, sources), and every link's
// address is printed next to it so the grader can check it on paper. Not a design export.

Font.registerHyphenationCallback(word => [word]);
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: '/fonts/montserrat-v31-latin-regular.ttf', fontWeight: 400 },
    { src: '/fonts/montserrat-v31-latin-700.woff', fontWeight: 700 },
  ],
});
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: '/fonts/playfair-display-v40-latin-regular.ttf', fontWeight: 400 },
    { src: '/fonts/playfair-display-v40-latin-700.woff', fontWeight: 700 },
  ],
});

const C = { text: '#111827', body: '#1f2937', sub: '#6B7280', muted: '#9CA3AF', line: '#E5E7EB', panel: '#F8F7F4', border: '#E7E5E4', gold: '#C9A24D', link: '#1d4ed8' };

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 46, paddingBottom: 60, fontFamily: 'Montserrat', fontSize: 10, color: C.body, lineHeight: 1.55 },
  kicker: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: C.gold },
  title: { fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 22, color: C.text, lineHeight: 1.2, marginTop: 6 },
  subtitle: { fontSize: 11, color: C.sub, marginTop: 6 },
  meta: { fontSize: 8, color: C.sub, marginTop: 10, paddingBottom: 12, borderBottom: `1 solid ${C.line}` },
  cover: { width: '100%', height: 220, objectFit: 'cover', borderRadius: 6, marginTop: 14 },
  h2: { fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 15, color: C.text, marginTop: 14, marginBottom: 4, lineHeight: 1.25 },
  h3: { fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 12, color: C.text, marginTop: 10, marginBottom: 3 },
  p: { marginBottom: 8 },
  bold: { fontWeight: 700, color: C.text },
  url: { fontSize: 7.5, color: C.muted },
  linkText: { color: C.link, textDecoration: 'underline' },
  li: { flexDirection: 'row', marginBottom: 4 },
  liMark: { width: 16, color: C.gold, fontWeight: 700 },
  liText: { flex: 1 },
  quote: { borderLeft: `3 solid ${C.gold}`, paddingLeft: 10, marginVertical: 6, fontFamily: 'Playfair Display', fontSize: 12, color: C.text },
  callout: { backgroundColor: '#FBF6EC', border: `1 solid #EADBB8`, borderRadius: 6, padding: 10, marginVertical: 6 },
  card: { backgroundColor: C.panel, border: `1 solid ${C.border}`, borderRadius: 6, padding: 10, marginVertical: 8 },
  cardLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.gold, marginBottom: 4 },
  tag: { fontSize: 8, color: C.sub, marginVertical: 4 },
  divider: { borderBottom: `1 solid ${C.line}`, marginVertical: 10 },
  small: { fontSize: 7.5, color: C.sub, lineHeight: 1.45 },
  row: { flexDirection: 'row', borderBottom: `1 solid ${C.line}`, paddingVertical: 3 },
  cellLabel: { flex: 1.6, fontSize: 8.5, color: C.sub },
  cell: { flex: 1, fontSize: 8.5, textAlign: 'right' },
  image: { width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 6, marginVertical: 6 },
  caption: { fontSize: 7.5, color: C.sub, textAlign: 'center', marginBottom: 6 },
  footer: { position: 'absolute', bottom: 24, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between', borderTop: `1 solid ${C.line}`, paddingTop: 7 },
  footerText: { fontSize: 7, color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
});

export interface BlogPdfData {
  title: string;
  subtitle?: string | null;
  category?: string | null;
  status?: string | null;
  cover_image_url?: string | null;
  blocks: BlogBlock[];
  created_at?: string | null;
  agent: { name: string; brokerage?: string | null; email?: string | null };
}

// Same-origin image proxy, like every other PDF here (lib/pdfs.tsx pdfImageUrl).
function pdfImg(url?: string | null): string {
  const n = normalizeImageUrl(url || undefined);
  if (!n || n.startsWith('data:') || typeof window === 'undefined') return n;
  return `${window.location.origin}/api/pdf-image?url=${encodeURIComponent(n)}`;
}

const usd = (n?: number | null) => (n == null ? '-' : `$${Math.round(n).toLocaleString('en-US')}`);
const day = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type Run = { text: string; bold?: boolean; href?: string };

/** The block's rich text (sanitized HTML or plain text) as runs: bold kept, links kept with their address. */
function runsOf(data: { html?: string; text?: string }): Run[] {
  if (!data?.html) return data?.text ? [{ text: data.text }] : [];
  if (typeof DOMParser === 'undefined') return [{ text: data.html.replace(/<[^>]+>/g, '') }];
  const doc = new DOMParser().parseFromString(`<div>${data.html}</div>`, 'text/html');
  const out: Run[] = [];
  const walk = (node: Node, bold: boolean, href?: string) => {
    if (node.nodeType === 3) { if (node.textContent) out.push({ text: node.textContent, bold, href }); return }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') { out.push({ text: '\n' }); return }
    const b = bold || tag === 'strong' || tag === 'b';
    const h = tag === 'a' ? (el.getAttribute('href') || undefined) : href;
    el.childNodes.forEach(c => walk(c, b, h));
    if (tag === 'a' && h) out.push({ text: ` (${h})`, href: '__url' });
  };
  doc.body.firstChild?.childNodes.forEach(c => walk(c, false));
  return out;
}

function Rich({ data, style }: { data: any; style?: any }) {
  const runs = runsOf(data || {});
  if (!runs.length) return null;
  return (
    <Text style={style}>
      {runs.map((r, i) => r.href === '__url'
        ? <Text key={i} style={s.url}>{r.text}</Text>
        : r.href
          ? <Link key={i} src={r.href} style={[s.linkText, r.bold ? s.bold : {}]}>{r.text}</Link>
          : <Text key={i} style={r.bold ? s.bold : undefined}>{r.text}</Text>)}
    </Text>
  );
}

const plain = (v: any) => (typeof v === 'string' ? v.replace(/<[^>]+>/g, '') : v?.text || v?.name || '');

function Tag({ children }: { children: React.ReactNode }) {
  return <Text style={s.tag}>{children}</Text>;
}

function PaymentCard({ d }: { d: any }) {
  const sc: any[] = d?.scenarios || [];
  if (!d?.price || !sc.length) return null;
  const hasTax = sc.some(x => x.tax);
  const rows: [string, (x: any) => string, boolean?][] = [
    ['Down payment', x => usd(x.down)],
    ['Loan amount', x => usd(x.loan) + (x.jumbo ? ' *' : '')],
    ['Principal & interest', x => `${usd(x.principal_interest)}/mo`],
    ...(hasTax ? [['Property tax (est.)', (x: any) => `${usd(x.tax)}/mo`] as [string, (x: any) => string]] : []),
    ['Mortgage insurance', x => (x.mortgage_insurance === 'none' ? 'None' : 'Lender quote')],
    [hasTax ? 'Principal, interest & tax' : 'Principal & interest only', x => `${usd(x.monthly_before_insurance)}/mo`, true],
  ];
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardLabel}>Payment example card · What it could cost</Text>
      <Text style={[s.h3, { marginTop: 0 }]}>{usd(d.price)}</Text>
      {d.price_basis ? <Text style={s.small}>{d.price_basis}</Text> : null}
      <Text style={[s.small, { marginTop: 3 }]}>{d.term_years || 30}-year fixed at {Number(d.rate).toFixed(2)}% · Freddie Mac average{d.rate_as_of ? `, week of ${day(d.rate_as_of)}` : ''}</Text>
      <Text style={[s.small, { marginTop: 3, color: C.text }]}>{hasTax ? 'Estimated principal, interest and property tax.' : 'Estimated principal and interest.'} Not included: homeowners insurance, mortgage insurance and any condo or HOA fee.</Text>
      <View style={[s.row, { marginTop: 6 }]}>
        <Text style={s.cellLabel} />
        {sc.map(x => <Text key={x.down_pct} style={[s.cell, s.bold]}>{x.down_pct}% down</Text>)}
      </View>
      {rows.map(([label, get, strong]) => (
        <View key={label} style={s.row}>
          <Text style={[s.cellLabel, strong ? s.bold : {}]}>{label}</Text>
          {sc.map(x => <Text key={x.down_pct} style={[s.cell, strong ? s.bold : {}]}>{get(x)}</Text>)}
        </View>
      ))}
      <Text style={[s.small, { marginTop: 6 }]}>Cash to bring to settlement: your down payment plus closing costs of about {usd(d.closing_low)} - {usd(d.closing_high)} (the CFPB&apos;s typical range of 2-5% of the price).{d.closing_note ? ` ${d.closing_note}` : ''}</Text>
      <Text style={[s.small, { marginTop: 4 }]}>Property tax {d.tax_basis ? `uses the ${d.tax_basis}` : 'varies by assessment'}.{sc.some(x => x.jumbo) ? ' * Above the 2026 conforming loan limit - a jumbo loan; ask a lender for a jumbo quote.' : ''}</Text>
    </View>
  );
}

function AreaCardPdf({ a }: { a: any }) {
  if (!a?.name) return null;
  const n = a.nearby || {};
  const near: [string, string[] | undefined][] = [
    ['Downtown', n.downtown], ['Parks', n.parks], ['Shopping & dining', n.restaurants_shopping], ['Getting around', n.transportation], ['Standouts', n.standout], ['Market', n.market],
  ];
  const districts = (a.school_districts || []).map(plain).filter(Boolean);
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardLabel}>Town spotlight card{a.as_of ? ` · as of ${day(a.as_of)}` : ''}</Text>
      <Text style={[s.h3, { marginTop: 0 }]}>{a.name}{a.state ? `, ${a.state}` : ''}{a.county ? ` · ${a.county}` : ''}</Text>
      {a.summary ? <Text style={s.small}>{a.summary}</Text> : null}
      <Text style={[s.small, { marginTop: 3, color: C.text }]}>
        {[a.active_count != null ? `${a.active_count} homes for sale` : '', a.median_price ? `median list ${usd(a.median_price)}` : '', a.under_contract_count ? `${a.under_contract_count} under contract` : '', (a.min_price || a.max_price) ? `price range ${usd(a.min_price)} - ${usd(a.max_price)}${a.price_range_basis === 'sold_2y' ? ' (middle 90% sold, last 2 years)' : ''}` : ''].filter(Boolean).join(' · ')}
      </Text>
      {districts.length ? <Text style={[s.small, { marginTop: 3 }]}>School districts: {districts.join(', ')}</Text> : null}
      {near.filter(([, v]) => v?.length).map(([k, v]) => <Text key={k} style={[s.small, { marginTop: 2 }]}>{k}: {(v || []).map(plain).join(', ')}</Text>)}
    </View>
  );
}

function SourcesPdf({ d }: { d: any }) {
  const items = (d?.items || []).filter((x: any) => x?.url);
  const notes: string[] = d?.notes || [];
  if (!items.length && !notes.length && !d?.mls) return null;
  return (
    <View style={[s.card, { backgroundColor: '#FFFFFF' }]}>
      <Text style={s.cardLabel}>Sources & data notes</Text>
      {items.map((x: any, i: number) => (
        <View key={i} style={s.li} wrap={false}>
          <Text style={[s.liMark, { color: C.muted }]}>{i + 1}.</Text>
          <Text style={[s.liText, { fontSize: 8.5 }]}>
            <Link src={x.url} style={s.linkText}>{x.name}</Link>{x.as_of ? ` (${x.as_of})` : ''}{'\n'}<Text style={s.url}>{x.url}</Text>
          </Text>
        </View>
      ))}
      {d.mls ? <Text style={[s.small, { marginTop: 4 }]}>{d.mls}</Text> : null}
      {notes.map((t, i) => <Text key={i} style={[s.small, { marginTop: 2 }]}>{plain(t)}</Text>)}
    </View>
  );
}

function BlockPdf({ block, agent }: { block: BlogBlock; agent: BlogPdfData['agent'] }) {
  const d: any = block.data || {};
  switch (block.type) {
    case 'heading': return <Rich data={d} style={s.h2} />;
    case 'subheading': return <Rich data={d} style={s.h3} />;
    case 'paragraph': return <Rich data={d} style={s.p} />;
    case 'quote': return <View style={s.quote}><Rich data={d} /></View>;
    case 'callout': return <View style={s.callout}><Rich data={d} style={s.bold} /></View>;
    case 'bulleted_list':
    case 'numbered_list':
      return (
        <View style={{ marginBottom: 8 }}>
          {(d.items || []).filter((x: string) => plain(x)?.trim()).map((x: string, i: number) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={s.liMark}>{block.type === 'numbered_list' ? `${i + 1}.` : '•'}</Text>
              <Text style={s.liText}>{plain(x)}</Text>
            </View>
          ))}
        </View>
      );
    case 'divider': return <View style={s.divider} />;
    case 'image':
      return d.url ? (
        <View wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={pdfImg(d.url)} style={s.image} />
          {d.caption ? <Text style={s.caption}>{d.caption}</Text> : null}
        </View>
      ) : null;
    case 'gallery': return <Tag>[Photo gallery - {(d.images || []).length} photos]</Tag>;
    case 'button': return <Tag>[Button] {d.label || 'Learn more'}{d.url ? ` → ${d.url}` : ''}</Tag>;
    case 'youtube':
    case 'video': return <Tag>[Video] {d.title || ''} {d.url || ''}</Tag>;
    case 'video_showcase': return <Tag>[Videos] {d.title || ''} - {(d.videos || []).length} videos</Tag>;
    case 'property_card': {
      const p = d.property || {};
      return <Tag>[Home card] {[p.address || p.street_address, p.city, p.price ? usd(p.price) : null].filter(Boolean).join(' · ')}</Tag>;
    }
    case 'property_showcase':
      return (
        <View style={s.card} wrap={false}>
          <Text style={s.cardLabel}>{d.kind === 'listings' ? 'Homes for sale card' : 'Recent sales card'}{d.title ? ` · ${d.title}` : ''}</Text>
          {(d.properties || []).map((p: any, i: number) => (
            <Text key={i} style={s.small}>{[p.address || p.street_address, p.city, p.price || p.close_price ? usd(p.price || p.close_price) : null, p.beds ? `${p.beds} bd` : null, p.baths ? `${p.baths} ba` : null].filter(Boolean).join(' · ')}</Text>
          ))}
        </View>
      );
    case 'ask_agent': return <Tag>[Ask line] Ask {agent.name || 'me'}{d.topic ? ` about ${d.topic}` : ''} · Call · Text · Email · Message</Tag>;
    case 'agent_profile': return <Tag>[Agent card] {agent.name}{agent.brokerage ? ` · ${agent.brokerage}` : ''}</Tag>;
    case 'contact_form': return <Tag>[Contact form] {d.label || 'Ask me a question'}</Tag>;
    case 'lead_form': return <Tag>[Form] {d.label || d.title || d.formSlug || ''}</Tag>;
    case 'qr_code': return <Tag>[QR code] {d.label || ''} {d.url || ''}</Tag>;
    case 'cta': return <Tag>[Closing button] {[d.heading, d.label].filter(Boolean).join(' - ')}</Tag>;
    case 'related_articles': return null;
    case 'map': return <Tag>[Map] {d.address || d.query || ''}</Tag>;
    case 'area_spotlight': return <AreaCardPdf a={d.area} />;
    case 'payment_example': return <PaymentCard d={d} />;
    case 'sources': return <SourcesPdf d={d} />;
    case 'disclaimer': return d.text ? <Text style={[s.small, { borderTop: `1 solid ${C.line}`, paddingTop: 8, marginTop: 8 }]}>{d.text}</Text> : null;
    default: return (block.type as string) === 'neighborhood_links' ? <Tag>[Neighborhood links]</Tag> : null;
  }
}

export const BlogArticleDocument = ({ blog }: { blog: BlogPdfData }) => (
  <Document title={blog.title} author={blog.agent.name}>
    <Page size="LETTER" style={s.page}>
      <Text style={s.kicker}>{blog.category || 'Article'}{blog.status ? ` · ${blog.status.toLowerCase()}` : ''}</Text>
      <Text style={s.title}>{blog.title}</Text>
      {blog.subtitle ? <Text style={s.subtitle}>{blog.subtitle}</Text> : null}
      <Text style={s.meta}>By {blog.agent.name}{blog.agent.brokerage ? ` · ${blog.agent.brokerage}` : ''}{blog.created_at ? ` · Made ${day(blog.created_at)}` : ''}</Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {blog.cover_image_url ? <Image src={pdfImg(blog.cover_image_url)} style={s.cover} /> : null}
      <View style={{ marginTop: 12 }}>
        {blog.blocks.map(b => <BlockPdf key={b.id} block={b} agent={blog.agent} />)}
      </View>
      <View style={s.footer} fixed>
        <Text style={s.footerText}>{blog.agent.name}</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);
