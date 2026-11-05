export type Article = {
  slug: string; title: string; description: string; minutes: number; date: string; topic: string
  tool: { href: string; label: string }
  sections: { h?: string; p: string[] }[]
}

// Articles for agents on openhousepal.com (owner, 11/05). Practical advice in plain words, with no
// made-up statistics. Written for agents, not home buyers.
export const ARTICLES: Article[] = [
  {
    slug: 'how-to-run-an-open-house-that-gets-leads', title: 'How to run an open house that gets leads', topic: 'Open houses', minutes: 5, date: '2026-11-05',
    description: 'A practical plan for real estate agents: what to do before, during and after an open house so more visitors turn into real leads.',
    tool: { href: '/tools/open-house-sign-in', label: 'See Open House Sign-In' },
    sections: [
      { p: ['An open house is one of the few times strangers walk up to you and start talking about real estate. Most of the value is not in selling that home. It is in meeting people who are buying, selling or thinking about it, and staying in touch with them.', 'The agents who get leads from open houses treat each one as a small project with three parts: before, during and after.'] },
      { h: 'Before: give people a reason to come', p: ['Start a few days ahead. Post the home on your social accounts, tell the neighbors, and put signs out early enough that people see them on their way home.', 'Inviting the neighbors matters more than it sounds. Neighbors are curious, they know people who might move, and some of them are quietly wondering what their own home is worth.', 'Learn the area before you walk in. Know the schools, nearby sales, commute times and what else is for sale nearby. Visitors remember the agent who could answer their question.'] },
      { h: 'During: make signing in easy', p: ['Put your sign-in right at the door, and greet people before you ask them for anything. A QR code they scan on their own phone is quicker than a clipboard, and you get details you can read.', 'Ask simple questions instead of pitching. How long have you been looking? Do you have a home to sell first? Are you working with an agent? Their answers tell you exactly how to follow up.', 'Keep something useful to hand them, like a sheet on the home and a list of similar homes nearby. It gives them a reason to keep your name.'] },
      { h: 'After: follow up while they remember you', p: ['Most open house leads are lost after the event, not during it. Reach out the same day if you can, and mention something specific from your conversation.', 'For buyers without an agent, send homes that match what they told you. For neighbors, offer a home value. For everyone else, stay in touch with something useful instead of asking for their business.'] },
      { h: 'The short version', p: ['Invite people early, make signing in easy, ask good questions and follow up the same day. Do that every time and open houses stop being a Sunday chore and start being a lead source.'] },
    ],
  },
  {
    slug: 'what-to-do-in-the-48-hours-after-an-open-house', title: 'What to do in the 48 hours after an open house', topic: 'Follow-up', minutes: 4, date: '2026-11-05',
    description: 'A simple follow-up plan for the two days after an open house, so real estate agents keep the leads they worked for.',
    tool: { href: '/tools/showcases', label: 'See Showcases' },
    sections: [
      { p: ['The hours after an open house are when your visitors remember you best. A short, personal follow-up in that window does more than a dozen generic emails a month later.'] },
      { h: 'The same day: sort your visitors', p: ['Before you do anything else, sort your sign-ins into three groups: active buyers without an agent, neighbors and possible sellers, and people who already have an agent.', 'If someone told you they have an agent, respect that. A short thank you is plenty.'] },
      { h: 'The same day: send a personal note', p: ['A text or email that mentions something real from your conversation stands out. Mention the kitchen they loved or the school they asked about. Keep it to a few lines and answer any question they left with.'] },
      { h: 'The next day: give each group something useful', p: ['Buyers want homes. Send a few that fit what they told you, or set them up with a search that keeps sending matches so you stay part of their search.', 'Neighbors want to know what their home is worth. Offer a quick home value or a note on what the open house home is doing.', 'Share feedback with your seller too. Tell them how many people came and what they said. Sellers notice agents who report back.'] },
      { h: 'By day two: put the next step on your calendar', p: ['Every lead needs a next date. Set a reminder to check in, even if it is weeks away. The agents who win these leads are often simply the ones who remembered to call back.'] },
    ],
  },
  {
    slug: 'how-to-present-a-cma-sellers-trust', title: 'How to present a CMA sellers trust', topic: 'Listing appointments', minutes: 4, date: '2026-11-05',
    description: 'How real estate agents can choose comps, explain pricing and walk a seller through a CMA without losing their trust.',
    tool: { href: '/tools/cma', label: 'See CMA' },
    sections: [
      { p: ['A seller rarely argues with the math. They argue with a number they do not understand. A good CMA presentation shows how you got there, so the price feels like a shared conclusion instead of your opinion.', 'Keep in mind that a CMA is a market analysis, not a formal appraisal, and say so.'] },
      { h: 'Choose comps you can defend', p: ['Use recent sales that a buyer would really compare with this home: the same area, a similar size and a similar condition. A few strong comps beat a long list of weak ones.', 'Be ready to explain every comp you left out. Sellers often know the neighbor\'s sale, and you want to have an answer before they ask.'] },
      { h: 'Walk through it in order', p: ['Start with the market right now, then the homes that sold, then what is competing today, and finish with the price. If you open with the number, the seller stops listening to everything after it.'] },
      { h: 'Talk about differences honestly', p: ['Explain what makes this home better or worse than each comp. Sellers trust an agent who points out the weak spots as well as the strong ones.'] },
      { h: 'Give a range and a plan', p: ['Show where the data supports a price and what you expect at different points in that range. Then explain what you will do if the market says something different after launch.', 'Leave them with something they can reread. A clean PDF or a link helps a seller talk it through at home, and it keeps your reasoning in front of them.'] },
    ],
  },
]
