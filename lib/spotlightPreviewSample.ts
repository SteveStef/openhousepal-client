// A real sale of Peter Stefanatos (1 Dovecote Ln, Malvern - from his Recent Sales), frozen as a
// Spotlight resolve payload so the editor's theme Preview renders either template with a complete,
// finished-looking page for any agent. site_id 'preview' makes the lead form and the view beacon
// no-ops (see LeadForm.tsx / SpotlightViewBeacon.tsx), and Explore Nearby is switched off so a
// preview never spends Google Places calls. Town photo: Wikimedia Commons (credited on the page).
import type { PropertySiteResolveResponse } from '@/components/property-sites/spotlight/model'

export const SPOTLIGHT_PREVIEW_SAMPLE: PropertySiteResolveResponse = {
  "site_id": "preview",
  "slug": "preview",
  "template_id": "cinematic_luxury",
  "property": {
    "beds": 6.0,
    "city": "MALVERN",
    "sqft": 10706.0,
    "baths": 8.5,
    "price": 2455000.0,
    "state": "PA",
    "county": "CHESTER-PA",
    "photos": [
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/0748/804938610748_1440_1080_WM_hORVk9qbkTPAYaUV.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/6680/804938616680_1440_1080_WM_IkBDqN9bgH1gerSI.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/6866/804938616866_1440_1080_WM_9gj9LMYI3RcWYJ-0.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/0980/804938610980_1440_1080_WM_l3_hXroMSSKnYALZ.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/6744/804938616744_1440_1080_WM_uj7Nk4Vhu6WUnAVS.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/2234/804938612234_1440_1080_WM_sUNPFF8TO8mVYfQe.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/6822/804938616822_1440_1080_WM_jeut1goFoBjXMyHz.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/7372/804938617372_1440_1080_WM_I8MWSm9GGSg8ZKeD.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/3188/804938613188_1440_1080_WM_Ki-q0qLfptzQgZTG.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/2150/804938612150_1440_1080_WM_jog_xVp-SejA0gYd.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/6580/804938616580_1440_1080_WM_hm4bvEpzugGp7gP9.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/2356/804938612356_1440_1080_WM_Xrix_mUqVeMdz_Mp.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/6492/804938616492_1440_1080_WM_xrqOz1lIzsNWONpg.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/0448/804938610448_1440_1080_WM_xq3RwU_u8mXfsv8z.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/2800/804938612800_1440_1080_WM_u4l_Sx2HHmYYjXD_.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/1992/804938611992_1440_1080_WM_dgqNlLnsJ7iT44C8.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/5428/804938615428_1440_1080_WM_BliUswfETCpi7p2b.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/5008/804938615008_1440_1080_WM_QZVOYK73eucmQfWa.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/5144/804938615144_1440_1080_WM_MoOWtBgYAVcNjWs4.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/4496/804938614496_1440_1080_WM_Kd6174nJ80VLOEAL.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/2070/804938612070_1440_1080_WM_WFVggJJuVLxrSLCV.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/7204/804938617204_1440_1080_WM_7ixfM1ZiVelXKnsX.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/7460/804938617460_1440_1080_WM_bUE-Pvz2ygnxtAqT.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/6420/804938616420_1440_1080_WM_hzgtrUVfxyUDWSlR.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/1386/804938611386_1440_1080_WM_mjbwj0DOO-KM6bJ2.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/5256/804938615256_1440_1080_WM_ORcWcF9WrDmegR1a.jpg",
      "http://bright-media01.prd.brightmls.com/bright/images/0000/8049/3861/5710/804938615710_1440_1080_WM_34fNdmI7R-Y5s-4I.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/4576/804938614576_1440_1080_WM_O8IlEq1Ik3d8qalU.jpg",
      "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/5974/804938615974_1440_1080_WM_ia_RJzQyBsXA8OaG.jpg"
    ],
    "status": "CLOSED-BRIGHT",
    "address": "1 DOVECOTE LN",
    "stories": null,
    "zipcode": "19355",
    "features": {
      "other": [
        "Level"
      ],
      "exterior": [
        "Exterior Lighting",
        "Extensive Hardscape"
      ],
      "interior": [
        "Additional Stairway",
        "Attic",
        "Bar",
        "Bathroom - Soaking Tub",
        "Bathroom - Walk-In Shower",
        "Breakfast Area",
        "Built-Ins",
        "Butlers Pantry",
        "Chair Railings",
        "Crown Moldings",
        "Central Vacuum",
        "Ceiling Fan(s)",
        "Kitchen - Island",
        "Pantry",
        "Primary Bath(s)",
        "Walk-in Closet(s)",
        "Wood Floors"
      ],
      "community": [],
      "lifestyle": [
        "Wine Storage"
      ]
    },
    "latitude": 40.0136767,
    "lot_size": 90169.0,
    "township": "WILLISTOWN",
    "home_type": "SINGLE_FAMILY",
    "longitude": -75.5186054,
    "has_garage": true,
    "mls_number": "PACT2125962",
    "year_built": 2003,
    "description": "Welcome to 1 Dovecote Lane, a stately 6-bedroom, 8.5-bath residence set on two beautifully landscaped acres in highly sought-after Willistown Township. Blending timeless craftsmanship with thoughtfully updated amenities, this exceptional home offers elegant living spaces, refined finishes, and a layout designed for both everyday living and large-scale entertaining. A grand foyer introduces the home with limestone flooring, raised panel wainscoting, and a sweeping curved staircase. Formal living and dining rooms flank the entry, each richly appointed with detailed millwork, custom finishes, and elegant entertaining spaces. The dining room is accented by a tray ceiling, plantation shutters, and recently installed designer wallpaper, while the formal living room features built-ins and a gas fireplace with marble surround. At the heart of the home, the dramatic two-story great room showcases a coffered ceiling, floor-to-ceiling stone wood-burning fireplace, and custom built-in bookcases. Just beyond, a sun-filled sunroom offers a peaceful retreat overlooking the property. Designed to impress both serious chefs and avid entertainers, the gourmet kitchen features granite countertops and backsplash, a Sub-Zero refrigerator, Wolf range, abundant cabinetry, walk-in pantry, and a butlerâ€™s pantry complete with sink and wine cooler. The adjoining breakfast area opens seamlessly to the homeâ€™s exceptional outdoor living spaces, including a Trex deck overlooking the fully fenced rear yard and a flagstone patio with built-in grill and cooking station. Privately tucked off the main living spaces, the richly finished study features custom cherry cabinetry, detailed millwork, wainscoting, and a gas fireplace with marble surround. The main level is further complemented by a spacious laundry room, mudroom with full bath access, additional half bathroom, and oversized 4-car garage with latex-coated flooring. Upstairs, the expansive primary suite serves as a luxurious private retreat with a sitting room, tray ceiling, dual walk-in closets with dressing area, and a spa-inspired bath featuring marble floors, granite-topped vanities, whirlpool tub, oversized shower, and private water closet. Four additional en-suite bedrooms complete the second level, each generously sized with designer tile, Kohler fixtures, and custom closet systems. The third floor offers flexible living space with a sixth bedroom, full bath, and sitting area ideal for guests, au pair, or extended family accommodations. The finished walk-up lower level was designed with entertaining and recreation in mind, featuring a custom bar, spacious recreation and game areas, full bath, home gym, and an impressive home theater with updated projector, speakers, amplifier, and sound system. A dedicated dance studio with mirrored walls and professional-grade cherry sprung flooring adds a truly unique finishing touch. Additional recent improvements include dual 20kW natural gas generators, updated paint and lighting, new first-floor HVAC system, newer water heater (2025), WiFi-controlled outdoor lighting and thermostats, and a fully fenced wrought iron rear yard. Offering a rare combination of scale, craftsmanship, comfort, and location within the highly regarded Great Valley School District â€” while also providing convenient access to many of the regionâ€™s prestigious private schools â€” and just minutes from Malvern, 1 Dovecote Lane presents an exceptional opportunity in one of Chester Countyâ€™s most desirable settings. Please note some photos have been virtually edited/staged.",
    "high_school": "GREAT VALLEY",
    "listing_key": "804938530996",
    "garage_spaces": 4.0,
    "property_type": "Residential",
    "lot_size_acres": 2.07,
    "association_fee": null,
    "has_association": false,
    "list_office_name": "Keller Williams Real Estate -Exton",
    "subdivision_name": "DOVECOTE",
    "unparsed_address": "PA,CHESTER",
    "elementary_school": "SUGARTOWN",
    "architectural_style": [
      "Traditional"
    ],
    "original_list_price": null,
    "school_district_name": "GREAT VALLEY",
    "middle_or_junior_school": "GREAT VALLEY",
    "association_fee_frequency": null,
    "days_on_market": 15,
    "price_changed_at": null,
    "listed_at": "2026-05-21T04:00:00+00:00",
    "tax_annual_amount": 38719.0,
    "tax_year": 2025,
    "heating": [
      "Forced Air"
    ],
    "cooling": [
      "Central A/C"
    ],
    "flooring": [
      "Hardwood",
      "Tile/Brick",
      "Carpet"
    ],
    "basement": [
      "Fully Finished",
      "Walkout Stairs"
    ],
    "parking_features": [
      "Circular Driveway"
    ],
    "fireplaces": 3,
    "water_source": [
      "Public"
    ],
    "sewer": [
      "Public Sewer"
    ],
    "new_construction": false
  },
  "content": {
    "chapters": [],
    "hero_image": "http://bright-media02.prd.brightmls.com/bright/images/0000/8049/3861/0748/804938610748_1440_1080_WM_hORVk9qbkTPAYaUV.jpg",
    "highlights": [
      "Two Acres, Willistown Township",
      "Limestone Foyer, Curved Staircase",
      "Two-Story Coffered Ceiling Fireplace",
      "Sub-Zero, Wolf Range Kitchen",
      "Primary Suite, Dual Walk-In Closets",
      "Custom Dance Studio, Sprung Flooring",
      "Finished Lower Level, Home Theater",
      "Dual 20kW Natural Gas Generators"
    ],
    "story_mode": "short",
    "town_story": {
      "body": "",
      "name": "Malvern",
      "facts": {
        "tagline": "Historic King Street charm meets easy access to Philadelphia.",
        "downtown": {
          "name": "King Street",
          "where": "Malvern borough center, Chester County, PA",
          "highlights": [
            "Independent shops and cafes",
            "Restaurants and coffee houses",
            "Seasonal community events"
          ]
        },
        "outdoors": [
          "Valley Forge National Historical Park",
          "Ashbridge Preserve",
          "Kirkwood Preserve"
        ],
        "why_move": [
          "Commuter rail access to Center City Philadelphia",
          "Close proximity to parks and preserves",
          "Convenient access to Route 30 and the PA Turnpike"
        ],
        "known_for": [
          "King Street shops and restaurants",
          "Chester County horse country",
          "Proximity to Valley Forge National Historical Park",
          "SEPTA Paoli/Thorndale Line access"
        ],
        "whats_new": "",
        "getting_around": [
          {
            "label": "Center City Philadelphia",
            "detail": "about 35 min by car"
          },
          {
            "label": "SEPTA Paoli/Thorndale Line",
            "detail": "direct service from Malvern Station"
          },
          {
            "label": "PA Turnpike (I-276)",
            "detail": "a few minutes by car"
          }
        ]
      },
      "hidden": false,
      "photo": {
        "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Malvern_Station_--_May_2023_%282%29.jpg/1920px-Malvern_Station_--_May_2023_%282%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        "credit": "Photo: Tilden1876 · CC BY-SA 4.0",
        "caption": "Malvern Train Station",
        "source_url": "https://commons.wikimedia.org/wiki/File:Malvern_Station_--_May_2023_(2).jpg"
      }
    },
    "open_houses": [],
    "photo_order": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28
    ],
    "story_short": "A limestone foyer anchored by a sweeping curved staircase sets the tone at 1 Dovecote Lane, a six-bedroom residence commanding two landscaped acres in Willistown Township. Formal living and dining rooms flank the entry; the great room rises two stories beneath a coffered ceiling and anchors a stone fireplace with custom built-ins. The gourmet kitchen flows seamlessly through a sunroom and onto a Trex deck overlooking the fenced rear yard, where a flagstone patio hosts a built-in cooking station. A richly appointed study, mudroom, and four-car garage complete the main level.\n\nUpstairs, the primary suite unfolds as a private retreat with sitting room, dual walk-in closets, and spa bath featuring marble and whirlpool tub. Four additional en-suite bedrooms occupy the second floor. The third floor guest suite and finished lower levelâ€”featuring bar, recreation areas, home theater, and a mirrored dance studio with sprung flooringâ€”extend living possibilities. Recent upgrades include dual generators, updated HVAC, new water heater, and controlled outdoor systems.",
    "notable_facts": [],
    "virtual_tour_url": null,
    "featured_amenities": [
      "Wine Storage",
      "Butlers Pantry",
      "Bar",
      "Bathroom - Soaking Tub",
      "Bathroom - Walk-In Shower",
      "Primary Bath(s)",
      "Extensive Hardscape"
    ],
    "section_visibility": {
      "story": true,
      "video": false,
      "agents": true,
      "gallery": true,
      "features": true,
      "location": true,
      "documents": false,
      "floor_plans": false,
      "open_houses": false,
      "virtual_tour": false,
      "explore_nearby": false
    },
    "description_override": "A limestone foyer anchored by a sweeping curved staircase sets the tone at 1 Dovecote Lane, a six-bedroom residence commanding two landscaped acres in Willistown Township. Formal living and dining rooms flank the entry; the great room rises two stories beneath a coffered ceiling and anchors a stone fireplace with custom built-ins. The gourmet kitchen flows seamlessly through a sunroom and onto a Trex deck overlooking the fenced rear yard, where a flagstone patio hosts a built-in cooking station. A richly appointed study, mudroom, and four-car garage complete the main level.\n\nUpstairs, the primary suite unfolds as a private retreat with sitting room, dual walk-in closets, and spa bath featuring marble and whirlpool tub. Four additional en-suite bedrooms occupy the second floor. The third floor guest suite and finished lower levelâ€”featuring bar, recreation areas, home theater, and a mirrored dance studio with sprung flooringâ€”extend living possibilities. Recent upgrades include dual generators, updated HVAC, new water heater, and controlled outdoor systems.",
    "header": {
      "mode": "photo",
      "motion": "out"
    }
  },
  "video": null,
  "agents": [
    {
      "name": "Peter Stefanatos",
      "title": "Real Estate Agent",
      "phone": "6107817003",
      "email": "peter.stefanatos@compass.com",
      "brokerage": "COMPASS RE",
      "license_number": "RS375452",
      "photo_url": "https://dk5bvrzdygq8w.cloudfront.net/agent-photos/8d192d09-f7d2-4cdb-8bbc-5820d39b4d22.jpg",
      "bio": "I focus on protecting my clients through careful valuation analysis and thorough due diligence. My goal is to help clients fully understand what they are purchasing and identify potential risks before they commit.",
      "hub_url": "http://localhost:3000/peter-stefanatos"
    }
  ],
  "brand_kit": {
    "primary_color": "#111827",
    "secondary_color": "#C9A24D",
    "logo_url": null
  },
  "canonical_hostname": null
} as unknown as PropertySiteResolveResponse
