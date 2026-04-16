import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { normalizeImageUrl } from '@/lib/utils';

// 1. Register Fonts
Font.registerHyphenationCallback(word => [word]);

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: '/fonts/montserrat-v31-latin-regular.ttf' },
 //   { src: '/fonts/montserrat-v31-latin-700.ttf', fontWeight: 700 },
  ],
});
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: '/fonts/playfair-display-v40-latin-regular.ttf' },
//    { src: '/fonts/playfair-display-v40-latin-700.ttf', fontWeight: 700 },
  ],
});

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
  divider: { height: 1, backgroundColor: COLORS.line, width: '100%', marginVertical: 20 },
  label: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 2, color: COLORS.muted, marginBottom: 6 },
  
  // flyer
  flyerPage: { flexDirection: 'column', backgroundColor: COLORS.white, fontFamily: 'Montserrat' },
  heroSection: { height: 320, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  heroOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(17,24,39,0.12)' },
  
  flyerContent: { flexDirection: 'row', paddingHorizontal: 40, paddingTop: 20, paddingBottom: 35, gap: 40, flexGrow: 1 },
  leftCol: { flex: 1.8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 15 },
  
  addressBlock: { marginTop: 0, width: '100%', display: 'flex', flexDirection: 'column', marginBottom: 10 },
  welcomeLabel: { fontSize: 12, fontFamily: 'Playfair Display', textTransform: 'uppercase', letterSpacing: 3, color: COLORS.muted, marginBottom: 2 },
  mainHeading: { fontSize: 36, fontFamily: 'Playfair Display', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 },
  addressText: { fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: COLORS.text, hyphens: 'none'},
  
  detailsHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 10 },
  detailsTitle: { fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.muted },
  
  statsGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    border: `1 solid ${COLORS.border}`
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: 700, color: COLORS.text },
  statLabel: { fontSize: 7, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 25, backgroundColor: COLORS.line },
  
  priceBlock: { marginTop: -4 },
  priceValue: { fontSize: 30, fontWeight: 700, color: COLORS.text },

  rightCol: { flex: 1, backgroundColor: COLORS.panel, borderRadius: 20, padding: 24, border: `1 solid ${COLORS.border}`, alignItems: 'center', justifyContent: 'flex-start', maxHeight: 400 },
  qrHeader: { fontSize: 18, fontWeight: 700, marginTop: 5, marginBottom: 8, color: COLORS.text },
  qrDescription: { fontSize: 9, color: COLORS.subtext, textAlign: 'center', lineHeight: 1.4, paddingHorizontal: 8 },
  qrContainer: { backgroundColor: 'white', padding: 10, borderRadius: 12, border: `1 solid ${COLORS.line}`, marginTop: 20 },
  qrFooterWrapper: { marginTop: 'auto', alignItems: 'center', width: '100%', paddingBottom: 5 },
  quickEasyText: { fontSize: 9, color: COLORS.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 },
  secondsText: { fontSize: 8, color: COLORS.muted, marginTop: 3 },

  // Recommendation styles
  recPage: { 
    paddingHorizontal: 35, 
    paddingVertical: 35, 
    backgroundColor: COLORS.white, 
    fontFamily: 'Montserrat' 
  },
  recHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    marginBottom: 20,
    borderBottom: `1 solid ${COLORS.line}`, 
    paddingBottom: 10 
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between'
  },
  card: { 
    width: '48.5%', 
    borderRadius: 10, 
    border: `1 solid ${COLORS.line}`, 
    overflow: 'hidden', 
    marginBottom: 24,
    backgroundColor: COLORS.white, 
    height: 195  // Keep this fixed as requested
  },
  cardImage: { 
    width: '100%', 
    height: 110, // Increased from 95
    objectFit: 'cover' 
  },
  cardBody: { 
    padding: 8, // Reduced padding from 12 to save space
    flex: 1, 
    justifyContent: 'space-between' 
  },
  cardAddress: { 
    fontSize: 11, // Slightly smaller to ensure fit
    fontWeight: 700, 
    color: COLORS.text, 
    marginBottom: 1 
  },
  cardPrice: { 
    fontSize: 11, // Slightly smaller
    fontWeight: 700, 
    color: COLORS.accent 
  },
  
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 'auto'
  },
  statsRow: { 
    flexDirection: 'row', 
    gap: 10,
    alignItems: 'center'
  },
  statGrpInline: { 
    flexDirection: 'row', 
    alignItems: 'baseline', 
    gap: 3 
  },
  statNumberLarge: { fontSize: 12, fontWeight: 700, color: COLORS.text },
  statLabelSmall: { fontSize: 7, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniQr: { width: 48, height: 48, padding: 2, border: `1 solid ${COLORS.line}`, backgroundColor: 'white' }
});

