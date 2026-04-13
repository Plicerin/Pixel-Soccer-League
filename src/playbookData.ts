import * as THREE from 'three';

export const OFFENSE_FORMATIONS = {
  shotgun: {
    qb: { x: -2.4, z: 0 },
    linemen: [
      { role: 'C', x: -0.5, z: 0 },
      { role: 'G', x: -0.5, z: 1.2 },
      { role: 'G', x: -0.5, z: -1.2 },
      { role: 'T', x: -0.5, z: 2.4 },
      { role: 'T', x: -0.5, z: -2.4 },
    ],
    receivers: [
      { role: 'WR', x: -0.8, z: 5.5 },
      { role: 'WR', x: -0.8, z: -5.5 },
      { role: 'TE', x: -0.5, z: 3.6 },
    ],
    backs: [
      { role: 'RB', x: -2.4, z: 1.5 },
    ]
  },
  spread: {
    qb: { x: -2.4, z: 0 },
    linemen: [
      { role: 'C', x: -0.5, z: 0 },
      { role: 'G', x: -0.5, z: 1.2 },
      { role: 'G', x: -0.5, z: -1.2 },
      { role: 'T', x: -0.5, z: 2.4 },
      { role: 'T', x: -0.5, z: -2.4 },
    ],
    receivers: [
      { role: 'WR', x: -0.8, z: 8.5 },
      { role: 'WR', x: -0.8, z: -8.5 },
      { role: 'WR', x: -0.8, z: 4.5 },
      { role: 'WR', x: -0.8, z: -4.5 },
    ],
    backs: []
  },
  pro: {
    qb: { x: -0.5, z: 0 },
    linemen: [
      { role: 'C', x: -0.5, z: 0 },
      { role: 'G', x: -0.5, z: 1.2 },
      { role: 'G', x: -0.5, z: -1.2 },
      { role: 'T', x: -0.5, z: 2.4 },
      { role: 'T', x: -0.5, z: -2.4 },
    ],
    receivers: [
      { role: 'WR', x: -0.8, z: 7.5 },
      { role: 'WR', x: -0.8, z: -7.5 },
      { role: 'TE', x: -0.5, z: 3.6 },
    ],
    backs: [
      { role: 'FB', x: -2.0, z: 0 },
      { role: 'RB', x: -3.5, z: 0 },
    ]
  },
  empty: {
    qb: { x: -2.4, z: 0 },
    linemen: [
      { role: 'C', x: -0.5, z: 0 },
      { role: 'G', x: -0.5, z: 1.2 },
      { role: 'G', x: -0.5, z: -1.2 },
      { role: 'T', x: -0.5, z: 2.4 },
      { role: 'T', x: -0.5, z: -2.4 },
    ],
    receivers: [
      { role: 'WR', x: -0.8, z: 8.5 },
      { role: 'WR', x: -0.8, z: -8.5 },
      { role: 'WR', x: -0.8, z: 5.5 },
      { role: 'WR', x: -0.8, z: -5.5 },
      { role: 'WR', x: -0.8, z: 0 },
    ],
    backs: []
  },
  trips: {
    qb: { x: -2.4, z: 0 },
    linemen: [
      { role: 'C', x: -0.5, z: 0 },
      { role: 'G', x: -0.5, z: 1.2 },
      { role: 'G', x: -0.5, z: -1.2 },
      { role: 'T', x: -0.5, z: 2.4 },
      { role: 'T', x: -0.5, z: -2.4 },
    ],
    receivers: [
      { role: 'WR', x: -0.8, z: 8.5 },
      { role: 'WR', x: -0.8, z: 6.5 },
      { role: 'WR', x: -0.8, z: 4.5 },
      { role: 'WR', x: -0.8, z: -8.5 },
    ],
    backs: [
      { role: 'RB', x: -2.4, z: -1.5 },
    ]
  },
  kickoff: {
    qb: { x: -1, z: 0 },
    linemen: [
      { role: 'C', x: -1, z: 2 },
      { role: 'G', x: -1, z: 4 },
      { role: 'G', x: -1, z: -2 },
      { role: 'T', x: -1, z: 6 },
      { role: 'T', x: -1, z: -4 },
    ],
    receivers: [
      { role: 'WR', x: -1, z: 8 },
      { role: 'WR', x: -1, z: -6 },
      { role: 'WR', x: -1, z: 10 },
      { role: 'TE', x: -1, z: -8 },
    ],
    backs: [
      { role: 'RB', x: -1, z: -10 },
    ]
  }
};

