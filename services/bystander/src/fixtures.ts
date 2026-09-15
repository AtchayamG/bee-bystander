import type { ConversationDetail, ParticipantConsent } from './types.js';

export const FIXTURE_CONVERSATIONS: ConversationDetail[] = [
  {
    id: 101,
    title: 'Project Architecture Review',
    summary: 'Alice and Bob discussed the Bystander architecture and confirmed the timeline.',
    short_summary: 'Architecture sync and roadmap confirmation.',
    state: 'completed',
    created_at: 1726380000000,
    updated_at: 1726380900000,
    primary_location: {
      address: '410 Terry Ave N, Seattle, WA',
      latitude: 47.622,
      longitude: -122.336,
      created_at: 1726380000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1001,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 4200,
            spoken_at: 1726380001000,
            text: "Good morning Bob, let's review the Bystander capture layer for Bee.",
            speaker: 'SPEAKER_0',
            created_at: 1726380001000
          },
          {
            id: 2,
            realtime: false,
            start: 4500,
            end: 11200,
            spoken_at: 1726380005000,
            text: "Morning Alice. I reviewed the API. Carol sent her contact info: email carol@partner-network.org and mobile 555-0199.",
            speaker: 'SPEAKER_1',
            created_at: 1726380005000
          },
          {
            id: 3,
            realtime: false,
            start: 11500,
            end: 16800,
            spoken_at: 1726380012000,
            text: "Thanks. Let's make sure Carol's private contact details are not retained in our notes.",
            speaker: 'SPEAKER_0',
            created_at: 1726380012000
          },
          {
            id: 4,
            realtime: false,
            start: 17100,
            end: 22000,
            spoken_at: 1726380018000,
            text: "Understood. The rest of the project milestone is on track for Friday.",
            speaker: 'SPEAKER_1',
            created_at: 1726380018000
          }
        ]
      }
    ]
  },
  {
    id: 102,
    title: 'Cafe Meeting with Ambient Bystander',
    summary: 'Alice and Bob met at a cafe, but nearby bystander conversation was captured.',
    short_summary: 'Cafe meeting containing unconsented background speech.',
    state: 'completed',
    created_at: 1726384000000,
    updated_at: 1726384900000,
    primary_location: {
      address: '2101 4th Ave, Seattle, WA',
      latitude: 47.614,
      longitude: -122.342,
      created_at: 1726384000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1002,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 3500,
            spoken_at: 1726384001000,
            text: "Hey Bob, thanks for meeting me at the coffee shop.",
            speaker: 'SPEAKER_0',
            created_at: 1726384001000
          },
          {
            id: 2,
            realtime: false,
            start: 3800,
            end: 7200,
            spoken_at: 1726384004000,
            text: "Glad to meet up, Alice. How is the rollout going?",
            speaker: 'SPEAKER_1',
            created_at: 1726384004000
          },
          {
            id: 3,
            realtime: false,
            start: 7500,
            end: 15400,
            spoken_at: 1726384008000,
            text: "Excuse me Dr. Evans, my patient ID is 8841 and my biopsy test results came back positive.",
            speaker: 'SPEAKER_2',
            created_at: 1726384008000
          },
          {
            id: 4,
            realtime: false,
            start: 15800,
            end: 20100,
            spoken_at: 1726384016000,
            text: "The cafe is quite loud today with people at adjacent tables.",
            speaker: 'SPEAKER_0',
            created_at: 1726384016000
          }
        ]
      }
    ]
  },
  {
    id: 103,
    title: 'Executive Discussion with Explicit Revocation',
    summary: 'Session where a participant explicitly revoked consent upon seeing the recorder.',
    short_summary: 'Recorded session with active consent revocation.',
    state: 'completed',
    created_at: 1726388000000,
    updated_at: 1726388600000,
    primary_location: {
      address: 'Conference Room 4B',
      latitude: 47.622,
      longitude: -122.336,
      created_at: 1726388000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1003,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 3200,
            spoken_at: 1726388001000,
            text: "Let's discuss the confidential client negotiation and proprietary terms.",
            speaker: 'SPEAKER_0',
            created_at: 1726388001000
          },
          {
            id: 2,
            realtime: false,
            start: 3500,
            end: 10800,
            spoken_at: 1726388004000,
            text: "Hold on, I see your wearable recording light. I revoke consent for this discussion. Do not record or summarize this.",
            speaker: 'SPEAKER_1',
            created_at: 1726388004000
          },
          {
            id: 3,
            realtime: false,
            start: 11100,
            end: 14000,
            spoken_at: 1726388011000,
            text: "Understood Bob, stopping capture immediately.",
            speaker: 'SPEAKER_0',
            created_at: 1726388011000
          }
        ]
      }
    ]
  }
];

export const DEFAULT_LEDGER: ParticipantConsent[] = [
  {
    clusterId: 'SPEAKER_0',
    name: 'Alice',
    role: 'WEARER',
    status: 'CONSENTED',
    updatedAt: 1726380000000,
    notes: 'Device owner / Wearer profile'
  },
  {
    clusterId: 'SPEAKER_1',
    name: 'Bob',
    role: 'PARTICIPANT',
    status: 'CONSENTED',
    updatedAt: 1726380000000,
    notes: 'Colleague with pre-agreed recording consent'
  },
  {
    clusterId: 'SPEAKER_2',
    name: 'Unknown Diner',
    role: 'BYSTANDER',
    status: 'UNKNOWN',
    updatedAt: 1726384000000,
    notes: 'Acoustic cluster at adjacent cafe table. Not enrolled.'
  }
];
