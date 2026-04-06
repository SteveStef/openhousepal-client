import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';

const COLORS = {
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  line: '#E5E7EB',
  panel: '#F8F7F4',
  white: '#FFFFFF',
  border: '#E7E5E4',
  accent: '#8b7355',
};

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: COLORS.line, width: '100%', marginVertical: 15 },
  label: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: COLORS.muted, marginBottom: 8 },
  
  // --- FLYER STYLES ---
  flyerPage: { flexDirection: 'column', backgroundColor: COLORS.white },
  heroSection: { height: 340, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  heroOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(17,24,39,0.12)' },
  flyerContent: { flexDirection: 'row', paddingHorizontal: 40, paddingVertical: 40, gap: 25, flexGrow: 1 },
  leftCol: { flex: 1.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  addressBlock: { marginTop: 10 },
  addressText: { fontSize: 28, fontWeight: 700, lineHeight: 1.3, color: COLORS.text },
  statsGrid: { flexDirection: 'row', gap: 45, paddingVertical: 20 },
  statItem: { alignItems: 'flex-start' },
  statValue: { fontSize: 26, fontWeight: 700, color: COLORS.text, marginBottom: 4 },
  statLabel: { fontSize: 9, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  priceValue: { fontSize: 36, fontWeight: 700, color: COLORS.text },
  rightCol: { 
    flex: 1, 
    backgroundColor: COLORS.panel, 
    borderRadius: 24, 
    padding: 24, 
    border: `1 solid ${COLORS.border}`, 
    alignItems: 'center', 
    justifyContent: 'space-between',
    maxHeight: 400 
  },

  // --- RECOMMENDATION STYLES ---
  recPage: { paddingHorizontal: 35, paddingVertical: 30, backgroundColor: COLORS.white },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15, borderBottom: `1 solid ${COLORS.line}`, paddingBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48.5%', borderRadius: 10, border: `1 solid ${COLORS.line}`, overflow: 'hidden', marginBottom: 12, backgroundColor: COLORS.white, height: 205 },
  cardImage: { width: '100%', height: 100, objectFit: 'cover' },
  cardBody: { padding: 12 },
  cardAddress: { fontSize: 11, fontWeight: 700, color: COLORS.text, marginBottom: 3 },
  cardPrice: { fontSize: 10, fontWeight: 700, color: COLORS.accent, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTop: `0.5 solid ${COLORS.line}`, paddingTop: 8, marginTop: 'auto' },
  statsRow: { flexDirection: 'row', gap: 12, flex: 1 },
  statGrp: { alignItems: 'flex-start' },
  miniQr: { width: 42, height: 42, padding: 2, border: `1 solid ${COLORS.line}`, backgroundColor: 'white', marginLeft: 8 }
});

// --- SUB-COMPONENT: PROPERTY CARD ---
const PropertyPDFCard = ({ item, agentId }: { item: any; agentId?: string }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://openhousepal.com/property/${item.id}/${agentId || 'agent'}`)}`;
  return (
    <View style={styles.card}>
      <Image src={item.ListPictureURL || item.image || ''} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.cardAddress} numberOfLines={1}>{item.FullStreetAddress || item.address || 'Address N/A'}</Text>
        <Text style={styles.cardPrice}>${Number(item.ListPrice || item.price || 0).toLocaleString()}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.statsRow}>
            <View style={styles.statGrp}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>{item.BedroomsTotal || item.beds || 0}</Text>
              <Text style={{ fontSize: 6, color: COLORS.muted, textTransform: 'uppercase' }}>Beds</Text>
            </View>
            <View style={styles.statGrp}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>{item.BathroomsTotal || item.baths || 0}</Text>
              <Text style={{ fontSize: 6, color: COLORS.muted, textTransform: 'uppercase' }}>Baths</Text>
            </View>
            <View style={styles.statGrp}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>{Number(item.LivingArea || item.sqft || 0).toLocaleString()}</Text>
              <Text style={{ fontSize: 6, color: COLORS.muted, textTransform: 'uppercase' }}>Sq Ft</Text>
            </View>
          </View>
          <Image src={qrUrl} style={styles.miniQr} />
        </View>
      </View>
    </View>
  );
};

// --- PDF 1: ONLY THE OPEN HOUSE FLYER ---
export const OpenHouseFlyerDocument = ({ data }: { data: any }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.openHouseUrl || '')}`;
  return (
    <Document>
      <Page size="LETTER" style={styles.flyerPage}>
        <View style={styles.heroSection}>
          <Image src={data.coverImage} style={styles.coverImage} />
          <View style={styles.heroOverlay} />
        </View>

        <View style={styles.flyerContent}>
          <View style={styles.leftCol}>
            <View style={styles.addressBlock}>
              <Text style={styles.label}>WELCOME</Text>
              <Text style={{ fontSize: 42, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Open House</Text>
              <View style={styles.divider} />
              <Text style={styles.label}>Property Address</Text>
              <Text style={styles.addressText}>{data.address}</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.beds || 0}</Text>
                <Text style={styles.statLabel}>Beds</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.baths || 0}</Text>
                <Text style={styles.statLabel}>Baths</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Number(data.sqft || 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Sq Ft</Text>
              </View>
            </View>

            <View>
              <View style={styles.divider} />
              <Text style={styles.label}>Listing Price</Text>
              <Text style={styles.priceValue}>${Number(data.price || 0).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.label}>Instant Check-In</Text>
              <Text style={{ fontSize: 22, fontWeight: 700 }}>Scan to Sign In</Text>
              <Text style={{ fontSize: 10, color: COLORS.subtext, textAlign: 'center', marginTop: 12, lineHeight: 1.4 }}>
                Register your visit using our digital guestbook.
              </Text>
            </View>
            <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 16, border: `1 solid ${COLORS.line}` }}>
              <Image src={qrUrl} style={{ width: 150, height: 150 }} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: COLORS.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                Quick & Easy
              </Text>
              <Text style={{ fontSize: 7, color: COLORS.muted, marginTop: 2 }}>
                Takes less than 30 seconds to complete
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// --- PDF 2: ONLY THE SIMILAR PROPERTIES ---
export const SimilarPropertiesDocument = ({ properties, agentId, address }: any) => {
  if (!properties || properties.length === 0) return null;
  const chunkArray = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  const propertyPages = chunkArray(properties, 6);

  return (
    <Document>
      {propertyPages.map((pageItems, pageIndex) => (
        <Page key={pageIndex} size="LETTER" style={styles.recPage}>
          <View style={styles.recHeader}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: 700 }}>Similar Properties</Text>
              <Text style={{ fontSize: 8, color: COLORS.subtext, marginTop: 2 }}>{address ? `Ref: ${address}` : 'Curated Listings'}</Text>
            </View>
            <Text style={{ fontSize: 8, color: COLORS.muted }}>Page {pageIndex + 1} of {propertyPages.length}</Text>
          </View>
          <View style={styles.grid}>
            {pageItems.map((item: any) => <PropertyPDFCard key={item.id} item={item} agentId={agentId} />)}
          </View>
        </Page>
      ))}
    </Document>
  );
};