export const DEFENSE_FORMATIONS = {
  'base-43': {
    linemen: [
      { role: 'DL', x: 0.5, z: 0.6 },
      { role: 'DL', x: 0.5, z: -0.6 },
      { role: 'DL', x: 0.5, z: 1.8 },
      { role: 'DL', x: 0.5, z: -1.8 },
    ],
    linebackers: [
      { role: 'LB', x: 2.5, z: 0 },
      { role: 'LB', x: 2.5, z: 2.0 },
      { role: 'LB', x: 2.5, z: -2.0 },
    ],
    secondary: [
      { role: 'CB', x: 1.5, z: 5.5 },
      { role: 'CB', x: 1.5, z: -5.5 },
      { role: 'S', x: 6.0, z: 3.0 },
      { role: 'S', x: 6.0, z: -3.0 },
    ]
  },
  'nickel': {
    linemen: [
      { role: 'DL', x: 0.5, z: 0.6 },
      { role: 'DL', x: 0.5, z: -0.6 },
      { role: 'DL', x: 0.5, z: 1.8 },
      { role: 'DL', x: 0.5, z: -1.8 },
    ],
    linebackers: [
      { role: 'LB', x: 2.5, z: 1.0 },
      { role: 'LB', x: 2.5, z: -1.0 },
    ],
    secondary: [
      { role: 'CB', x: 1.5, z: 5.5 },
      { role: 'CB', x: 1.5, z: -5.5 },
      { role: 'CB', x: 2.0, z: 3.5 },
      { role: 'S', x: 6.0, z: 4.0 },
      { role: 'S', x: 6.0, z: -4.0 },
    ]
  },
  'dime': {
    linemen: [
      { role: 'DL', x: 0.5, z: 0.6 },
      { role: 'DL', x: 0.5, z: -0.6 },
      { role: 'DL', x: 0.5, z: 1.8 },
      { role: 'DL', x: 0.5, z: -1.8 },
    ],
    linebackers: [
      { role: 'LB', x: 2.5, z: 0 },
    ],
    secondary: [
      { role: 'CB', x: 1.5, z: 5.5 },
      { role: 'CB', x: 1.5, z: -5.5 },
      { role: 'CB', x: 2.0, z: 3.5 },
      { role: 'CB', x: 2.0, z: -3.5 },
      { role: 'S', x: 6.0, z: 4.0 },
      { role: 'S', x: 6.0, z: -4.0 },
    ]
  },
  '3-4': {
    linemen: [
      { role: 'DL', x: 0.5, z: 0 },
      { role: 'DL', x: 0.5, z: 2.0 },
      { role: 'DL', x: 0.5, z: -2.0 },
    ],
    linebackers: [
      { role: 'LB', x: 2.5, z: 0.8 },
      { role: 'LB', x: 2.5, z: -0.8 },
      { role: 'LB', x: 2.0, z: 3.5 },
      { role: 'LB', x: 2.0, z: -3.5 },
    ],
    secondary: [
      { role: 'CB', x: 1.5, z: 6.5 },
      { role: 'CB', x: 1.5, z: -6.5 },
      { role: 'S', x: 7.0, z: 3.5 },
      { role: 'S', x: 7.0, z: -3.5 },
    ]
  },
  'kickoff-return': {
    linemen: [
      { role: 'DL', x: 5.6, z: 2 },
      { role: 'DL', x: 5.6, z: -2 },
      { role: 'DL', x: 5.6, z: 5 },
      { role: 'DL', x: 5.6, z: -5 },
    ],
    linebackers: [
      { role: 'LB', x: 14.0, z: 3 },
      { role: 'LB', x: 14.0, z: -3 },
      { role: 'LB', x: 14.0, z: 0 },
    ],
    secondary: [
      { role: 'CB', x: 22.4, z: 6 },
      { role: 'CB', x: 22.4, z: -6 },
      { role: 'S', x: 33.6, z: 2 },
      { role: 'S', x: 33.6, z: -2 },
    ]
  }
};

