'use client'

import dynamic from 'next/dynamic'

// The IDX site route's page-specific client components, each in its own chunk. next/dynamic has to
// live in a client module for this: called from the (server) site route it still bundled every
// one of them into every page (1.7 MB of JS on the home page, 10/19). Still rendered on the server.

export const OpenHouseFrame = dynamic(() => import('@/components/public-site/OpenHouseFrame'))
export const TownSectionNav = dynamic(() => import('@/components/website-public/TownSectionNav'))
export const TownLiving = dynamic(() => import('@/components/website-public/TownLiving'))
export const TownInsights = dynamic(() => import('@/components/website-public/TownInsights'))
export const TownCommute = dynamic(() => import('@/components/website-public/TownCommute'))
export const TownMap = dynamic(() => import('@/components/website-public/TownMap'))
export const TownWalk = dynamic(() => import('@/components/website-public/TownWalk'))
export const PropertyGallery = dynamic(() => import('@/components/website-public/PropertyGallery'))
export const FeaturedPageClient = dynamic(() => import('@/components/website-public/FeaturedPageClient'))
export const PropertyMapSearch = dynamic(() => import('@/components/website-public/PropertyMapSearch'))
export const PropertyLocationMap = dynamic(() => import('@/components/website-public/PropertyLocationMap'))
export const ExploreNearby = dynamic(() => import('@/components/website-public/ExploreNearby'))
export const NeighborhoodCompareLauncher = dynamic(() => import('@/components/website-public/NeighborhoodCompareLauncher'))
export const WebsitePublicFormPage = dynamic(() => import('@/components/website-public/WebsitePublicFormPage'))
export const ContactPageView = dynamic(() => import('@/components/website-public/ContactPageView'))
export const NeighborhoodsExplorer = dynamic(() => import('@/components/website-public/NeighborhoodsExplorer'))
export const MediaHub = dynamic(() => import('@/components/website-public/MediaHub'))
export const SiteBlogArticle = dynamic(() => import('@/components/website-public/SiteBlogArticle'))
export const IdxPropertyPage = dynamic(() => import('@/components/website-public/IdxPropertyPage'))
export const MyShowcase = dynamic(() => import('@/components/website-public/showcase/MyShowcase'))
export const ShowcaseBuilder = dynamic(() => import('@/components/website-public/showcase/ShowcaseBuilder'))
export const CinematicLuxuryTemplate = dynamic(() => import('@/components/property-sites/CinematicLuxuryTemplate'))
export const EditorialEstateTemplate = dynamic(() => import('@/components/property-sites/EditorialEstateTemplate'))
