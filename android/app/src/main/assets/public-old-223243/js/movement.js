import { isWall } from './maze.js';
import { cfg } from './config.js';
// ============================================================
// MOVIMIENTO — moveEntity, hop, facing, knockback, cámara
// ============================================================

// ---- moveEntity ----
// Retorna { moved, hit, dx, dz }
const moveResult = { moved: false, hit: false, dx: 0, dz: 0 };

function setMoveResult(moved, hit, dx, dz) {
  moveResult.moved = moved;
  moveResult.hit = hit;
  moveResult.dx = dx;
  moveResult.dz = dz;
  return moveResult;
}

function cellRow(z) {
  return Math.round(z + (cfg.ROWS - 1) / 2);
}

function cellCol(x) {
  return Math.round(x + (cfg.COLS - 1) / 2);
}

export function moveEntity(entity, dx, dz, dt, speed) {
  if (dx === 0 && dz === 0) return setMoveResult(false, false, 0, 0);
  const len = Math.hypot(dx, dz);
  dx /= len; dz /= len;
  const newX = entity.position.x + dx * speed * dt;
  const newZ = entity.position.z + dz * speed * dt;
  if (!isWall(cellRow(newZ), cellCol(newX))) {
    entity.position.x = newX;
    entity.position.z = newZ;
    return setMoveResult(true, false, dx, dz);
  }
  // Slide en X o Z por separado
  let anySlide = false;
  if (!isWall(cellRow(entity.position.z), cellCol(newX))) {
    entity.position.x = newX;
    anySlide = true;
  }
  if (!isWall(cellRow(newZ), cellCol(entity.position.x))) {
    entity.position.z = newZ;
    anySlide = true;
  }
  return setMoveResult(anySlide, !anySlide, dx, dz);
}

// ---- HOP — arco parabólico por celda recorrida ----
export const BASE_Y        = 0.45;
const HOP_HEIGHT           = 0.18;
const HOP_DURATION         = 0.22;   // s
const LAND_SQUASH_DUR      = 0.14;   // s

let _hopDist         = 0;
let _hopPhase        = 1;   // 1 = en el suelo
let _landSquash      = 0;
let _landedThisFrame = false;
const hopResult = { y: BASE_Y, scaleX: 1, scaleY: 1, scaleZ: 1, landed: false };

export function updateHop(dt, speed) {
  _landedThisFrame = false;

  if (speed > 0.1) {
    if (_hopPhase >= 1) {
      _hopDist += speed * dt;
      if (_hopDist >= 1.0) {
        _hopDist -= 1.0;
        _hopPhase = 0;
        _landedThisFrame = true;
      }
    }
    if (_hopPhase < 1) {
      _hopPhase = Math.min(1, _hopPhase + dt / HOP_DURATION);
      if (_hopPhase >= 1) {
        _landedThisFrame = true;
        _hopDist = 0;
      }
    }
  } else {
    _hopPhase = 1;
    _hopDist  = 0;
  }

  const arc = Math.sin(_hopPhase * Math.PI);
  const y   = BASE_Y + arc * HOP_HEIGHT;

  if (_landedThisFrame) _landSquash = 1;
  if (_landSquash > 0)  _landSquash = Math.max(0, _landSquash - dt / LAND_SQUASH_DUR);

  const e      = Math.pow(1 - _landSquash, 0.5);
  const scaleX = 1 + 0.18 * (1 - e);
  const scaleY = 1 - 0.18 * (1 - e);

  hopResult.y = y;
  hopResult.scaleX = scaleX;
  hopResult.scaleY = scaleY;
  hopResult.scaleZ = scaleX;
  hopResult.landed = _landedThisFrame;
  return hopResult;
}

export function resetHop() {
  _hopDist = 0; _hopPhase = 1; _landSquash = 0;
}

export function getHopState() {
  return { phase: _hopPhase, dist: _hopDist, landSquash: _landSquash };
}

// ---- FACING — rotación suave hacia dirección de movimiento ----
let _currentYaw = 0;
let _targetYaw  = 0;

export function updateFacing(dt, dx, dz, player) {
  if (!player) return;
  if (dx !== 0 || dz !== 0) _targetYaw = Math.atan2(dx, dz);
  let diff = _targetYaw - _currentYaw;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  _currentYaw += diff * (1 - Math.exp(-12 * dt));
  player.rotation.y = _currentYaw;
}