export const PASS_PLAYBOOK = {
  'overlap-flank': {
    label: 'The Overlap',
    formation: 'shotgun',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 5, z: 6 }, { x: 12, z: 8 }] }, // Winger stay wide
      { role: 'RB', index: 0, points: [{ x: 3, z: 4 }, { x: 15, z: 9 }] }, // Overlapping Fullback/Back
      { role: 'TE', index: 0, points: [{ x: 10, z: 0 }] }, // Target in center
      { role: 'WR', index: 1, points: [{ x: 15, z: -5 }] }, // Opposite winger
    ]
  },
  'underlap-cut': {
    label: 'The Underlap',
    formation: 'shotgun',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 15, z: 8.5 }] }, // Winger hugging touchline
      { role: 'RB', index: 0, points: [{ x: 8, z: 2 }, { x: 18, z: 3 }] }, // Underlapping runner into half-space
      { role: 'WR', index: 1, points: [{ x: 5, z: -2 }, { x: 12, z: 0 }] }, // Inverted winger
      { role: 'TE', index: 0, points: [{ x: 15, z: -2 }] }, 
    ]
  },
  'give-and-go': {
    label: 'One-Two (Wall Pass)',
    formation: 'pro',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 6, z: 2 }, { x: 12, z: 4 }] }, // Intended return path
      { role: 'FB', index: 0, points: [{ x: 4, z: 1 }, { x: 7, z: 0 }] }, // The "Wall"
      { role: 'TE', index: 0, points: [{ x: 15, z: -2 }] },
      { role: 'RB', index: 0, points: [{ x: 15, z: 7 }] },
    ]
  },
  'switch-of-play': {
    label: 'Switch of Play',
    formation: 'spread',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 5, z: 8 }, { x: 10, z: 9 }] }, // Initial overload side
      { role: 'WR', index: 2, points: [{ x: 8, z: 4 }] }, // Center support
      { role: 'WR', index: 1, points: [{ x: 10, z: -8 }, { x: 25, z: -9 }] }, // Target winger on far side
      { role: 'WR', index: 3, points: [{ x: 15, z: -4 }] },
    ]
  },
  'third-man-run': {
    label: 'Third Man Run',
    formation: 'empty',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 6, z: 2 }] }, // Player B (Target)
      { role: 'WR', index: 1, points: [{ x: 8, z: -6 }] }, // Support
      { role: 'WR', index: 2, points: [{ x: 4, z: 0 }, { x: 18, z: 4 }] }, // Player C (The late runner)
      { role: 'WR', index: 3, points: [{ x: 15, z: 8 }] },
      { role: 'WR', index: 4, points: [{ x: 20, z: -2 }] },
    ]
  },
  'cutback-attack': {
    label: 'Cutback Attack',
    formation: 'trips',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 20, z: 9 }] }, // Byline winger
      { role: 'WR', index: 1, points: [{ x: 15, z: 4 }] }, // Penalty spot runner
      { role: 'WR', index: 2, points: [{ x: 18, z: 0 }] }, // Near post charger
      { role: 'RB', index: 0, points: [{ x: 12, z: 2 }] }, // Edge of box support
      { role: 'WR', index: 3, points: [{ x: 15, z: -8 }] },
    ]
  },
  'cross-header': {
    label: 'Near/Far Post Cross',
    formation: 'shotgun',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 15, z: 8 }] }, // Crosser
      { role: 'WR', index: 1, points: [{ x: 18, z: 2 }] }, // Near post
      { role: 'TE', index: 0, points: [{ x: 18, z: -3 }] }, // Far post
      { role: 'RB', index: 0, points: [{ x: 12, z: 0 }] }, // Top of box
    ]
  },
  'diagonal-through': {
    label: 'Diagonal Through Ball',
    formation: 'pro',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 10, z: 7.5 }, { x: 22, z: 2 }] }, // Diagonal slash
      { role: 'WR', index: 1, points: [{ x: 5, z: -7.5 }, { x: 18, z: -4 }] }, 
      { role: 'TE', index: 0, points: [{ x: 15, z: 0 }] }, 
      { role: 'RB', index: 0, points: [{ x: 10, z: -2 }] },
    ]
  },
  'false-nine': {
    label: 'False 9 Drop-In',
    formation: 'empty',
    routes: [
      { role: 'WR', index: 4, points: [{ x: 2, z: 0 }] }, // Striker (index 4 in empty) drops deep
      { role: 'WR', index: 2, points: [{ x: 10, z: 4 }, { x: 25, z: 1 }] }, // Winger runs into space
      { role: 'WR', index: 3, points: [{ x: 10, z: -4 }, { x: 25, z: -1 }] }, // Winger runs into space
      { role: 'WR', index: 0, points: [{ x: 15, z: 8 }] },
      { role: 'WR', index: 1, points: [{ x: 15, z: -8 }] },
    ]
  },
  'three-lane-counter': {
    label: '3-Lane Counter',
    formation: 'spread',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 30, z: 8 }] }, // Left Lane
      { role: 'WR', index: 1, points: [{ x: 30, z: -8 }] }, // Right Lane
      { role: 'WR', index: 2, points: [{ x: 30, z: 2 }] }, // Center Lane
      { role: 'WR', index: 3, points: [{ x: 30, z: -2 }] }, // Center Lane support
    ]
  },
  'target-man': {
    label: 'Outlet to Target Man',
    formation: 'pro',
    routes: [
      { role: 'TE', index: 0, points: [{ x: 12, z: 0 }] }, // Target Man holds up
      { role: 'WR', index: 0, points: [{ x: 8, z: 7 }, { x: 25, z: 5 }] }, // Runners past him
      { role: 'WR', index: 1, points: [{ x: 8, z: -7 }, { x: 25, z: -5 }] },
      { role: 'RB', index: 0, points: [{ x: 15, z: 2 }] },
    ]
  },
  'dummy-free-kick': {
    label: 'Dummy Runner Routine',
    formation: 'shotgun',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 4, z: 1 }, { x: 10, z: 2 }] }, // Dummy runner
      { role: 'TE', index: 0, points: [{ x: 15, z: 5 }] }, // Real target
      { role: 'WR', index: 1, points: [{ x: 15, z: -5 }] },
      { role: 'RB', index: 0, points: [{ x: 12, z: 0 }] },
    ]
  },
  'kickoff': {
    label: 'Kickoff',
    formation: 'kickoff',
    routes: [
      { role: 'WR', index: 0, points: [{ x: 40, z: 8 }] },
      { role: 'WR', index: 1, points: [{ x: 40, z: -8 }] },
      { role: 'WR', index: 2, points: [{ x: 40, z: 4 }] },
      { role: 'TE', index: 0, points: [{ x: 40, z: -4 }] },
      { role: 'RB', index: 0, points: [{ x: 40, z: 0 }] },
    ]
  }
};

