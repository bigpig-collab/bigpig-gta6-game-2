// Solmar City constants: world layout, named places, car models, the
// Mama Rosa job chain and its money trail. Pure data, no rendering here.
export const WORLD = {
  width: 3200, height: 2400,
  halfW: 1600, halfH: 1200,
  block: 400, roadWidth: 64, lane: 16,
  roadsX: [-1600, -1200, -800, -400, 0, 400, 800, 1200, 1600],
  roadsZ: [-1200, -800, -400, 0, 400, 800, 1200],
};
export const PLACES = {
  bar:       { x: 400,  z: -400, name: "Rosa's Bar",    label: 'BAR' },
  safehouse: { x: -1200, z: 400,  name: 'Safehouse',     label: 'HOME' },
  hospital:  { x: 0,    z: -800, name: 'Solmar General', label: 'HOSP' },
  police:    { x: 800,  z: 0,    name: 'Police Station', label: 'PD' },
  port:      { x: 0,    z: 1080, name: 'Port Docks',     label: 'PORT' },
  beach:     { x: 1480, z: 400,  name: 'Beachfront',     label: 'BEACH' },
  drop:      { x: -400, z: 400,  name: 'Package Drop',   label: 'DROP' },
  downtown:  { x: 0,    z: -400, name: 'Downtown',       label: 'CITY' },
  heist:     { x: 1200, z: 800,  name: 'Heist Car',      label: 'HEIST' },
};
export const START = { x: -1150, z: 330, heading: Math.PI / 2 };
export const CAR_SPECS = {
  sports: { label: 'Comet GT',   top: 470, accel: 210, brake: 420, turn: 2.9, len: 4.6, wid: 2.0, hp: 100, color: 0xd21f2b, price: 0 },
  sedan:  { label: 'Marlin',     top: 380, accel: 165, brake: 380, turn: 2.5, len: 4.4, wid: 1.9, hp: 100, color: 0x3a6fd8, price: 0 },
  taxi:   { label: 'Sun Cab',    top: 380, accel: 165, brake: 380, turn: 2.5, len: 4.4, wid: 1.9, hp: 100, color: 0xf2c200, price: 0 },
  van:    { label: 'Hauler Van', top: 320, accel: 140, brake: 340, turn: 2.1, len: 5.2, wid: 2.1, hp: 120, color: 0x8a8f96, price: 0 },
  truck:  { label: 'Atlas Truck',top: 260, accel: 110, brake: 300, turn: 1.7, len: 7.2, wid: 2.4, hp: 160, color: 0x4a7a3a, price: 0 },
  police: { label: 'Interceptor',top: 440, accel: 200, brake: 420, turn: 2.7, len: 4.6, wid: 2.0, hp: 140, color: 0x14181d, price: 0 },
};
export const CAR_TYPES = ['sedan', 'taxi', 'truck', 'van', 'sports', 'police'];
export const MISSION_REWARDS = [150, 300, 400, 500, 600, 1000];
export const MISSIONS = [
  { id: 1, title: 'Back in Town', kind: 'reach', target: 'bar', reward: 150,
    brief: 'Mama Rosa: "Solmar missed you, kid. Come see me at the bar."',
    done: 'Mama Rosa: "Good to see you. The city pays those who move."',
    objective: 'Go to Rosa\'s Bar' },
  { id: 2, title: 'Borrowed Wheels', kind: 'deliver', target: 'bar', car: 'sports', reward: 300,
    brief: 'Mama Rosa: "I need a fast car. Borrow a sports car and bring it to the bar."',
    done: 'Mama Rosa: "Sweet ride. The boys will love this one."',
    objective: 'Steal a sports car and bring it to the bar' },
  { id: 3, title: 'The Pickup', kind: 'collect', target: 'drop', reward: 400,
    brief: 'Mama Rosa: "A package waits at the drop. Grab it, then lose the heat."',
    done: 'Mama Rosa: "Clean hands, full pockets. That is how we work."',
    objective: 'Collect the package, then lose all heat' },
  { id: 4, title: 'Heat Wave', kind: 'loseheat', target: 'downtown', stars: 3, reward: 500,
    brief: 'Mama Rosa: "The cops are all over you. Shake a 3-star tail and stay cool."',
    done: 'Mama Rosa: "Ghost. They never even saw you."',
    objective: 'Lose a 3-star wanted level' },
  { id: 5, title: 'Dockside Deal', kind: 'kill', target: 'port', count: 5, reward: 600,
    brief: 'Mama Rosa: "Rivals at the docks. Drop five of them, then the port is ours."',
    done: 'Mama Rosa: "The docks are ours now. Nice shooting."',
    objective: 'Drop 5 rivals at the Port Docks' },
  { id: 6, title: 'The Big Score', kind: 'heist', target: 'safehouse', car: 'sports', stars: 4, reward: 1000,
    brief: 'Mama Rosa: "One last job. Take the heist car home at 4-star heat. No mistakes."',
    done: 'Mama Rosa: "Three thousand and seventy. Solmar is yours now, kid."',
    objective: 'Take the heist car to the safehouse at 4-star heat' },
];
export const GAME = {
  startMoney: 120, startAmmo: 48, startHealth: 100,
  fine: 150, maxWanted: 5, heatDecaySeconds: 12, copSpawnCooldown: 2.5,
  maxFootCops: 2, ramDamagePerSecond: 10, punchDamage: 40, pistolDamage: 34,
  pedHealth: 68, copHealth: 68, rivalHealth: 68,
  trafficCount: 14, pedCount: 25, parkedCount: 18,
  saveKey: 'solmar-city-save-v1',
  shotWidth: 1280, shotHeight: 800, shotMaxBytes: 262144,
};
// Minimap district shading, shared by the minimap so the colours stay
// in one place with the rest of the world data.
export const DISTRICT_COLORS = {
  downtown: '#274b6d', park: '#3f6b3a', beach: '#e8d29a', port: '#6d7278',
  suburbs: '#1d2b1f', midtown: '#1d2b1f',
};
