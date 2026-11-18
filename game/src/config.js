// Solmar City 3D — shared constants. All tuning lives here.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const BLOCK = 400;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walk: 170,
  run: 290,
  hp: 100,
  punchRange: 38,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 560,
  fireDelay: 0.22,
  startAmmo: 48,
};

export const CAR_MODELS = {
  sedan:  { name: 'Sedan',  top: 330, accel: 210, turn: 2.6, hp: 100, colors: ['#c0392b', '#2e86c1', '#7d8a99', '#e8e8e8'] },
  taxi:   { name: 'Taxi',   top: 320, accel: 205, turn: 2.6, hp: 100, colors: ['#f5c518'] },
  truck:  { name: 'Truck',  top: 240, accel: 130, turn: 1.9, hp: 170, colors: ['#5d6d7e', '#935116', '#1e8449'] },
  sports: { name: 'Sports', top: 470, accel: 320, turn: 3.1, hp: 80,  colors: ['#e74c3c', '#f39c12', '#8e44ad', '#16a085'] },
  police: { name: 'Police', top: 400, accel: 300, turn: 3.0, hp: 130, colors: ['#1a1a2e'] },
  van:    { name: 'Van',    top: 270, accel: 160, turn: 2.1, hp: 140, colors: ['#aab7b8', '#6c3483'] },
};

export const WANTED_MAX = 5;
export const MONEY_START = 120;
export const SAVE_KEY = 'solmar-city-save-v2';

// Fixed story locations (world coordinates, x east, y south).
export const PLACES = {
  bar:       { x: 1180, y: 780,  label: "Rosa's Bar" },
  safehouse: { x: 420,  y: 420,  label: 'Safehouse' },
  hospital:  { x: 2020, y: 380,  label: 'Hospital' },
  station:   { x: 1820, y: 1820, label: 'Police Station' },
  port:      { x: 2580, y: 2080, label: 'Port Docks' },
  beach:     { x: 2880, y: 1000, label: 'Beachfront' },
  package:   { x: 760,  y: 1620, label: 'Package Drop' },
  heistCar:  { x: 1420, y: 1420, label: 'Heist Car' },
  downtown:  { x: 1400, y: 1000, label: 'Downtown' },
};