export const DEFENSE_PLAYBOOK = {
  'cover-2': {
    label: 'Cover 2',
    formation: 'base-43',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'zone', x: 5, z: 0 },
      { role: 'LB', type: 'zone', x: 5, z: 3 },
      { role: 'LB', type: 'zone', x: 5, z: -3 },
      { role: 'CB', type: 'zone', x: 8, z: 6 },
      { role: 'CB', type: 'zone', x: 8, z: -6 },
      { role: 'S', type: 'zone', x: 15, z: 4 },
      { role: 'S', type: 'zone', x: 15, z: -4 },
    ]
  },
  'man-to-man': {
    label: 'Man to Man',
    formation: 'base-43',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'zone', x: 4, z: 0 },
      { role: 'LB', type: 'zone', x: 4, z: 2 },
      { role: 'LB', type: 'zone', x: 4, z: -2 },
      { role: 'CB', type: 'man', receiverIndex: 0 },
      { role: 'CB', type: 'man', receiverIndex: 1 },
      { role: 'S', type: 'man', receiverIndex: 2 },
      { role: 'S', type: 'zone', x: 18, z: 0 },
    ]
  },
  'nickel-blitz': {
    label: 'Nickel Blitz',
    formation: 'nickel',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'rush' }, // Blitzing LB
      { role: 'LB', type: 'zone', x: 4, z: -2 },
      { role: 'CB', type: 'man', receiverIndex: 0 },
      { role: 'CB', type: 'man', receiverIndex: 1 },
      { role: 'CB', type: 'rush' }, // Blitzing Nickel CB
      { role: 'S', type: 'zone', x: 12, z: 5 },
      { role: 'S', type: 'zone', x: 12, z: -5 },
    ]
  },
  'cover-3': {
    label: 'Cover 3',
    formation: 'base-43',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'zone', x: 4, z: 0 },
      { role: 'LB', type: 'zone', x: 4, z: 4 },
      { role: 'LB', type: 'zone', x: 4, z: -4 },
      { role: 'CB', type: 'zone', x: 15, z: 8 }, // Deep 1/3
      { role: 'CB', type: 'zone', x: 6, z: -8 }, // Flat
      { role: 'S', type: 'zone', x: 18, z: 0 }, // Deep 1/3
      { role: 'S', type: 'zone', x: 15, z: -8 }, // Deep 1/3
    ]
  },
  'prevent-deep': {
    label: 'Prevent',
    formation: 'nickel',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'zone', x: 6, z: 2 },
      { role: 'LB', type: 'zone', x: 6, z: -2 },
      { role: 'CB', type: 'zone', x: 20, z: 10 },
      { role: 'CB', type: 'zone', x: 20, z: -10 },
      { role: 'CB', type: 'zone', x: 15, z: 0 },
      { role: 'S', type: 'zone', x: 25, z: 5 },
      { role: 'S', type: 'zone', x: 25, z: -5 },
    ]
  },
  '3-4-blitz': {
    label: '3-4 Blitz',
    formation: '3-4',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'rush' },
      { role: 'LB', type: 'rush' },
      { role: 'LB', type: 'zone', x: 4, z: 3 },
      { role: 'LB', type: 'zone', x: 4, z: -3 },
      { role: 'CB', type: 'man', receiverIndex: 0 },
      { role: 'CB', type: 'man', receiverIndex: 1 },
      { role: 'S', type: 'zone', x: 15, z: 5 },
      { role: 'S', type: 'zone', x: 15, z: -5 },
    ]
  },
  'dime-prevent': {
    label: 'Dime Prevent',
    formation: 'dime',
    assignments: [
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'DL', type: 'rush' },
      { role: 'LB', type: 'zone', x: 5, z: 0 },
      { role: 'CB', type: 'zone', x: 15, z: 8 },
      { role: 'CB', type: 'zone', x: 15, z: -8 },
      { role: 'CB', type: 'zone', x: 12, z: 4 },
      { role: 'CB', type: 'zone', x: 12, z: -4 },
      { role: 'S', type: 'zone', x: 25, z: 6 },
      { role: 'S', type: 'zone', x: 25, z: -6 },
    ]
  },
  'kickoff-return': {
    label: 'Kickoff Return',
    formation: 'kickoff-return',
    assignments: [
      { role: 'DL', type: 'zone', x: 10, z: 0 },
      { role: 'DL', type: 'zone', x: 10, z: 4 },
      { role: 'DL', type: 'zone', x: 10, z: -4 },
      { role: 'DL', type: 'zone', x: 10, z: 8 },
      { role: 'LB', type: 'zone', x: 5, z: 0 },
      { role: 'LB', type: 'zone', x: 5, z: 5 },
      { role: 'LB', type: 'zone', x: 5, z: -5 },
      { role: 'CB', type: 'zone', x: 0, z: 6 },
      { role: 'CB', type: 'zone', x: 0, z: -6 },
      { role: 'S', type: 'zone', x: -5, z: 2 },
      { role: 'S', type: 'zone', x: -5, z: -2 },
    ]
  }
};
