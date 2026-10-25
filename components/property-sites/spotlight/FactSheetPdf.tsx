import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { qrPdfSrc } from '@/lib/qr'
import type { FactSheet } from './factSheetData'

// The fact sheet as a real PDF (user, 10/24: "PDF doesn't work") - the same one letter page as the
// printable page, laid out with react-pdf so the file looks the same on every device. Remote
// photos come through the app's own /api/pdf-image so nothing blocks them.
function pdfImage(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('data:') || typeof window === 'undefined') return url
  const abs = url.startsWith('/') ? `${window.location.origin}${url}` : url
  return `${window.location.origin}/api/pdf-image?url=${encodeURIComponent(abs)}`
}

const INK = '#1c1917'
const MUTED = '#78716c'
const GOLD = '#8b7355'
const LINE = '#e7e5e4'

const s = StyleSheet.create({
  page: { padding: 34, fontFamily: 'Helvetica', color: INK, fontSize: 9.5 },
  hero: { width: '100%', height: 205, objectFit: 'cover' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: INK },
  kicker: { fontSize: 7, letterSpacing: 1.6, color: GOLD, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  h1: { fontFamily: 'Times-Roman', fontSize: 25, marginTop: 4 },
  place: { fontSize: 9, color: MUTED, marginTop: 2 },
  priceLabel: { fontSize: 6.5, letterSpacing: 1.4, color: MUTED, textAlign: 'right', textTransform: 'uppercase' },
  price: { fontFamily: 'Times-Roman', fontSize: 22, textAlign: 'right', marginTop: 2 },
  stats: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE },
  stat: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRightWidth: 1, borderRightColor: LINE },
  statLast: { borderRightWidth: 0 },
  statV: { fontFamily: 'Times-Roman', fontSize: 15 },
  statL: { fontSize: 6, letterSpacing: 1.2, color: MUTED, marginTop: 2, textTransform: 'uppercase' },
  cols: { flexDirection: 'row', marginTop: 14 },
  colL: { flex: 1.2, paddingRight: 16 },
  colR: { flex: 1 },
  h2: { fontSize: 7, letterSpacing: 1.6, color: GOLD, fontFamily: 'Helvetica-Bold', marginBottom: 5, textTransform: 'uppercase' },
  h2Gap: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.6, borderBottomWidth: 0.6, borderBottomColor: '#f0eeec' },
  dt: { color: MUTED, fontSize: 8.6, width: '42%' },
  dd: { fontFamily: 'Helvetica-Bold', fontSize: 8.6, width: '58%', textAlign: 'right' },
  feats: { flexDirection: 'row', flexWrap: 'wrap' },
  feat: { width: '50%', paddingVertical: 2.4, paddingRight: 6, fontSize: 8.4 },
  agentBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: INK, flexDirection: 'row', alignItems: 'center' },
  agentPhoto: { width: 40, height: 40, borderRadius: 20, objectFit: 'cover', marginRight: 9 },
  agentName: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  agentLine: { fontSize: 7.6, color: '#57534e', marginTop: 2 },
  qrWrap: { marginLeft: 'auto', alignItems: 'center', width: 70 },
  qr: { width: 58, height: 58 },
  qrCap: { fontSize: 6, color: MUTED, marginTop: 2, textAlign: 'center' },
  note: { position: 'absolute', left: 34, right: 34, bottom: 22, fontSize: 6.5, color: '#a8a29e', flexDirection: 'row', justifyContent: 'space-between' },
})

export default function FactSheetPdf({ d, url }: { d: FactSheet; url: string }) {
  return (
    <Document title={`Fact sheet - ${d.street}`} author={d.agent?.name || 'OpenHousePal'}>
      <Page size="LETTER" style={s.page} wrap={false}>
        {d.hero ? <Image src={pdfImage(d.hero)} style={s.hero} /> : null}
        <View style={s.head}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            {d.kicker ? <Text style={s.kicker}>{d.kicker}</Text> : null}
            <Text style={s.h1}>{d.street}</Text>
            {d.place ? <Text style={s.place}>{d.place}</Text> : null}
          </View>
          {d.price ? (
            <View>
              <Text style={s.priceLabel}>{d.priceLabel}</Text>
              <Text style={s.price}>{d.price}</Text>
            </View>
          ) : null}
        </View>
        {d.stats.length > 0 && (
          <View style={s.stats}>
            {d.stats.map(([v, l], i) => (
              <View key={l} style={i === d.stats.length - 1 ? [s.stat, s.statLast] : s.stat}>
                <Text style={s.statV}>{v}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={s.cols}>
          <View style={s.colL}>
            <Text style={s.h2}>The details</Text>
            {d.facts.map(f => (
              <View key={f.label} style={s.row}><Text style={s.dt}>{f.label}</Text><Text style={s.dd}>{f.value}</Text></View>
            ))}
          </View>
          <View style={s.colR}>
            {d.features.length > 0 && (
              <>
                <Text style={s.h2}>Stand-out features</Text>
                <View style={s.feats}>{d.features.map(x => <Text key={x} style={s.feat}>• {x}</Text>)}</View>
              </>
            )}
            {d.schools.length > 0 && (
              <>
                <Text style={[s.h2, s.h2Gap]}>Schools</Text>
                {d.schools.map(sc => (
                  <View key={sc.level} style={s.row}><Text style={s.dt}>{sc.level}</Text><Text style={s.dd}>{sc.name}</Text></View>
                ))}
              </>
            )}
            <View style={s.agentBox}>
              {d.agent?.photo ? <Image src={pdfImage(d.agent.photo)} style={s.agentPhoto} /> : null}
              <View style={{ flex: 1, paddingRight: 6 }}>
                {d.agent ? <Text style={s.agentName}>{d.agent.name}</Text> : null}
                {d.agent?.line ? <Text style={s.agentLine}>{d.agent.line}</Text> : null}
                {d.agent?.email ? <Text style={s.agentLine}>{d.agent.email}</Text> : null}
                {d.agent?.license ? <Text style={s.agentLine}>Lic. #{d.agent.license}</Text> : null}
              </View>
              <View style={s.qrWrap}>
                <Image src={qrPdfSrc(`${url}${url.includes('?') ? '&' : '?'}src=qr`, { size: 300, dark: '#111827' })} style={s.qr} />
                <Text style={s.qrCap}>Every photo</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={s.note} fixed>
          <Text>Information deemed reliable but not guaranteed. Please verify anything important.</Text>
          <Text>{d.mls}</Text>
        </View>
      </Page>
    </Document>
  )
}