const formatAddress = (street: string, city: string): string => {
  const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formattedStreet = toTitleCase(street);
  const formattedCity = toTitleCase(city);

  return `${formattedStreet}, ${formattedCity}`;
};

const PropertyPDFCard = ({ item, agentId }: { item: any; agentId?: string }) => {
  const url = `${process.env.NEXT_PUBLIC_CLIENT_URL}/property/${agentId || 'agent'}/${item.ListingKey}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
  const address = formatAddress(item.FullStreetAddress, item.City);
  
  return (
    <View style={styles.card}>
      <Image src={normalizeImageUrl(item.ListPictureURL || item.image || '')} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <View>
          <Text style={styles.cardAddress} {...({ numberOfLines: 1 } as any)}>{address || 'Address N/A'}</Text>
          <Text style={styles.cardPrice}>${Number(item.ListPrice || item.price || 0).toLocaleString()}</Text>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.statsRow}>
            <View style={styles.statGrpInline}>
              <Text style={styles.statNumberLarge}>{item.BedroomsTotal || item.beds || 0}</Text>
              <Text style={styles.statLabelSmall}>Beds</Text>
            </View>
            <View style={styles.statGrpInline}>
              <Text style={styles.statNumberLarge}>{item.BathroomsTotal || item.baths || 0}</Text>
              <Text style={styles.statLabelSmall}>Baths</Text>
            </View>
            <View style={styles.statGrpInline}>
              <Text style={styles.statNumberLarge}>{Number(item.LivingArea || item.sqft || 0).toLocaleString()}</Text>
              <Text style={styles.statLabelSmall}>Sq Ft</Text>
            </View>
          </View>
          <Image src={qrUrl} style={styles.miniQr} />
        </View>
      </View>
    </View>
  );
};

export const OpenHouseFlyerDocument = ({ data }: { data: any }) => {
  const url = `${process.env.NEXT_PUBLIC_CLIENT_URL || "https://openhousepal.com"}${data.openHouseUrl}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  const propertyAddress = data?.address || "Address Not Available";

  return (
    <Document>
      <Page size="LETTER" style={styles.flyerPage}>
        <View style={styles.heroSection}>
          <Image src={normalizeImageUrl(data.coverImage)} style={styles.coverImage} />
          <View style={styles.heroOverlay} />
        </View>

        <View style={styles.flyerContent}>
          <View style={styles.leftCol}>
            <View style={styles.addressBlock}>
              <Text style={styles.welcomeLabel}>WELCOME</Text>
              <Text style={styles.mainHeading}>Open House</Text>
              <View style={styles.divider} />
              <Text style={[styles.label, { marginTop: 16 }]}>Property Address</Text>
              <Text style={styles.addressText}>{propertyAddress}</Text>
            </View>

            <View>
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsTitle}>Property Details</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.beds || 0}</Text>
                  <Text style={styles.statLabel}>Beds</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.baths || 0}</Text>
                  <Text style={styles.statLabel}>Baths</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{Number(data.sqft || 0).toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Sq Ft</Text>
                </View>
              </View>
            </View>

            <View style={styles.priceBlock}>
              <View style={styles.divider} />
              <Text style={styles.label}>Listing Price</Text>
              <Text style={styles.priceValue}>${Number(data.price || 0).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.label}>Instant Check-In</Text>
              <Text style={styles.qrHeader}>Scan to Sign In</Text>
              <Text style={styles.qrDescription}>Complete our online sign-in form to register your visit.</Text>
            </View>
            <View style={styles.qrContainer}>
              <Image src={qrUrl} style={{ width: 150, height: 150 }} />
            </View>
            <View style={styles.qrFooterWrapper}>
              <Text style={styles.quickEasyText}>Quick & Easy</Text>
              <Text style={styles.secondsText}>Takes less than 30 seconds to complete</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

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
              <Text style={{ fontSize: 16, fontWeight: 700 }}>Similar Properties</Text>
              <Text style={{ fontSize: 7, color: COLORS.subtext, marginTop: 2 }}>{address ? `Ref: ${address}` : 'Curated Listings'}</Text>
            </View>
            <Text style={{ fontSize: 7, color: COLORS.muted }}>Page {pageIndex + 1} of {propertyPages.length}</Text>
          </View>
          <View style={styles.grid}>
            {pageItems.map((item: any) => <PropertyPDFCard key={item.id} item={item} agentId={agentId} />)}
          </View>
        </Page>
      ))}
    </Document>
  );
};
