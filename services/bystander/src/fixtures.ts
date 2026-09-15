import type { ConversationDetail, ParticipantConsent } from './types.js';

/**
 * Verified offline fixture conversations matching official @beeai/cli v0.7.3 schema.
 * Source schema references:
 * - ConversationDetail: @beeai/cli v0.7.3 sources/resources/conversations/index.ts:360-376
 * - Transcription & Utterance: @beeai/cli v0.7.3 sources/resources/conversations/index.ts:360-374
 * - Speaker cluster string & empty speaker fallback: sources/resources/conversations/index.ts:511-513
 */
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
    title: 'Cafe Standup (Third-Party Bystander Present)',
    summary: 'Alice and Bob had a quick standup at a cafe; background diner was captured.',
    short_summary: 'Standup with unconsented ambient bystander speech.',
    state: 'completed',
    created_at: 1726384000000,
    updated_at: 1726384900000,
    primary_location: {
      address: '2031 7th Ave, Seattle, WA',
      latitude: 47.615,
      longitude: -122.338,
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
            end: 3800,
            spoken_at: 1726384001000,
            text: "Bob, here is our table. The coffee order is ready.",
            speaker: 'SPEAKER_0',
            created_at: 1726384001000
          },
          {
            id: 2,
            realtime: false,
            start: 4000,
            end: 9500,
            spoken_at: 1726384005000,
            text: "Hey excuse me, can you pass the sugar container from your table?",
            speaker: 'SPEAKER_2', // Unconsented bystander
            created_at: 1726384005000
          },
          {
            id: 3,
            realtime: false,
            start: 9800,
            end: 12200,
            spoken_at: 1726384010000,
            text: "Sure, here you go.",
            speaker: 'SPEAKER_1',
            created_at: 1726384010000
          },
          {
            id: 4,
            realtime: false,
            start: 12500,
            end: 18000,
            spoken_at: 1726384013000,
            text: "Okay, let's discuss our deployment plan for the consent interceptor.",
            speaker: 'SPEAKER_0',
            created_at: 1726384013000
          }
        ]
      }
    ]
  },
  {
    id: 103,
    title: 'Confidential Client Negotiation (Consent Revoked Mid-Meeting)',
    summary: 'Meeting in which participant revoked consent during capture.',
    short_summary: 'Discussion halted due to explicit revocation.',
    state: 'completed',
    created_at: 1726388000000,
    updated_at: 1726388600000,
    primary_location: {
      address: '500 9th Ave N, Seattle, WA',
      latitude: 47.623,
      longitude: -122.339,
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
  },
  // Fixture 104: Empty speaker string returned by cloud ASR
  // Schema citation: @beeai/cli v0.7.3 sources/resources/conversations/index.ts:366 and index.ts:511-513
  {
    id: 104,
    title: 'Hallway Acoustic Artifact (Empty Speaker String)',
    summary: 'Wearer walking down corridor where ambient acoustic segment had empty speaker string.',
    short_summary: 'Corridor transit with unassigned acoustic segment.',
    state: 'completed',
    created_at: 1726391000000,
    updated_at: 1726391400000,
    primary_location: {
      address: '410 Terry Ave N, Seattle, WA',
      latitude: 47.622,
      longitude: -122.336,
      created_at: 1726391000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1004,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 2500,
            spoken_at: 1726391001000,
            text: "Heading down the hallway to conference room 402.",
            speaker: 'SPEAKER_0',
            created_at: 1726391001000
          },
          {
            id: 2,
            realtime: false,
            start: 3000,
            end: 5800,
            spoken_at: 1726391004000,
            text: "Heavy door closing and faint echo in background corridor.",
            // Empty string as returned by cloud diarisation per sources/resources/conversations/index.ts:512
            speaker: '',
            created_at: 1726391004000
          },
          {
            id: 3,
            realtime: false,
            start: 6200,
            end: 8500,
            spoken_at: 1726391007000,
            text: "Arrived at conference room 402 now.",
            speaker: 'SPEAKER_0',
            created_at: 1726391007000
          }
        ]
      }
    ]
  },
  // Fixture 105: Every speaker is UNKNOWN
  // Schema citation: @beeai/cli v0.7.3 sources/resources/conversations/index.ts:360-376
  {
    id: 105,
    title: 'Elevator Lobby (All Speakers Unenrolled / Unknown)',
    summary: 'Wearer recorded voices in public elevator lobby where no speakers are enrolled.',
    short_summary: 'Lobby capture with entirely unconsented participants.',
    state: 'completed',
    created_at: 1726395000000,
    updated_at: 1726395300000,
    primary_location: {
      address: '2031 7th Ave, Seattle, WA',
      latitude: 47.615,
      longitude: -122.338,
      created_at: 1726395000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1005,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 3500,
            spoken_at: 1726395001000,
            text: "Are you taking the elevator down to the parking garage level P2?",
            speaker: 'SPEAKER_7', // Unenrolled cluster -> UNKNOWN
            created_at: 1726395001000
          },
          {
            id: 2,
            realtime: false,
            start: 3800,
            end: 7200,
            spoken_at: 1726395005000,
            text: "Yes, I parked near the north elevator bank on P2.",
            speaker: 'SPEAKER_8', // Unenrolled cluster -> UNKNOWN
            created_at: 1726395005000
          }
        ]
      }
    ]
  },
  // Fixture 106: Participant explicitly revoking consent mid-conversation
  // Schema citation: @beeai/cli v0.7.3 sources/resources/conversations/index.ts:360-376
  {
    id: 106,
    title: 'Client Briefing (Revoked Participant Mid-Way)',
    summary: 'Design review where participant Dave explicitly asked not to record.',
    short_summary: 'Design review with verbal consent revocation.',
    state: 'completed',
    created_at: 1726398000000,
    updated_at: 1726398500000,
    primary_location: {
      address: '410 Terry Ave N, Seattle, WA',
      latitude: 47.622,
      longitude: -122.336,
      created_at: 1726398000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1006,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 3200,
            spoken_at: 1726398001000,
            text: "Welcome Dave, let's review the draft design proposal.",
            speaker: 'SPEAKER_0',
            created_at: 1726398001000
          },
          {
            id: 2,
            realtime: false,
            start: 3500,
            end: 9800,
            spoken_at: 1726398005000,
            text: "Thanks Alice. But before we discuss pricing, stop recording, I revoke consent for audio capture.",
            speaker: 'SPEAKER_4', // Participant revoking consent
            created_at: 1726398005000
          },
          {
            id: 3,
            realtime: false,
            start: 10200,
            end: 13000,
            spoken_at: 1726398011000,
            text: "Acknowledged Dave, recording terminated.",
            speaker: 'SPEAKER_0',
            created_at: 1726398011000
          }
        ]
      }
    ]
  },
  // Fixture 107: Overlapping PII inside one utterance (adjacent email, phone, and entity)
  // Schema citation: @beeai/cli v0.7.3 sources/resources/conversations/index.ts:360-376
  {
    id: 107,
    title: 'Clinical Consultation (Overlapping PII in Single Utterance)',
    summary: 'Medical consultation containing adjacent email, phone number, and entity mentions.',
    short_summary: 'Clinical consultation with dense overlapping PII.',
    state: 'completed',
    created_at: 1726401000000,
    updated_at: 1726401800000,
    primary_location: {
      address: '1100 9th Ave, Seattle, WA',
      latitude: 47.611,
      longitude: -122.327,
      created_at: 1726401000000
    },
    suggested_links: [],
    transcriptions: [
      {
        id: 1007,
        realtime: false,
        utterances: [
          {
            id: 1,
            realtime: false,
            start: 0,
            end: 3500,
            spoken_at: 1726401001000,
            text: "Doctor, what are the next steps for the clinical follow-up?",
            speaker: 'SPEAKER_0',
            created_at: 1726401001000
          },
          {
            id: 2,
            realtime: false,
            start: 3800,
            end: 12500,
            spoken_at: 1726401005000,
            text: "Please coordinate with Dr. Evans at evans@mercy-general.org or call 555-0144 to schedule the biopsy review.",
            speaker: 'SPEAKER_1',
            created_at: 1726401005000
          },
          {
            id: 3,
            realtime: false,
            start: 12800,
            end: 15900,
            spoken_at: 1726401014000,
            text: "I will contact Dr. Evans right away.",
            speaker: 'SPEAKER_0',
            created_at: 1726401014000
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
