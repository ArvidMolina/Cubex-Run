import * as THREE from 'three';
import { scene } from './renderer.js';

// ============================================================
// PARTÍCULAS — pooling: 1 BoxGeometry compartida + materials base por tipo
// ============================================================
export const particles = [];

export const PARTICLE_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);

export const PARTICLE_MAT = {
  condense:  new THREE.MeshLambertMaterial({ color: 0x5a9adc, transparent: true, opacity: 0.9 }),
  dust:      new THREE.MeshLambertMaterial({ color: 0x8a7a5a, transparent: true, opacity: 0.7 }),
  spark:     new THREE.MeshLambertMaterial({ color: 0xc9a060, transparent: true, opacity: 0.95 }),
  confetti:  [0xffd24a, 0xfff8aa, 0x6fa83a, 0xc99200].map(c =>
               new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 1 })),
  splashRed: new THREE.MeshLambertMaterial({ color: 0xe84545, transparent: true, opacity: 1 }),
};

const particlePools = new Map();

function acquireParticle(baseMat) {
  let pool = particlePools.get(baseMat.uuid);
  if (!pool) {
    pool = [];
    particlePools.set(baseMat.uuid, pool);
  }
  let particle = pool.pop();
  if (!particle) {
    const material = baseMat.clone();
    const mesh = new THREE.Mesh(PARTICLE_GEO, material);
    mesh.visible = false;
    scene.add(mesh);
    particle = {
      mesh,
      pool,
      baseOpacity: baseMat.opacity,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      lifeMax: 0,
    };
  }
  return particle;
}

function spawnParticle(baseMat, x, y, z, vx, vy, vz, life) {
  const particle = acquireParticle(baseMat);
  particle.mesh.position.set(x, y, z);
  particle.mesh.rotation.set(0, 0, 0);
  particle.mesh.material.opacity = particle.baseOpacity;
  particle.mesh.visible = true;
  particle.vx = vx;
  particle.vy = vy;
  particle.vz = vz;
  particle.life = life;
  particle.lifeMax = life;
  particles.push(particle);
}

function releaseParticle(index) {
  const particle = particles[index];
  particle.mesh.visible = false;
  particle.pool.push(particle);
  const last = particles.pop();
  if (index < particles.length) particles[index] = last;
}

export function spawnCondensation(x, z) {
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 1.2 + Math.random() * 0.6;
    spawnParticle(
      PARTICLE_MAT.condense, x, 0.6, z,
      Math.cos(angle) * speed,
      0.5 + Math.random() * 0.5,
      Math.sin(angle) * speed,
      0.9
    );
  }
}

export function spawnStepDust(x, z, dirX, dirZ) {
  for (let i = 0; i < 2; i++) {
    spawnParticle(
      PARTICLE_MAT.dust,
      x - dirX * 0.2 + (Math.random() - 0.5) * 0.3,
      0.05,
      z - dirZ * 0.2 + (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.4,
      0.2 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.4,
      0.35
    );
  }
}

export function spawnWallHitSparks(x, z, dirX, dirZ) {
  for (let i = 0; i < 5; i++) {
    const ang = Math.atan2(-dirZ, -dirX) + (Math.random() - 0.5) * 1.0;
    const speed = 1.2 + Math.random() * 0.8;
    spawnParticle(
      PARTICLE_MAT.spark, x, 0.5, z,
      Math.cos(ang) * speed,
      0.5 + Math.random() * 0.6,
      Math.sin(ang) * speed,
      0.5
    );
  }
}

export function spawnConfetti(x, z) {
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + Math.random() * 0.2;
    const speed = 1.5 + Math.random() * 1.2;
    spawnParticle(
      PARTICLE_MAT.confetti[i % PARTICLE_MAT.confetti.length], x, 0.6, z,
      Math.cos(ang) * speed,
      1.2 + Math.random() * 0.6,
      Math.sin(ang) * speed,
      1.0
    );
  }
}

export function spawnLoseSplash(x, z) {
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 1.4 + Math.random() * 1.0;
    spawnParticle(
      PARTICLE_MAT.splashRed, x, 0.5, z,
      Math.cos(ang) * speed,
      0.8 + Math.random() * 0.6,
      Math.sin(ang) * speed,
      0.9
    );
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vy -= 1.5 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += dt * 4;
    p.mesh.rotation.z += dt * 5;
    p.mesh.material.opacity = p.baseOpacity * Math.max(0, p.life / p.lifeMax);
    if (p.life <= 0) {
      releaseParticle(i);
    }
  }
}

export function clearParticles() {
  for (let i = particles.length - 1; i >= 0; i--) releaseParticle(i);
}

export function getParticlePoolSize() {
  let total = 0;
  for (const pool of particlePools.values()) total += pool.length;
  return total;
}