export function resetFacing(player) {
  _currentYaw = 0; _targetYaw = 0;
  if (player) player.rotation.y = 0;
}

export function getCurrentYaw() { return _currentYaw; }
export function getTargetYaw()  { return _targetYaw; }
export function forceFacing(yaw, player) {
  _currentYaw = yaw; _targetYaw = yaw;
  if (player) player.rotation.y = yaw;
}

// ---- KNOCKBACK ----
let _knockbackVX         = 0;
let _knockbackVZ         = 0;
let _knockbackRemaining  = 0;

export function triggerKnockback(player, fromX, fromZ) {
  const dx  = player.position.x - fromX;
  const dz  = player.position.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  _knockbackVX        = (dx / len) * 6.0;
  _knockbackVZ        = (dz / len) * 6.0;
  _knockbackRemaining = 0.30;
}

export function updateKnockback(dt, player) {
  if (_knockbackRemaining <= 0) return;
  _knockbackRemaining = Math.max(0, _knockbackRemaining - dt);
  const decay = Math.exp(-3.0 * dt);
  _knockbackVX *= decay;
  _knockbackVZ *= decay;

  // Mover con colisión de paredes (igual que moveEntity pero más simple)
  const newX = player.position.x + _knockbackVX * dt;
  const newZ = player.position.z + _knockbackVZ * dt;
  if (!isWall(cellRow(newZ), cellCol(newX))) {
    player.position.x = newX;
    player.position.z = newZ;
  } else {
    // Intentar slide en cada eje por separado
    if (!isWall(cellRow(player.position.z), cellCol(newX))) player.position.x = newX;
    else _knockbackVX = 0;
    if (!isWall(cellRow(newZ), cellCol(player.position.x))) player.position.z = newZ;
    else _knockbackVZ = 0;
  }

  const speed = Math.hypot(_knockbackVX, _knockbackVZ);
  if (speed > 0.5) {
    const stretch = Math.min(0.3, speed * 0.04);
    player.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
  }
}

export function getKnockbackRemaining() { return _knockbackRemaining; }
export function getKnockbackState() {
  return { vx: _knockbackVX, vz: _knockbackVZ, remaining: _knockbackRemaining };
}
export function resetKnockback() {
  _knockbackVX = 0; _knockbackVZ = 0; _knockbackRemaining = 0;
}

// ---- CAMERA FOLLOW — deadzone + look-ahead ----
let _camTargetX = 0, _camTargetZ = 10;
let _camLookX   = 0, _camLookZ   = 0;

export function setCameraTarget(x, z) { _camTargetX = x; _camTargetZ = z; }
export function setCameraLook(x, z)   { _camLookX   = x; _camLookZ   = z; }
export function getCameraTarget() { return { x: _camTargetX, z: _camTargetZ }; }
export function getCameraLook()   { return { x: _camLookX,   z: _camLookZ   }; }

export function updateCameraFollow(dt, player, playerMoving, moveDirX, moveDirZ, camera) {
  if (!player) return;
  const px = player.position.x;
  const pz = player.position.z;
  const LOOKAHEAD = 0.8;
  const wantX = px + (playerMoving ? moveDirX * LOOKAHEAD : 0);
  const wantZ = pz + 10 + (playerMoving ? moveDirZ * LOOKAHEAD : 0);
  const lookX = px + (playerMoving ? moveDirX * LOOKAHEAD * 0.6 : 0);
  const lookZ = pz + (playerMoving ? moveDirZ * LOOKAHEAD * 0.6 : 0);
  if (!playerMoving &&
      Math.abs(wantX - _camTargetX) < 0.0001 &&
      Math.abs(wantZ - _camTargetZ) < 0.0001 &&
      Math.abs(lookX - _camLookX) < 0.0001 &&
      Math.abs(lookZ - _camLookZ) < 0.0001) {
    return;
  }
  const t = 1 - Math.exp(-6.0 * dt);
  _camTargetX += (wantX - _camTargetX) * t;
  _camTargetZ += (wantZ - _camTargetZ) * t;
  _camLookX += (lookX - _camLookX) * t;
  _camLookZ += (lookZ - _camLookZ) * t;
  camera.position.x = _camTargetX;
  camera.position.z = _camTargetZ;
  camera.lookAt(_camLookX, 0, _camLookZ);
}
