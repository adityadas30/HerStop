import { POLICY_LAST_UPDATED, SUPPORT_EMAIL } from './app-info';

/**
 * Text for the About screens. Every statement here must be backed by what the
 * app code actually does (lib/auth.ts, lib/api.ts, lib/location.ts). If the
 * code changes, change this file and docs/release/privacy-policy.md together.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  intro?: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  intro: `Last updated ${POLICY_LAST_UPDATED}. This explains what HerStop collects and what it does with it.`,
  sections: [
    {
      heading: 'Browsing as a guest',
      paragraphs: [
        'You can browse stops without an account. We do not ask for your name or email to browse.',
      ],
    },
    {
      heading: 'Your email and sign-in',
      paragraphs: [
        'If you sign in, you give us your email address. We use it to send a one-time sign-in code. Sign-in is handled by Supabase Authentication, our backend provider.',
        'Your email is used to identify your account. It is not shown to other travelers.',
      ],
    },
    {
      heading: 'Saved stops',
      paragraphs: [
        'When you are signed in, the stops you save are stored with your account so they carry over across devices.',
      ],
    },
    {
      heading: 'Reviews and reports',
      paragraphs: [
        'When signed in, you can write one review per stop. A review contains your ratings (overall feeling, lighting, restroom quality, cleanliness, staff kindness), a loitering concern level, whether you would stop again, time of visit, and an optional written note.',
        'Reviews are shown to other travelers without your name or email, with only the month they were written, and become visible about 24 hours after posting. You can edit or delete your own review.',
        'If you report another traveler’s review, we store your report (the reason and an optional note) with your account so we can review it and avoid duplicate reports. You can also hide a review for yourself.',
      ],
    },
    {
      heading: 'Location',
      paragraphs: [
        'HerStop asks for your location only while the app is in use, so it can sort nearby stops by distance.',
        'Your location is used on your device to calculate distance. It is not stored, not sent to our servers, and not logged.',
        'You can decline location access and still use the app; stops will just not be sorted by distance from you.',
      ],
    },
    {
      heading: 'Map and stop data',
      paragraphs: [
        'Stop names, addresses, and locations come from OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License (ODbL).',
      ],
    },
    {
      heading: 'Analytics and tracking',
      paragraphs: [
        'HerStop currently includes no analytics, advertising, or tracking SDKs, and we do not track you across other apps or websites. If this changes, we will update this policy first.',
      ],
    },
    {
      heading: 'Where your data is kept',
      paragraphs: [
        'Account, saved stops, reviews, and reports are stored in our Supabase backend. Your sign-in session is also kept on your device so you stay signed in.',
      ],
    },
    {
      heading: 'Deleting your account',
      paragraphs: [
        'You can delete your account from the Profile tab in the app. Contact support if you need help with a request about your data.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about privacy: ${SUPPORT_EMAIL}`],
    },
  ],
};

export const SUPPORT: LegalDocument = {
  title: 'Support',
  intro: 'Need help or want to tell us something about HerStop?',
  sections: [
    {
      heading: 'Contact us',
      paragraphs: [
        `Email: ${SUPPORT_EMAIL}`,
        'Please include what you were doing and which screen you were on. Do not include your sign-in code.',
      ],
    },
    {
      heading: 'Reporting a review',
      paragraphs: [
        'To report a review that is spam, offensive, not about the stop, or shares personal information, open the stop and use the report option on that review.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'You can sign out or delete your account from the Profile tab.',
      ],
    },
    {
      heading: 'In an emergency',
      paragraphs: ['HerStop is not an emergency service. If you are in danger, call 911.'],
    },
  ],
};

export const SAFETY_DISCLOSURE: LegalDocument = {
  title: 'Safety Disclosure',
  sections: [
    {
      heading: 'Decision support, not a guarantee',
      paragraphs: [
        'HerStop helps you make better stop decisions with better context. It combines recent traveler feedback and public map data. It does not guarantee your safety at any place.',
      ],
    },
    {
      heading: 'What the information is',
      paragraphs: [
        'Labels such as Recommended Stop, Good Option, Use Caution, and Limited Data reflect what other travelers reported and how much data exists. They are not a verdict about a place.',
        'Feedback can be out of date, incomplete, or mistaken. A place with few reviews is marked Limited Data.',
      ],
    },
    {
      heading: 'Use your own judgment',
      paragraphs: [
        'Conditions change. If a place feels wrong when you arrive, trust your instincts and go somewhere else.',
      ],
    },
    {
      heading: 'In an emergency',
      paragraphs: ['Call 911. HerStop cannot send help.'],
    },
  ],
};
