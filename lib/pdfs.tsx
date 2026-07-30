import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  Svg,
  Path,
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
    marginBottom: 8
  },
  cardPrice: { 
    fontSize: 12, // Slightly smaller
    fontWeight: 900, 
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
  miniQr: { width: 48, height: 48, padding: 2, border: `1 solid ${COLORS.line}`, backgroundColor: 'white' },

  // Agent Brag Sheet + Open House Cheat Sheet (shared)
  sheetPage: { paddingHorizontal: 35, paddingVertical: 35, backgroundColor: COLORS.white, fontFamily: 'Montserrat' },
  sheetHeading: { fontSize: 22, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, marginBottom: 4 },
  sheetSubheading: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.muted, marginBottom: 16 },

  backHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  backHeaderPrice: { fontSize: 19, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.accent, marginBottom: 16 },

  agentHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 20, borderBottom: `1 solid ${COLORS.line}` },
  agentPhoto: { width: 72, height: 72, borderRadius: 36, objectFit: 'cover', border: `1 solid ${COLORS.border}` },
  agentPhotoPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.panel, border: `1 solid ${COLORS.border}`, alignItems: 'center', justifyContent: 'center' },
  agentPhotoInitials: { fontSize: 22, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.accent },
  agentName: { fontSize: 20, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text },
  agentSubline: { fontSize: 9, color: COLORS.subtext, marginTop: 3 },

  bioText: { fontSize: 9, lineHeight: 1.6, color: COLORS.subtext, marginBottom: 20 },

  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  areaChip: { fontSize: 8, fontWeight: 700, color: COLORS.accent, backgroundColor: COLORS.panel, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, border: `1 solid ${COLORS.border}` },

  salesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  saleTile: { width: '31.5%', borderRadius: 8, border: `1 solid ${COLORS.line}`, overflow: 'hidden', marginBottom: 12, backgroundColor: COLORS.white },
  saleTileImage: { width: '100%', height: 65, objectFit: 'cover' },
  saleTileBody: { padding: 6 },
  saleTileAddress: { fontSize: 8, fontWeight: 700, color: COLORS.text },
  saleTilePrice: { fontSize: 9, fontWeight: 900, color: COLORS.accent, marginTop: 2 },

  adHeading: { fontSize: 26, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  adSubheading: { fontSize: 10, color: COLORS.subtext, textAlign: 'center', marginBottom: 28, paddingHorizontal: 40, lineHeight: 1.5 },
  bulletGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 },
  bulletCard: { width: '47%', backgroundColor: COLORS.panel, borderRadius: 14, border: `1 solid ${COLORS.border}`, padding: 18, marginBottom: 16 },
  bulletTitle: { fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 6 },
  bulletBody: { fontSize: 8.5, lineHeight: 1.5, color: COLORS.subtext },

  adQrBlock: { marginTop: 10, alignItems: 'center', backgroundColor: COLORS.panel, borderRadius: 20, padding: 24, border: `1 solid ${COLORS.border}` },
  adQrCta: { fontSize: 11, fontWeight: 700, color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  adQrImage: { width: 110, height: 110 },

  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  photoHalf: { flex: 1, height: 280, borderRadius: 12, objectFit: 'cover' },
  heroWrap: { position: 'relative', marginBottom: 12 },
  heroPhoto: { width: '100%', height: 220, borderRadius: 14, objectFit: 'cover' },
  openHouseBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(17,24,39,0.72)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  openHouseBadgeText: { fontSize: 8, fontWeight: 700, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 2 },

  brokerageMasthead: { fontSize: 15, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 3.5, marginBottom: 8 },
  mastheadDivider: { height: 2, width: 56, backgroundColor: COLORS.accent, alignSelf: 'center', borderRadius: 1, marginBottom: 16 },

  frontAgentCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.panel, borderRadius: 16, border: `1 solid ${COLORS.border}`, borderLeft: `4 solid ${COLORS.accent}`, padding: 16, marginTop: 'auto' },
  frontAgentInfo: { flex: 1 },
  frontAgentName: { fontSize: 16, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, marginBottom: 3 },
  frontAgentDetail: { fontSize: 8.5, color: COLORS.subtext, marginTop: 1.5 },
  frontAgentQrCard: { alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, border: `1 solid ${COLORS.accent}`, padding: 8 },
  frontAgentQrImage: { width: 68, height: 68, borderRadius: 4 },
  frontAgentQrCaption: { fontSize: 5.5, color: COLORS.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', maxWidth: 82 },

  descriptionText: { fontSize: 9, lineHeight: 1.6, color: COLORS.subtext, marginBottom: 14 },

  sectionLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.accent, marginTop: 8, marginBottom: 6, paddingLeft: 6, borderLeft: `3 solid ${COLORS.accent}` },

  basicInfoRow: { flexDirection: 'row', backgroundColor: COLORS.panel, borderRadius: 8, border: `1 solid ${COLORS.border}`, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4 },
  basicInfoItem: { flex: 1, alignItems: 'center' },
  basicInfoIconCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.white, border: `1 solid ${COLORS.accent}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  basicInfoValue: { fontSize: 9.5, fontWeight: 700, color: COLORS.text, marginTop: 3 },
  basicInfoLabel: { fontSize: 5, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 0.5, textAlign: 'center' },

  factTileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  factTile: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.panel, borderRadius: 12, border: `1 solid ${COLORS.border}`, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 8 },
  factTileWide: { width: '100%' },
  factIconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.white, border: `1 solid ${COLORS.accent}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  factTileText: { flex: 1 },
  factLabel: { fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, marginBottom: 2 },
  factValue: { fontSize: 9.5, fontWeight: 700, color: COLORS.text },

  amenitiesSection: { marginTop: 4 },
  amenityCategory: { marginBottom: 6 },
  amenityCategoryLabel: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.accent, marginBottom: 4 },
  amenityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  amenityName: { fontSize: 8, color: COLORS.text },
  amenityDistance: { fontSize: 8, color: COLORS.muted },
  amenityTypeTag: { fontSize: 6, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
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
  const url = `${process.env.NEXT_PUBLIC_CLIENT_URL || "https://openhousepal.com"}/property/${item.ListingKey || item.id}/${agentId || 'agent'}`;
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

const getInitials = (name?: string) => {
  if (!name) return '';
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
};

const AgentPhoto = ({ url, name, size = 72 }: { url?: string; name?: string; size?: number }) => {
  const sizeOverride = size !== 72 ? { width: size, height: size, borderRadius: size / 2 } : null;
  if (url) return <Image src={normalizeImageUrl(url)} style={sizeOverride ? [styles.agentPhoto, sizeOverride] : styles.agentPhoto} />;
  return (
    <View style={sizeOverride ? [styles.agentPhotoPlaceholder, sizeOverride] : styles.agentPhotoPlaceholder}>
      <Text style={size !== 72 ? [styles.agentPhotoInitials, { fontSize: size * 0.3 }] : styles.agentPhotoInitials}>{getInitials(name) || '?'}</Text>
    </View>
  );
};

interface BragSheetAgent {
  name: string;
  title?: string;
  brokerage?: string;
  market?: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  bio?: string;
}

interface BragSheetSale {
  id: string;
  address: string;
  city?: string;
  state?: string;
  price?: number;
  image?: string;
}

export const AgentBragSheetDocument = ({ agent, recentSales, showcaseQrUrl }: { agent: BragSheetAgent; recentSales: BragSheetSale[]; showcaseQrUrl?: string | null }) => {
  const sortedSales = [...(recentSales || [])].sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 9);
  const areasSoldIn = Array.from(new Set(
    (recentSales || []).map(sale => [sale.city, sale.state].filter(Boolean).join(', ')).filter(Boolean)
  ));

  return (
    <Document>
      <Page size="LETTER" style={styles.sheetPage}>
        <View style={styles.agentHeader}>
          <AgentPhoto url={agent.photoUrl} name={agent.name} />
          <View>
            <Text style={styles.agentName}>{agent.name}</Text>
            <Text style={styles.agentSubline}>{[agent.title, agent.brokerage].filter(Boolean).join(' · ')}</Text>
            {agent.market && <Text style={styles.agentSubline}>{agent.market}</Text>}
          </View>
        </View>

        {agent.bio && <Text style={styles.bioText}>{agent.bio}</Text>}

        {sortedSales.length > 0 && (
          <>
            <Text style={styles.detailsTitle}>Recent Sales</Text>
            <View style={[styles.salesGrid, { marginTop: 10 }]}>
              {sortedSales.map(sale => (
                <View key={sale.id} style={styles.saleTile}>
                  {sale.image ? <Image src={normalizeImageUrl(sale.image)} style={styles.saleTileImage} /> : <View style={[styles.saleTileImage, { backgroundColor: COLORS.panel }]} />}
                  <View style={styles.saleTileBody}>
                    <Text style={styles.saleTileAddress} {...({ numberOfLines: 1 } as any)}>{formatAddress(sale.address, sale.city || '')}</Text>
                    <Text style={styles.saleTilePrice}>${Number(sale.price || 0).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {areasSoldIn.length > 0 && (
          <>
            <Text style={[styles.detailsTitle, { marginTop: 8 }]}>Areas Sold In</Text>
            <View style={styles.areaChips}>
              {areasSoldIn.map(area => <Text key={area} style={styles.areaChip}>{area}</Text>)}
            </View>
          </>
        )}
      </Page>

      <Page size="LETTER" style={styles.sheetPage}>
        <Text style={styles.adHeading}>Never Let A Lead Go Cold</Text>
        <Text style={styles.adSubheading}>
          Ask about your own free personalized Showcase - a live, evolving collection of homes matched to exactly what you're looking for.
        </Text>

        <View style={styles.bulletGrid}>
          <View style={styles.bulletCard}>
            <Text style={styles.bulletTitle}>Automated Follow-Ups</Text>
            <Text style={styles.bulletBody}>A branded, personalized invite is sent automatically within an hour of the open house - never let a lead go cold.</Text>
          </View>
          <View style={styles.bulletCard}>
            <Text style={styles.bulletTitle}>Smart Alerts</Text>
            <Text style={styles.bulletBody}>You're notified the moment a new matching listing or price drop appears - all branded as your agent.</Text>
          </View>
          <View style={styles.bulletCard}>
            <Text style={styles.bulletTitle}>Tailored Collections</Text>
            <Text style={styles.bulletBody}>Each lead gets their own personalized showcase built around their exact preferences.</Text>
          </View>
          <View style={styles.bulletCard}>
            <Text style={styles.bulletTitle}>Interactive Engagement</Text>
            <Text style={styles.bulletBody}>Like, save, comment, and request tours right from the showcase, in real time.</Text>
          </View>
        </View>

        {showcaseQrUrl && (
          <View style={styles.adQrBlock}>
            <Text style={styles.adQrCta}>Scan to build your own personalized home search</Text>
            <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(showcaseQrUrl)}`} style={styles.adQrImage} />
          </View>
        )}
      </Page>
    </Document>
  );
};

// Simple stroke-based fact icons (lucide-react path data, rendered via react-pdf's Svg primitives)
const FactIcon = ({ paths, size = 13 }: { paths: string[]; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {paths.map((d, i) => (
      <Path key={i} d={d} fill="none" stroke={COLORS.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </Svg>
);

const ICONS = {
  bed: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M2 4v16', 'M2 8h18a2 2 0 0 1 2 2v10', 'M2 17h20', 'M6 8v9']} />,
  bath: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M10 4 8 6', 'M17 19v2', 'M2 12h20', 'M7 19v2', 'M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5']} />,
  ruler: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z', 'm14.5 12.5 2-2', 'm11.5 9.5 2-2', 'm8.5 6.5 2-2', 'm17.5 15.5 2-2']} />,
  dollar: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']} />,
  mapPin: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z']} />,
  gradCap: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z', 'M22 10v6', 'M6 12.5V16a6 3 0 0 0 12 0v-3.5']} />,
  calendar: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M8 2v4', 'M16 2v4', 'M3 4h18v18H3Z', 'M3 10h18']} />,
  droplet: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z']} />,
  waves: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1', 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1', 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1']} />,
  landPlot: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['m12 8 6-3-6-3v10', 'm8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12', 'm6.49 12.85 11.02 6.3', 'M17.51 12.85 6.5 19.15']} />,
  flame: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z']} />,
  snowflake: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['m10 20-1.25-2.5L6 18', 'M10 4 8.75 6.5 6 6', 'm14 20 1.25-2.5L18 18', 'm14 4 1.25 2.5L18 6', 'm17 21-3-6h-4', 'm17 3-3 6 1.5 3', 'M2 12h6.5L10 9', 'm20 10-1.5 2 1.5 2', 'M22 12h-6.5L14 15', 'm4 10 1.5 2L4 14', 'm7 21 3-6-1.5-3', 'm7 3 3 6h4']} />,
  house: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']} />,
  squareCheck: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M3 3h18v18H3Z', 'm9 12 2 2 4-4']} />,
};

const InfoLineRow = ({ items }: { items: { icon: keyof typeof ICONS; label: string; value: string }[] }) => (
  <View style={styles.basicInfoRow}>
    {items.map(item => {
      const Icon = ICONS[item.icon];
      return (
        <View key={item.label} style={styles.basicInfoItem}>
          <View style={styles.basicInfoIconCircle}><Icon size={9} /></View>
          <Text style={styles.basicInfoValue} {...({ numberOfLines: 2 } as any)}>{item.value}</Text>
          <Text style={styles.basicInfoLabel}>{item.label}</Text>
        </View>
      );
    })}
  </View>
);

const FactTile = ({ icon, label, value, wide }: { icon: keyof typeof ICONS; label: string; value: string; wide?: boolean }) => {
  const Icon = ICONS[icon];
  return (
    <View style={wide ? [styles.factTile, styles.factTileWide] : styles.factTile}>
      <View style={styles.factIconCircle}><Icon /></View>
      <View style={styles.factTileText}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue} {...({ numberOfLines: 2 } as any)}>{value}</Text>
      </View>
    </View>
  );
};

const truncateAtSentence = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const sentenceEnd = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '));
  // Only cut at the sentence boundary if it doesn't throw away too much of the target length -
  // otherwise (e.g. one long run-on sentence) fall back to a clean word break instead.
  if (sentenceEnd > maxLength * 0.5) {
    return truncated.slice(0, sentenceEnd + 1);
  }
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 0 ? wordBoundary : maxLength)}…`;
};

const joinField = (val?: string[] | string | null): string => {
  if (!val) return '—';
  if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
  return val;
};

interface CheatSheetProperty {
  address: string;
  city?: string;
  state?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  aboveGradeSqft?: number;
  belowGradeSqft?: number;
  acres?: number;
  township?: string;
  schoolDistrict?: string;
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  taxAnnualAmount?: number;
  taxYear?: number;
  yearBuilt?: number;
  waterSource?: string[] | string | null;
  sewer?: string[] | string | null;
  heating?: string[] | string | null;
  heatingFuel?: string[] | string | null;
  cooling?: string[] | string | null;
  hoaFee?: number | null;
  hoaFeeFrequency?: string | null;
  hoaIncludes?: string[] | string | null;
  description?: string;
  photos?: string[];
}

interface CheatSheetAgent {
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  photoUrl?: string;
  hubUrl?: string | null;
}

interface AmenityPlace { name: string; distance_miles?: number | null; place_type?: string | null }

interface CheatSheetAmenities {
  schools: AmenityPlace[];
  private_schools: AmenityPlace[];
  grocery_stores: AmenityPlace[];
  medical_care: AmenityPlace[];
  parks: AmenityPlace[];
  downtown_areas: AmenityPlace[];
  airports: AmenityPlace[];
  available: boolean;
}

const photoAt = (photos: string[] | undefined, index: number) => {
  if (!photos || photos.length === 0) return '';
  return normalizeImageUrl(photos[index % photos.length]);
};

const AmenityCategory = ({ label, places, maxItems }: { label: string; places: AmenityPlace[]; maxItems: number }) => {
  if (!places || places.length === 0) return null;
  return (
    <View style={styles.amenityCategory}>
      <Text style={styles.amenityCategoryLabel}>{label}</Text>
      {places.slice(0, maxItems).map((place, i) => (
        <View key={`${place.name}-${i}`} style={styles.amenityRow}>
          <View style={{ flex: 1 }}>
            {place.place_type && <Text style={styles.amenityTypeTag}>{place.place_type}</Text>}
            <Text style={styles.amenityName} {...({ numberOfLines: 1 } as any)}>{place.name}</Text>
          </View>
          {place.distance_miles != null && <Text style={styles.amenityDistance}>{place.distance_miles} mi</Text>}
        </View>
      ))}
    </View>
  );
};

export const OpenHouseCheatSheetDocument = ({ property, agent, amenities }: { property: CheatSheetProperty; agent: CheatSheetAgent; amenities?: CheatSheetAmenities }) => {
  // Only worth its own tile if it tells guests something the total Sq Ft (shown in Basic Info) doesn't already.
  const hasBelowGrade = !!property.belowGradeSqft && property.belowGradeSqft > 0;
  const hasDistinctAboveGrade = !!property.aboveGradeSqft && property.sqft != null && property.aboveGradeSqft !== property.sqft;
  const showSqftSplit = hasBelowGrade || hasDistinctAboveGrade;
  const sqftSplit = [
    property.aboveGradeSqft ? `${Number(property.aboveGradeSqft).toLocaleString()} above` : null,
    property.belowGradeSqft ? `${Number(property.belowGradeSqft).toLocaleString()} below` : null,
  ].filter(Boolean).join(' / ');

  const hasHoaIncludes = Array.isArray(property.hoaIncludes) ? property.hoaIncludes.length > 0 : !!property.hoaIncludes;

  const basicInfo: { icon: keyof typeof ICONS; label: string; value: string }[] = [
    { icon: 'bed', label: 'Beds', value: property.beds != null ? String(property.beds) : '—' },
    { icon: 'bath', label: 'Baths', value: property.baths != null ? String(property.baths) : '—' },
    { icon: 'ruler', label: 'Sq Ft', value: property.sqft ? Number(property.sqft).toLocaleString() : '—' },
    { icon: 'calendar', label: 'Build Year', value: property.yearBuilt ? String(property.yearBuilt) : '—' },
    { icon: 'landPlot', label: 'Acres', value: property.acres ? String(property.acres) : '—' },
  ];

  const hoaFeeValue = property.hoaFee
    ? `$${Number(property.hoaFee).toLocaleString()}${property.hoaFeeFrequency ? ` / ${property.hoaFeeFrequency}` : ''}`
    : '—';

  const schoolTownship = [property.schoolDistrict, property.township].filter(Boolean).join(' / ') || '—';
  // Prefer the MLS-named assigned school; MLS leaves this blank for most listings, so for any level
  // it's missing, fall back to a same-district value the backend found by checking every OTHER listing
  // on file for this exact district (see nearby_amenities_service._fetch_assigned_schools) - and only
  // when they all agree on one real school. No geography-based guessing: a district with more than one
  // real school at a level (e.g. Lower Merion's 5 elementary schools) has no reliable "nearest" answer,
  // since attendance boundaries don't follow distance, so those levels are left blank rather than guessed.
  const knownDistrictSchool = (level: string) => amenities?.schools?.find(s => s.place_type === level)?.name;
  const assignedSchools = [
    property.elementarySchool || knownDistrictSchool('Elementary School'),
    property.middleSchool || knownDistrictSchool('Middle School'),
    property.highSchool || knownDistrictSchool('High School'),
  ].filter(Boolean);

  const heatingValue = joinField(property.heating);
  const heatingFuelValue = joinField(property.heatingFuel);
  const heatingCombined = [heatingValue !== '—' ? heatingValue : null, heatingFuelValue !== '—' ? heatingFuelValue : null].filter(Boolean).join(' / ') || '—';

  const propertyInfoLine: { icon: keyof typeof ICONS; label: string; value: string }[] = [
    { icon: 'droplet', label: 'Water Source', value: joinField(property.waterSource) },
    { icon: 'waves', label: 'Sewer', value: joinField(property.sewer) },
    { icon: 'dollar', label: 'Annual Taxes', value: property.taxAnnualAmount ? `$${Number(property.taxAnnualAmount).toLocaleString()}${property.taxYear ? ` (${property.taxYear})` : ''}` : '—' },
    { icon: 'snowflake', label: 'Cooling', value: joinField(property.cooling) },
  ];

  const propertyInfo: { icon: keyof typeof ICONS; label: string; value: string; wide?: boolean }[] = [
    ...(showSqftSplit ? [{ icon: 'ruler' as const, label: 'Sq Ft Split (Abv / Blw Grade)', value: sqftSplit }] : []),
    { icon: 'gradCap', label: 'School District/Township', value: schoolTownship },
    ...(assignedSchools.length > 0 ? [{ icon: 'gradCap' as const, label: 'Assigned Schools (Elem / Middle / High)', value: assignedSchools.join(' • '), wide: true }] : []),
    { icon: 'flame', label: 'Heating/Fuel Source', value: heatingCombined },
    ...(property.hoaFee ? [{ icon: 'house' as const, label: 'HOA Fee', value: hoaFeeValue }] : []),
    ...(hasHoaIncludes ? [{ icon: 'squareCheck' as const, label: 'HOA Covers', value: joinField(property.hoaIncludes), wide: true }] : []),
  ];

  // Defensive against a stale/older-shaped amenities payload (e.g. a backend response cached before a
  // field was renamed or added) still missing a key entirely - treat a missing list the same as empty
  // rather than crashing the whole PDF render over one absent category.
  const amenityLists = amenities ? [
    amenities.private_schools, amenities.grocery_stores, amenities.medical_care,
    amenities.parks, amenities.downtown_areas, amenities.airports,
  ] : [];
  const hasAmenities = amenities?.available && amenityLists.some(list => (list?.length ?? 0) > 0);
  // RULE: the Cheat Sheet must always fit in exactly 2 pages - react-pdf auto-paginates any overflowing
  // content onto a 3rd page rather than clipping it, so a listing with every optional fact tile AND all
  // 6 "What's Nearby" categories fully populated needs an explicit cap, not just hope. 3 items/category
  // fits comfortably when few categories have data (the common case); once more than 4 categories are
  // populated, drop to 2/category to keep the section's worst-case height inside the page budget.
  const populatedAmenityCategories = amenityLists.filter(list => (list?.length ?? 0) > 0).length;
  const amenityItemCap = populatedAmenityCategories > 4 ? 2 : 3;

  return (
    <Document>
      <Page size="LETTER" style={styles.sheetPage}>
        {agent.brokerage && <Text style={styles.brokerageMasthead}>{agent.brokerage}</Text>}
        <View style={styles.mastheadDivider} />

        <View style={styles.heroWrap}>
          {photoAt(property.photos, 0) ? <Image src={photoAt(property.photos, 0)} style={styles.heroPhoto} /> : <View style={[styles.heroPhoto, { backgroundColor: COLORS.panel }]} />}
          <View style={styles.openHouseBadge}><Text style={styles.openHouseBadgeText}>Open House</Text></View>
        </View>

        <View style={styles.photoRow}>
          {photoAt(property.photos, 1) ? <Image src={photoAt(property.photos, 1)} style={styles.photoHalf} /> : <View style={[styles.photoHalf, { backgroundColor: COLORS.panel }]} />}
          {photoAt(property.photos, 2) ? <Image src={photoAt(property.photos, 2)} style={styles.photoHalf} /> : <View style={[styles.photoHalf, { backgroundColor: COLORS.panel }]} />}
        </View>

        <View style={styles.frontAgentCard}>
          <AgentPhoto url={agent.photoUrl} name={agent.name} size={56} />
          <View style={styles.frontAgentInfo}>
            <Text style={styles.frontAgentName}>{agent.name}</Text>
            {agent.title && <Text style={styles.frontAgentDetail}>{agent.title}</Text>}
            {agent.phone && <Text style={styles.frontAgentDetail}>{agent.phone}</Text>}
            {agent.email && <Text style={styles.frontAgentDetail}>{agent.email}</Text>}
          </View>
          {agent.hubUrl && (
            <View style={styles.frontAgentQrCard}>
              <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(agent.hubUrl)}`} style={styles.frontAgentQrImage} />
              <Text style={styles.frontAgentQrCaption}>Scan for my Agent Hub</Text>
            </View>
          )}
        </View>
      </Page>

      <Page size="LETTER" style={styles.sheetPage}>
        <View style={styles.backHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetHeading}>{formatAddress(property.address, property.city || '')}</Text>
            <Text style={styles.sheetSubheading}>Open House Guide</Text>
          </View>
          {!!property.price && <Text style={styles.backHeaderPrice}>${Number(property.price).toLocaleString()}</Text>}
        </View>

        {property.description && <Text style={styles.descriptionText}>{truncateAtSentence(property.description, 320)}</Text>}

        <Text style={styles.sectionLabel}>Basic Info</Text>
        <InfoLineRow items={basicInfo} />

        <Text style={styles.sectionLabel}>Property Info</Text>
        <InfoLineRow items={propertyInfoLine} />
        <View style={[styles.factTileGrid, { marginTop: 10 }]}>
          {propertyInfo.map(fact => <FactTile key={fact.label} icon={fact.icon} label={fact.label} value={fact.value} wide={fact.wide} />)}
        </View>

        {hasAmenities && (
          <View style={styles.amenitiesSection}>
            <Text style={styles.sectionLabel}>What's Nearby</Text>
            <View style={[styles.salesGrid, { marginTop: 8 }]}>
              <View style={{ width: '48%' }}>
                <AmenityCategory label="Nearby Private Schools" places={amenities!.private_schools} maxItems={amenityItemCap} />
                <AmenityCategory label="Grocery Stores Nearby" places={amenities!.grocery_stores} maxItems={amenityItemCap} />
                <AmenityCategory label="Parks Nearby" places={amenities!.parks} maxItems={amenityItemCap} />
              </View>
              <View style={{ width: '48%' }}>
                <AmenityCategory label="Medical Care Nearby" places={amenities!.medical_care} maxItems={amenityItemCap} />
                <AmenityCategory label="Major Airports Nearby" places={amenities!.airports} maxItems={amenityItemCap} />
                <AmenityCategory label="Nearby Downtown Areas" places={amenities!.downtown_areas} maxItems={amenityItemCap} />
              </View>
            </View>
          </View>
        )}
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
