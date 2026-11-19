// Articles for agents on openhousepal.com (owner, 11/05). Practical advice in plain words, with no
// made-up statistics. Written for agents, not home buyers.
// 11/18 (owner): read like the real blogs - short paragraphs, lists, numbered steps, tips and a pull
// quote, with key takeaways up top - and more articles. Every tool link goes to a real Tools page.

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'tip'; text: string }
  | { kind: 'quote'; text: string }

export type Article = {
  slug: string; title: string; description: string; minutes: number; date: string; topic: string
  tool: { href: string; label: string }
  takeaways: string[]
  sections: { h?: string; blocks: Block[] }[]
}

const P = (text: string): Block => ({ kind: 'p', text })
const L = (items: string[]): Block => ({ kind: 'list', items })
const S = (items: string[]): Block => ({ kind: 'steps', items })
const T = (text: string): Block => ({ kind: 'tip', text })
const Q = (text: string): Block => ({ kind: 'quote', text })

export const ARTICLES: Article[] = [
  {
    slug: 'how-to-run-an-open-house-that-gets-leads', title: 'How to run an open house that gets leads', topic: 'Open houses', minutes: 5, date: '2026-11-05',
    description: 'A practical plan for real estate agents: what to do before, during and after an open house so more visitors turn into real leads.',
    tool: { href: '/tools/open-house-sign-in', label: 'See Open House Sign-In' },
    takeaways: ['Invite people a few days early, starting with the neighbors.', 'Make signing in quick, and ask questions instead of pitching.', 'Follow up the same day, and mention something specific.'],
    sections: [
      { blocks: [
        P('An open house is one of the few times strangers walk up to you and start talking about real estate.'),
        P('Most of the value isn’t in selling that home. It’s in meeting people who are buying, selling or thinking about it, and staying in touch with them.'),
        Q('Treat every open house as a small project with three parts: before, during and after.'),
      ] },
      { h: 'Before: give people a reason to come', blocks: [
        P('Start a few days ahead, so people see it on their way home.'),
        L(['Post the home on your social accounts.', 'Tell the neighbors, in person or with a note.', 'Put signs out early, not the morning of.']),
        P('Inviting the neighbors matters more than it sounds. They’re curious, they know people who might move, and some are quietly wondering what their own home is worth.'),
        T('Learn the area before you walk in: schools, nearby sales, commute times and what else is for sale. Visitors remember the agent who could answer their question.'),
      ] },
      { h: 'During: make signing in easy', blocks: [
        P('Put your sign-in right at the door, and greet people before you ask them for anything.'),
        P('A QR code they scan on their own phone is quicker than a clipboard, and you get details you can actually read.'),
        P('Then ask simple questions instead of pitching:'),
        L(['How long have you been looking?', 'Do you have a home to sell first?', 'Are you working with an agent?']),
        P('Their answers tell you exactly how to follow up. Hand them something useful too, like a sheet on the home and a list of similar homes nearby.'),
      ] },
      { h: 'After: follow up while they remember you', blocks: [
        P('Most open house leads are lost after the event, not during it.'),
        P('Reach out the same day if you can, and mention something specific from your conversation.'),
        L(['Buyers without an agent: send homes that match what they told you.', 'Neighbors: offer a home value.', 'Everyone else: stay in touch with something useful, not a request for their business.']),
      ] },
      { h: 'The short version', blocks: [
        S(['Invite people early.', 'Make signing in easy.', 'Ask good questions.', 'Follow up the same day.']),
        P('Do that every time, and open houses stop being a Sunday chore and start being a lead source.'),
      ] },
    ],
  },
  {
    slug: 'what-to-do-in-the-48-hours-after-an-open-house', title: 'What to do in the 48 hours after an open house', topic: 'Follow-up', minutes: 4, date: '2026-11-05',
    description: 'A simple follow-up plan for the two days after an open house, so real estate agents keep the leads they worked for.',
    tool: { href: '/tools/showcases', label: 'See Showcases' },
    takeaways: ['Sort your visitors the same day: buyers, neighbors, and people with an agent.', 'Send each person a short, personal note.', 'Put a next step on your calendar for every lead.'],
    sections: [
      { blocks: [
        P('The hours after an open house are when your visitors remember you best.'),
        P('A short, personal follow-up in that window does more than a dozen generic emails a month later.'),
      ] },
      { h: 'The same day: sort your visitors', blocks: [
        P('Before anything else, sort your sign-ins into three groups:'),
        L(['Active buyers without an agent', 'Neighbors and possible sellers', 'People who already have an agent']),
        T('If someone told you they have an agent, respect that. A short thank you is plenty.'),
      ] },
      { h: 'The same day: send a personal note', blocks: [
        P('A text or email that mentions something real from your conversation stands out.'),
        P('Mention the kitchen they loved or the school they asked about. Keep it to a few lines, and answer any question they left with.'),
      ] },
      { h: 'The next day: give each group something useful', blocks: [
        L(['Buyers want homes. Send a few that fit what they told you, or set them up with a search that keeps sending matches.', 'Neighbors want to know what their home is worth. Offer a quick home value.', 'Your seller wants feedback. Tell them how many people came and what they said.']),
        Q('Sellers notice the agents who report back.'),
      ] },
      { h: 'By day two: put the next step on your calendar', blocks: [
        P('Every lead needs a next date, even if it’s weeks away.'),
        P('The agents who win these leads are often simply the ones who remembered to call back.'),
      ] },
    ],
  },
  {
    slug: 'how-to-present-a-cma-sellers-trust', title: 'How to present a CMA sellers trust', topic: 'Listing appointments', minutes: 4, date: '2026-11-05',
    description: 'How real estate agents can choose comps, explain pricing and walk a seller through a CMA without losing their trust.',
    tool: { href: '/tools/cma', label: 'See CMA' },
    takeaways: ['Pick a few strong comps you can defend.', 'Walk through the market first and the price last.', 'Give a range and a plan, plus something they can reread.'],
    sections: [
      { blocks: [
        P('A seller rarely argues with the math. They argue with a number they don’t understand.'),
        P('A good CMA presentation shows how you got there, so the price feels like a shared conclusion instead of your opinion.'),
        T('A CMA is a market analysis, not a formal appraisal. Say so.'),
      ] },
      { h: 'Choose comps you can defend', blocks: [
        P('Use recent sales a buyer would really compare with this home:'),
        L(['The same area', 'A similar size', 'A similar condition']),
        P('A few strong comps beat a long list of weak ones. Be ready to explain every comp you left out, because sellers often know the neighbor’s sale.'),
      ] },
      { h: 'Walk through it in order', blocks: [
        S(['The market right now', 'The homes that sold', 'What’s competing today', 'The price']),
        Q('If you open with the number, the seller stops listening to everything after it.'),
      ] },
      { h: 'Talk about differences honestly', blocks: [
        P('Explain what makes this home better or worse than each comp.'),
        P('Sellers trust an agent who points out the weak spots as well as the strong ones.'),
      ] },
      { h: 'Give a range and a plan', blocks: [
        P('Show where the data supports a price, and what you expect at different points in that range.'),
        P('Then explain what you’ll do if the market says something different after launch.'),
        T('Leave them something to reread, like a clean PDF or a link. It helps them talk it through at home and keeps your reasoning in front of them.'),
      ] },
    ],
  },
  {
    slug: '10-questions-to-ask-open-house-visitors', title: '10 questions to ask open house visitors', topic: 'Open houses', minutes: 4, date: '2026-11-18',
    description: 'Easy questions real estate agents can ask at an open house to start a real conversation and know exactly how to follow up.',
    tool: { href: '/tools/open-house-sign-in', label: 'See Open House Sign-In' },
    takeaways: ['Lead with easy, friendly questions about the home.', 'Find out where they are in their move before you suggest anything.', 'Keep it about the home search, never about who they are.'],
    sections: [
      { blocks: [
        P('Most visitors expect a sales pitch. A good question surprises them, and gets them talking.'),
        P('These ten work at almost any open house. You don’t need all of them. Pick the few that fit the conversation.'),
      ] },
      { h: 'Start easy', blocks: [
        S(['What brought you in today?', 'What do you think of the kitchen?', 'Is this the kind of neighborhood you’re looking in?']),
        P('Easy questions about the home lower everyone’s guard, including yours.'),
      ] },
      { h: 'Find out where they are', blocks: [
        S(['How long have you been looking?', 'Do you have a home to sell first?', 'Are you working with an agent?', 'When would you like to be moved in?']),
        T('If they already have an agent, thank them and let them enjoy the home. Their agent will remember you treated them well.'),
      ] },
      { h: 'Find what matters to them', blocks: [
        S(['What would make a home perfect for you?', 'Which homes have you liked so far, and why?', 'Can I send you homes like this one?']),
        P('That last one is your follow-up, asked as a favor.'),
      ] },
      { h: 'Keep it fair', blocks: [
        P('Ask about the home search, not about the people.'),
        L(['Don’t ask about family plans, religion, background or other personal details.', 'Don’t steer anyone toward or away from a neighborhood.', 'Answer questions about schools and the area with facts and sources.']),
        Q('Good questions are about what they want in a home, never about who they are.'),
      ] },
    ],
  },
  {
    slug: 'how-to-turn-open-house-neighbors-into-listings', title: 'How to turn open house neighbors into listings', topic: 'Listing leads', minutes: 4, date: '2026-11-18',
    description: 'Neighbors who visit an open house are often future sellers. How real estate agents can invite them, talk with them and stay in touch.',
    tool: { href: '/tools/forms', label: 'See Forms' },
    takeaways: ['Invite the neighbors before anyone else.', 'Answer the question they came with: what is my home worth?', 'Stay in touch with useful local news, not pitches.'],
    sections: [
      { blocks: [
        P('Many of the people at your open house live a few streets away.'),
        P('Some are just curious. Some are quietly wondering what their own home would sell for. Either way, they’re the best listing leads you’ll meet all weekend.'),
      ] },
      { h: 'Invite them first', blocks: [
        P('A few days before, leave a short note on nearby doors, or knock and say hello.'),
        L(['The address and the open house time', 'One line about the home', 'An offer to share what homes nearby are selling for']),
        T('Neighbors who get a personal invitation remember the agent who asked.'),
      ] },
      { h: 'At the open house: talk about their home', blocks: [
        P('When a neighbor walks in, the conversation changes. They want to compare.'),
        P('Ask what they’ve done to their own home, and how this one compares. Then offer something they can’t get from a website: a real look at what their home could sell for.'),
        Q('Every neighbor has the same question: what would mine sell for?'),
      ] },
      { h: 'After: give them a reason to remember you', blocks: [
        S(['Send the home value you offered, within a day or two.', 'Tell them when the open house home goes under contract or sells.', 'Share a short note on the neighborhood a few times a year.']),
        P('None of this asks for their business. It just keeps your name in front of them for the day they’re ready.'),
      ] },
    ],
  },
  {
    slug: 'how-to-follow-up-with-a-lead-who-went-quiet', title: 'How to follow up with a lead who went quiet', topic: 'Follow-up', minutes: 4, date: '2026-11-18',
    description: 'What real estate agents can send when a buyer or seller stops replying, so the conversation starts again without feeling pushy.',
    tool: { href: '/tools/showcases', label: 'See Showcases' },
    takeaways: ['Quiet usually means busy, not no.', 'Lead with something useful, not “just checking in”.', 'Space out your messages and give them an easy way to answer.'],
    sections: [
      { blocks: [
        P('Leads go quiet all the time. Life gets busy, plans change, and a home search slides down the list.'),
        P('Most of the time, quiet doesn’t mean no. It means not right now.'),
      ] },
      { h: 'Don’t just check in', blocks: [
        P('“Just checking in” asks them to do the work. Give them something instead:'),
        L(['A new home that fits what they told you', 'A price drop on a home they liked', 'A recent sale near a home they own']),
        Q('Give them a reason to reply, not a reminder that they haven’t.'),
      ] },
      { h: 'Make it easy to answer', blocks: [
        P('End with a question they can answer in one word.'),
        L(['“Still looking in the same area?”', '“Want me to keep sending homes like this?”', '“Should I check back in the spring?”']),
        T('If they say not now, ask when to check back, and put that date on your calendar.'),
      ] },
      { h: 'Space it out', blocks: [
        S(['A useful note now', 'Another in a couple of weeks', 'Then a light touch every month or two']),
        P('Keep sending only what’s relevant. A buyer who keeps getting good matches often comes back on their own.'),
      ] },
      { h: 'Know when to stop', blocks: [
        P('If someone asks you to stop, stop, and thank them.'),
        P('Leaving on good terms is how agents get the referral later.'),
      ] },
    ],
  },
  {
    slug: 'how-to-get-more-reviews-from-happy-clients', title: 'How to get more reviews from happy clients', topic: 'Reviews', minutes: 3, date: '2026-11-18',
    description: 'When and how real estate agents should ask for reviews on Google and Zillow, and how to make it easy for clients to say yes.',
    tool: { href: '/tools/review-hub', label: 'See Review Hub' },
    takeaways: ['Ask at the happiest moment, like closing day.', 'Send one link, so it takes a minute.', 'Thank every reviewer, and never pay for reviews.'],
    sections: [
      { blocks: [
        P('Most happy clients are glad to leave a review. They just never get around to it.'),
        P('Your job is to ask at the right moment and make it take a minute.'),
      ] },
      { h: 'Ask at the right time', blocks: [
        P('The best moments are when they’re happiest:'),
        L(['The day they get the keys', 'When an offer is accepted', 'Right after they thank you']),
        T('Ask in person first, then send the link the same day while the feeling is fresh.'),
      ] },
      { h: 'Make it one tap', blocks: [
        P('A long set of instructions loses people. Send one link that takes them straight to where they leave the review.'),
        P('Tell them it only takes a minute, and that a sentence or two is plenty.'),
      ] },
      { h: 'Follow the rules', blocks: [
        P('Review sites like Google don’t allow you to offer gifts or discounts for a review.'),
        P('Ask every happy client, not just the ones you expect to be glowing. Honest reviews read as real.'),
        Q('A steady trickle of real reviews beats a burst of perfect ones.'),
      ] },
      { h: 'Say thank you', blocks: [
        P('Reply to every review, briefly and personally.'),
        P('Future clients read your replies too, and they show you care after the deal is done.'),
      ] },
    ],
  },
]
