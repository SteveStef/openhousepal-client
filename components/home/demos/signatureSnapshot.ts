// Peter's real Email Signature, frozen exactly as he set it up (Studio -> Email Signature, saved
// 2026-10-01) but in the standard (non-Luxe) light theme, per the user: gold accent, stats on,
// featured listing + recent sales rotating. The homepage
// Signature demo renders THIS - not live data - so it stays the same forever. Photos are local
// copies (public/demos/signature) so they never break.
export const PETER_SIGNATURE = {
  "config": {
    "luxe": false,
    "banner": {
      "mode": "both",
      "ctaLabel": "View Details",
      "showStats": true,
      "showRecentSales": true,
      "showFeaturedListing": true
    },
    "fields": {
      "name": {
        "include": true
      },
      "team": {
        "value": "",
        "include": false
      },
      "email": {
        "include": true
      },
      "phone": {
        "include": true
      },
      "title": {
        "include": true
      },
      "tiktok": {
        "include": true
      },
      "company": {
        "include": true
      },
      "website": {
        "include": true
      },
      "youtube": {
        "include": true
      },
      "facebook": {
        "include": true
      },
      "headshot": {
        "include": true
      },
      "instagram": {
        "include": true
      },
      "agentHubUrl": {
        "include": true
      }
    },
    "darkMode": false,
    "template": "gallery",
    "ctaButtons": [
      {
        "id": "cta-how_can_i_help",
        "url": "",
        "label": "Ready to Buy or Sell?",
        "enabled": true,
        "formType": "how_can_i_help"
      },
      {
        "id": "cta-home_value",
        "url": "",
        "label": "What's My Home Worth?",
        "enabled": true,
        "formType": "home_value"
      }
    ],
    "fontFamily": "system",
    "accentColor": "#C9A24D",
    "blockVisibility": {
      "banner": true
    },
    "showVerifiedBadge": true
  },
  "slug": "peter-stefanatos",
  "forms": [
    {
      "form_type": "make_me_sell",
      "slug": "make-me-sell"
    },
    {
      "form_type": "selling",
      "slug": "selling"
    },
    {
      "form_type": "buying",
      "slug": "buying"
    },
    {
      "form_type": "seller_onboarding",
      "slug": "seller-onboarding"
    },
    {
      "form_type": "home_value",
      "slug": "home-value"
    },
    {
      "form_type": "buyer_onboarding",
      "slug": "buyer-onboarding"
    },
    {
      "form_type": "showing",
      "slug": "schedule-a-showing"
    },
    {
      "form_type": "how_can_i_help",
      "slug": "how-can-i-help"
    },
    {
      "form_type": "showcase_request",
      "slug": "showcase-request"
    }
  ],
  "hub": {
    "profile": {
      "name": "Peter Stefanatos",
      "title": "Real Estate Agent",
      "brokerage": "COMPASS RE"
    },
    "contact": {
      "call": "6107817003",
      "text": "6107817003",
      "email": "peter.stefanatos@compass.com"
    },
    "socialLinks": [
      {
        "id": "instagram",
        "url": " https://www.instagram.com/phillysuburbs/",
        "label": "Instagram",
        "enabled": true
      },
      {
        "id": "facebook",
        "url": " aw",
        "label": "Facebook",
        "enabled": true
      },
      {
        "id": "youtube",
        "url": "https://www.youtube.com/@PhillySuburbs",
        "label": "YouTube",
        "enabled": true
      },
      {
        "id": "tiktok",
        "url": "https://www.tiktok.com/@phillysuburb",
        "label": "TikTok",
        "enabled": true
      },
      {
        "id": "website",
        "url": " https://www.mainlinerealty.co/about",
        "label": "Website",
        "enabled": true
      }
    ],
    "profilePhotoUrl": "/demos/signature/peter.jpg",
    "profilePhotoPosition": {
      "x": 50,
      "y": 21
    },
    "salesMinPrice": 1000000,
    "myListings": [
      {
        "address": "239 Windham Dr",
        "city": "Exton",
        "state": "PA",
        "zipcode": "19341",
        "price": 1300000,
        "beds": 4,
        "baths": 4.5,
        "sqft": 5024,
        "acres": 0.59,
        "status": "COMING SOON-BRIGHT",
        "visible": true,
        "image": "/demos/spotlight/windham-hero.jpg"
      }
    ],
    "recentSales": [
      {
        "address": "5829 RIDGEVIEW DR",
        "city": "DOYLESTOWN",
        "state": "PA",
        "price": 1900000,
        "beds": 4,
        "baths": 3.5,
        "sqft": 2410,
        "acres": 0.38,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2026-07-24",
        "image": "/demos/signature/sale-1.jpg"
      },
      {
        "address": "1 DOVECOTE LN",
        "city": "MALVERN",
        "state": "PA",
        "price": 2435000,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2026-07-14",
        "image": "/demos/signature/sale-2.jpg"
      },
      {
        "address": "1614 PHILLIPS DR",
        "city": "WEST CHESTER",
        "state": "PA",
        "price": 770000,
        "status": "CLOSED-BRIGHT",
        "visible": false,
        "sold_date": "2026-01-16",
        "image": "/demos/signature/sale-3.jpg"
      },
      {
        "address": "861 KIMBERTON RD",
        "city": "CHESTER SPRINGS",
        "state": "PA",
        "price": 550000,
        "status": "CLOSED-BRIGHT",
        "visible": false,
        "sold_date": "2025-11-10",
        "image": "/demos/signature/sale-4.jpg"
      },
      {
        "address": "401 THORNBROOK AVE",
        "city": "BRYN MAWR",
        "state": "PA",
        "price": 1535000,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2025-10-30",
        "image": "/demos/signature/sale-5.jpg"
      },
      {
        "address": "1041 WAVERLY RD",
        "city": "GLADWYNE",
        "state": "PA",
        "price": 1665000,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2025-07-31",
        "image": "/demos/signature/sale-6.jpg"
      },
      {
        "address": "401 W LOCUST LN",
        "city": "KENNETT SQUARE",
        "state": "PA",
        "price": 1300000,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2025-07-21",
        "image": "/demos/signature/sale-7.jpg"
      },
      {
        "address": "279 Woodcock Ln, Ambler, PA 19008",
        "city": "Ambler",
        "state": "PA",
        "price": 1800000,
        "status": "Sold",
        "visible": true,
        "sold_date": "2025-06-30",
        "image": "/demos/signature/sale-8.jpg"
      },
      {
        "address": "1534 MOUNT PLEASANT RD",
        "city": "VILLANOVA",
        "state": "PA",
        "price": 2525000,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2025-06-23",
        "image": "/demos/signature/sale-9.jpg"
      },
      {
        "address": "112 Wilton Woods Ln, Media, PA 19063",
        "city": "Media",
        "state": "PA",
        "price": 1310000,
        "beds": 4,
        "baths": 3.5,
        "sqft": 2410,
        "acres": 0.38,
        "status": "Sold",
        "visible": true,
        "sold_date": "2025-03-22",
        "image": "/demos/signature/sale-10.jpg"
      },
      {
        "address": "617 SUGARTOWN RD",
        "city": "MALVERN",
        "state": "PA",
        "price": 1450000,
        "status": "CLOSED-BRIGHT",
        "visible": true,
        "sold_date": "2025-01-06",
        "image": "/demos/signature/sale-11.jpg"
      }
    ]
  }
} as const
