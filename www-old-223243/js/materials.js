import * as THREE from 'three';

export const mat = {
  floor:     new THREE.MeshLambertMaterial({ color: 0x4a5a3a }),
  floorAlt:  new THREE.MeshLambertMaterial({ color: 0x3a4a2a }),
  wall:      new THREE.MeshLambertMaterial({ color: 0x9a7a4a }),
  wallTop:   new THREE.MeshLambertMaterial({ color: 0xc9a060 }),
  fog:       new THREE.MeshLambertMaterial({ color: 0x0a0c10 }),
  skin:      new THREE.MeshLambertMaterial({ color: 0x6fa83a, transparent: true, opacity: 1 }),
  skinDk:    new THREE.MeshLambertMaterial({ color: 0x4a7a22, transparent: true, opacity: 1 }),
  eyeW:      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 1 }),
  eyeB:      new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: 1 }),
  slime:     new THREE.MeshLambertMaterial({ color: 0x5a9adc, transparent: true, opacity: 0 }),
  slimeDk:   new THREE.MeshLambertMaterial({ color: 0x2a5a8c, transparent: true, opacity: 0 }),
  slimeEye:  new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  slimeEyeB: new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: 0 }),
  gold:      new THREE.MeshLambertMaterial({ color: 0xffd24a, transparent: true, opacity: 1 }),
  goldDk:    new THREE.MeshLambertMaterial({ color: 0xc99200, transparent: true, opacity: 1 }),
  goldShine: new THREE.MeshLambertMaterial({ color: 0xfff8aa, transparent: true, opacity: 0.9 }),
};

// Paletas de color que cambian cada nivel para dar sensación de progresión
export const THEMES = [
  { name: 'Mazmorra',  floor: 0x4a5a3a, floorAlt: 0x3a4a2a, wall: 0x9a7a4a, wallTop: 0xc9a060, fog: 0x0a0c10, accent: '#6fa83a' },
  { name: 'Cripta',    floor: 0x3a2a4a, floorAlt: 0x2a1a3a, wall: 0x7a5a9a, wallTop: 0xa07ac0, fog: 0x080612, accent: '#a07ac0' },
  { name: 'Volcán',    floor: 0x4a2a1a, floorAlt: 0x3a1a0a, wall: 0x9a4a2a, wallTop: 0xc06030, fog: 0x100806, accent: '#c06030' },
  { name: 'Glaciar',   floor: 0x2a3a4a, floorAlt: 0x1a2a3a, wall: 0x4a7a9a, wallTop: 0x60a0c0, fog: 0x060810, accent: '#60a0c0' },
  { name: 'Templo',    floor: 0x4a3a1a, floorAlt: 0x3a2a0a, wall: 0x9a8a2a, wallTop: 0xc0b030, fog: 0x0c0a04, accent: '#c0b030' },
  { name: 'Abismo',    floor: 0x1a1a2a, floorAlt: 0x0e0e1a, wall: 0x3a3a6a, wallTop: 0x5a5a9a, fog: 0x040408, accent: '#5a5a9a' },
];

function fract(x) { return x - Math.floor(x); }
function wrap01(x) {
  let v = x % 1;
  if (v < 0) v += 1;
  return v;
}

function tintByWheel(hex, hueShiftDeg, satMul = 1, lightMul = 1, lightAdd = 0) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = wrap01(hsl.h + hueShiftDeg / 360);
  hsl.s = Math.max(0, Math.min(1, hsl.s * satMul));
  hsl.l = Math.max(0, Math.min(1, hsl.l * lightMul + lightAdd));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return c;
}

export function applyTheme(level) {
  const t = THEMES[(level - 1) % THEMES.length];

  // Variación procedural basada en círculo cromático (HSL):
  // usamos relaciones análogas/complementarias/split para que cada nivel
  // se sienta distinto sin romper la identidad del tema base.
  const seed = fract(Math.sin(level * 12.9898) * 43758.5453);
  const phase = ((level - 1) * 137.50776405) % 360; // golden-angle hue walk
  const amp = 10 + seed * 14; // shift suave: 10..24 grados

  const shiftFloor   = Math.sin((phase +   0) * Math.PI / 180) * amp; // base
  const shiftAlt     = Math.sin((phase +  30) * Math.PI / 180) * amp; // análogo
  const shiftWall    = Math.sin((phase + 180) * Math.PI / 180) * amp; // complementario
  const shiftWallTop = Math.sin((phase + 150) * Math.PI / 180) * amp; // split-complementario
  const shiftFog     = Math.sin((phase + 210) * Math.PI / 180) * (amp * 0.45);

  mat.floor.color.copy(tintByWheel(t.floor, shiftFloor,   1.00, 1.00, 0.00));
  mat.floorAlt.color.copy(tintByWheel(t.floorAlt, shiftAlt, 0.98, 0.96, -0.01));
  mat.wall.color.copy(tintByWheel(t.wall, shiftWall,      1.05, 1.00, 0.00));
  mat.wallTop.color.copy(tintByWheel(t.wallTop, shiftWallTop, 1.08, 1.04, 0.01));
  mat.fog.color.copy(tintByWheel(t.fog, shiftFog,         0.90, 0.92, -0.01));

  // Nombre del tema en el HUD
  const badge = document.getElementById('levelBadge');
  if (badge) badge.title = t.name;
  // Acento de color en el borde del canvas
  const accent = tintByWheel(t.wallTop, shiftWallTop, 1.1, 1.05, 0.02).getStyle();
  document.getElementById('game').style.setProperty('--theme-accent', accent);
}
