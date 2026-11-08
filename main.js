import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 220);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// LIGHTING
scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
scene.add(sun);

// HUD
const hud = document.createElement('div');
hud.style.cssText = `
position:fixed;top:15px;left:15px;padding:14px;
background:#111c;color:white;border-radius:8px;
font:15px Arial;line-height:1.7;z-index:10;
`;
hud.innerHTML = `
<b>POLICE SIMULATOR</b><br>
WASD - Move / Drive<br>
Mouse - Look around<br>
E - Enter / Exit vehicle<br>
H - Headlights On / Off<br>
J - Emergency Lights On / Off<br>
K - Change Emergency Pattern<br>
Shift + , - Left Signal<br>
Shift + . - Right Signal<br>
B - Cancel Signals<br>
<span id="status">ON FOOT</span><br>
<span id="lightStatus">LIGHTS OFF</span><br>
<span id="emergencyStatus">EMERGENCY LIGHTS OFF</span>
`;
document.body.appendChild(hud);

const message = document.createElement('div');
message.style.cssText = `
position:fixed;bottom:35px;left:50%;transform:translateX(-50%);
padding:12px 20px;background:#111c;color:white;
border-radius:8px;font:bold 18px Arial;z-index:10;
`;
document.body.appendChild(message);

// GROUND
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0x477b43 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
scene.add(ground);

// ROADS
function makeRoad(x, z, width, depth) {
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0x303238 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0, z);
  scene.add(road);
}

makeRoad(0, 0, 18, 300);
makeRoad(0, 0, 300, 18);

// ROAD MARKINGS
for (let i = -140; i <= 140; i += 12) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.03, i);
  scene.add(line);
}

// BUILDINGS
function makeBuilding(x, z, width, height, depth, color) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color })
  );

  building.position.set(x, height / 2, z);
  scene.add(building);

  for (let y = 2; y < height - 1; y += 3) {
    for (let side = -1; side <= 1; side += 2) {
      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x83b8d8 })
      );

      windowMesh.position.set(
        x + side * (width / 2 + 0.05),
        y,
        z
      );

      scene.add(windowMesh);
    }
  }
}

const buildingColors = [0x888888, 0x9b8065, 0x777f8a, 0xb5a28c];

for (let x = -100; x <= 100; x += 30) {
  for (let z = -100; z <= 100; z += 30) {
    if (Math.abs(x) < 15 || Math.abs(z) < 15) continue;

    makeBuilding(
      x, z, 12, 10 + Math.random() * 22, 12,
      buildingColors[Math.floor(Math.random() * buildingColors.length)]
    );
  }
}

// POLICE VEHICLE
const policeCar = new THREE.Group();
scene.add(policeCar);
policeCar.position.set(6, 0, 8);

// TEMPORARY CAR
function makeTemporaryCar() {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1, 4.8),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  body.position.y = 0.9;
  policeCar.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.8, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  roof.position.y = 1.75;
  policeCar.add(roof);

  for (const x of [-1.15, 1.15]) {
    for (const z of [-1.5, 1.5]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.25, 20),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.45, z);
      policeCar.add(wheel);
    }
  }
}

makeTemporaryCar();

// VEHICLE LIGHTS
let headlights = [];
let daytimeLights = [];
let leftSignals = [];
let rightSignals = [];
let brakeLights = [];

let headlightsOn = false;
let turnSignal = 'off';

// EMERGENCY LIGHTS
let emergencyModules = [];
let emergencyLightsOn = false;
let emergencyPattern = 0;

// Create an invisible point light.
function makeInvisiblePointLight(color, intensity, distance, x, y, z, parent) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  light.visible = false;
  parent.add(light);
  return light;
}

// Hidden decorative lens.
function makeHiddenLens(color, width, height, depth, x, y, z, parent) {
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0
    })
  );

  lens.scale.set(width / 2, height / 2, depth / 2);
  lens.position.set(x, y, z);
  lens.visible = false;
  parent.add(lens);
  return lens;
}

// Calculate vehicle-local bounds.
function getVehicleBounds(model) {
  model.updateWorldMatrix(true, true);
  policeCar.updateWorldMatrix(true, true);

  const localBox = new THREE.Box3();
  const corners = Array.from(
    { length: 8 },
    () => new THREE.Vector3()
  );

  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    const geometryBox = child.geometry.boundingBox;
    if (!geometryBox || geometryBox.isEmpty()) return;

    const min = geometryBox.min;
    const max = geometryBox.max;

    corners[0].set(min.x, min.y, min.z);
    corners[1].set(min.x, min.y, max.z);
    corners[2].set(min.x, max.y, min.z);
    corners[3].set(min.x, max.y, max.z);
    corners[4].set(max.x, min.y, min.z);
    corners[5].set(max.x, min.y, max.z);
    corners[6].set(max.x, max.y, min.z);
    corners[7].set(max.x, max.y, max.z);

    for (const corner of corners) {
      corner.applyMatrix4(child.matrixWorld);
      policeCar.worldToLocal(corner);
      localBox.expandByPoint(corner);
    }
  });

  return localBox;
}

// Find front/rear body surface.
function findBodySurface(modelMeshes, bounds, x, isFront) {
  const raycaster = new THREE.Raycaster();

  const outsideZ = isFront
    ? bounds.min.z - 3
    : bounds.max.z + 3;

  const direction = new THREE.Vector3(
    0, 0, isFront ? 1 : -1
  );

  const heightFractions = [0.62, 0.58, 0.66, 0.54, 0.70];

  let bestPoint = null;
  let bestScore = Infinity;

  for (const fraction of heightFractions) {
    const targetY = bounds.min.y +
      (bounds.max.y - bounds.min.y) * fraction;

    const localOrigin = new THREE.Vector3(x, targetY, outsideZ);
    const worldOrigin = policeCar.localToWorld(localOrigin.clone());

    const worldDirection = policeCar.localToWorld(
      localOrigin.clone().add(direction)
    ).sub(worldOrigin).normalize();

    raycaster.set(worldOrigin, worldDirection);

    const hits = raycaster.intersectObjects(modelMeshes, false);

    if (hits.length === 0) continue;

    const localHit = policeCar.worldToLocal(hits[0].point.clone());
    const score = Math.abs(localHit.y - targetY);

    if (score < bestScore) {
      bestScore = score;
      bestPoint = localHit.clone();
    }
  }

  if (!bestPoint) {
    bestPoint = new THREE.Vector3(
      x,
      bounds.min.y + (bounds.max.y - bounds.min.y) * 0.62,
      isFront ? bounds.min.z : bounds.max.z
    );
  }

  return bestPoint;
}

// Convert vehicle-local position to model-local position.
function vehiclePointToModel(model, point) {
  const worldPoint = policeCar.localToWorld(point.clone());
  return model.worldToLocal(worldPoint);
}

// Create headlights.
function makeSpotlight(x, y, z, targetZ) {
  const beam = new THREE.SpotLight(
    0xffffff, 55, 65, Math.PI / 5, 0.45, 1
  );

  beam.position.set(x, y, z);
  beam.target.position.set(x, y - 0.2, targetZ);
  beam.visible = false;

  policeCar.add(beam);
  policeCar.add(beam.target);

  return beam;
}

// Create a visible emergency LED module and its light.
function makeEmergencyModule(model, color, point, width, height, depth) {
  const modelPoint = vehiclePointToModel(model, point);

  const scale = model.scale.x || 1;

  const lensMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.12,
    metalness: 0.1,
    roughness: 0.22
  });

  const lens = new THREE.Mesh(
    new THREE.BoxGeometry(
      width / scale,
      height / scale,
      depth / scale
    ),
    lensMaterial
  );

  lens.position.copy(modelPoint);
  model.add(lens);

  const light = new THREE.PointLight(color, 0, 9, 2);
  light.position.copy(modelPoint);
  light.visible = true;
  model.add(light);

  emergencyModules.push({
    lens,
    material: lensMaterial,
    light,
    color
  });
}

// Install roof lightbar, grille lights, and rear lights.
function installEmergencyLights(model, bounds, modelMeshes) {
  emergencyModules = [];

  const scale = model.scale.x || 1;
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const depth = bounds.max.z - bounds.min.z;

  // ROOF LIGHTBAR
  // The bar is mounted just above the Explorer roof.
  const barWidth = width * 0.72;
  const barDepth = Math.min(depth * 0.12, 0.72);
  const barHeight = Math.max(height * 0.025, 0.09);

  const roofPoint = new THREE.Vector3(
    0,
    bounds.max.y + height * 0.012,
    (bounds.min.z + bounds.max.z) / 2
  );

  const roofLocal = vehiclePointToModel(model, roofPoint);

  const barGroup = new THREE.Group();
  barGroup.position.copy(roofLocal);
  model.add(barGroup);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      barWidth / scale,
      barHeight / scale,
      barDepth / scale
    ),
    new THREE.MeshStandardMaterial({
      color: 0x111318,
      metalness: 0.65,
      roughness: 0.35
    })
  );

  barGroup.add(base);

  // Eight separate LED modules, alternating red and blue.
  const moduleCount = 8;
  const moduleWidth = barWidth * 0.105;
  const moduleHeight = barHeight * 0.85;
  const moduleDepth = barDepth * 0.84;
  const spacing = barWidth * 0.115;

  for (let i = 0; i < moduleCount; i++) {
    const isRed = i % 2 === 0;
    const color = isRed ? 0xff1010 : 0x086bff;

    const lensMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.12,
      metalness: 0.05,
      roughness: 0.2
    });

    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(
        moduleWidth / scale,
        moduleHeight / scale,
        moduleDepth / scale
      ),
      lensMaterial
    );

    const x = (i - (moduleCount - 1) / 2) * spacing / scale;
    lens.position.set(x, 0, 0);
    barGroup.add(lens);

    const light = new THREE.PointLight(color, 0, 10, 2);
    light.position.set(x, moduleHeight / scale, 0);
    barGroup.add(light);

    emergencyModules.push({
      lens,
      material: lensMaterial,
      light,
      color,
      side: isRed ? 'red' : 'blue',
      index: i
    });
  }

  // GRILLE LIGHTS: four modules across the front.
  const frontZ = bounds.min.z - 0.045;
  const grilleY = bounds.min.y + height * 0.48;

  for (let i = 0; i < 4; i++) {
    const x = bounds.min.x + width * (0.25 + i * 0.167);
    const point = new THREE.Vector3(x, grilleY, frontZ);

    makeEmergencyModule(
      model,
      i % 2 === 0 ? 0xff1010 : 0x086bff,
      point,
      width * 0.075,
      height * 0.055,
      0.055
    );
  }

  // REAR EMERGENCY LIGHTS: four modules.
  const rearZ = bounds.max.z + 0.045;
  const rearY = bounds.min.y + height * 0.60;

  for (let i = 0; i < 4; i++) {
    const x = bounds.min.x + width * (0.25 + i * 0.167);
    const point = new THREE.Vector3(x, rearY, rearZ);

    makeEmergencyModule(
      model,
      i % 2 === 0 ? 0x086bff : 0xff1010,
      point,
      width * 0.075,
      height * 0.055,
      0.055
    );
  }

  console.log('Emergency lightbar, grille and rear lights installed.');
}

// INSTALL VEHICLE LIGHTS
function installVehicleLights(model) {
  headlights = [];
  daytimeLights = [];
  leftSignals = [];
  rightSignals = [];
  brakeLights = [];

  const bounds = getVehicleBounds(model);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  const modelMeshes = [];

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      modelMeshes.push(child);
    }
  });

  const leftX = bounds.min.x + width * 0.29;
  const rightX = bounds.max.x - width * 0.29;

  const frontLeft = findBodySurface(modelMeshes, bounds, leftX, true);
  const frontRight = findBodySurface(modelMeshes, bounds, rightX, true);

  const rearLeft = findBodySurface(modelMeshes, bounds, leftX, false);
  const rearRight = findBodySurface(modelMeshes, bounds, rightX, false);

  // HEADLIGHTS
  for (const point of [frontLeft, frontRight]) {
    const lensPoint = point.clone();
    lensPoint.z -= 0.035;

    const modelPoint = vehiclePointToModel(model, lensPoint);

    makeHiddenLens(
      0xffffff,
      width * 0.115,
      height * 0.052,
      0.045,
      modelPoint.x,
      modelPoint.y,
      modelPoint.z,
      model
    );

    headlights.push(
      makeSpotlight(point.x, point.y, point.z - 0.12, point.z - 30)
    );
  }

  // DAYTIME RUNNING LIGHTS
  for (const point of [frontLeft, frontRight]) {
    const drlPoint = point.clone();
    drlPoint.y -= height * 0.035;
    drlPoint.z -= 0.045;

    const modelPoint = vehiclePointToModel(model, drlPoint);

    makeHiddenLens(
      0xe8fbff,
      width * 0.13,
      height * 0.022,
      0.035,
      modelPoint.x,
      modelPoint.y,
      modelPoint.z,
      model
    );
  }

  // TURN SIGNALS
  function makeIndicator(point, isFront) {
    const signalPoint = point.clone();
    signalPoint.z += isFront ? -0.055 : 0.055;

    const modelPoint = vehiclePointToModel(model, signalPoint);

    makeHiddenLens(
      0xffa000,
      width * 0.075,
      height * 0.045,
      0.045,
      modelPoint.x,
      modelPoint.y,
      modelPoint.z,
      model
    );

    return makeInvisiblePointLight(
      0xff9900, 3, 5,
      modelPoint.x,
      modelPoint.y,
      modelPoint.z,
      model
    );
  }

  leftSignals.push(makeIndicator(frontLeft, true));
  leftSignals.push(makeIndicator(rearLeft, false));

  rightSignals.push(makeIndicator(frontRight, true));
  rightSignals.push(makeIndicator(rearRight, false));

  // BRAKE LIGHTS
  for (const point of [rearLeft, rearRight]) {
    const brakePoint = point.clone();

    brakePoint.x *= 0.72;
    brakePoint.y -= height * 0.025;
    brakePoint.z += 0.065;

    const modelPoint = vehiclePointToModel(model, brakePoint);

    makeHiddenLens(
      0xff1010,
      width * 0.105,
      height * 0.055,
      0.045,
      modelPoint.x,
      modelPoint.y,
      modelPoint.z,
      model
    );

    brakeLights.push(
      makeInvisiblePointLight(
        0xff1010, 0, 5,
        modelPoint.x,
        modelPoint.y,
        modelPoint.z,
        model
      )
    );
  }

  // EMERGENCY LIGHTS
  installEmergencyLights(model, bounds, modelMeshes);

  updateVehicleLights();
  updateEmergencyStatus();

  console.log('Vehicle lighting installed.');
}

// UPDATE HEADLIGHTS
function updateVehicleLights() {
  headlights.forEach(light => {
    light.visible = headlightsOn;
  });

  const lightStatus = document.getElementById('lightStatus');

  if (lightStatus) {
    lightStatus.textContent = headlightsOn
      ? 'HEADLIGHTS ON'
      : 'HEADLIGHTS OFF';
  }
}

// EMERGENCY LIGHT STATUS
function updateEmergencyStatus() {
  const status = document.getElementById('emergencyStatus');

  if (!status) return;

  status.textContent = emergencyLightsOn
    ? `EMERGENCY LIGHTS ON | PATTERN ${emergencyPattern + 1}`
    : 'EMERGENCY LIGHTS OFF';
}

// EMERGENCY FLASHING SYSTEM
function updateEmergencyLights(time) {
  if (!emergencyModules.length) return;

  if (!emergencyLightsOn) {
    emergencyModules.forEach(module => {
      module.light.intensity = 0;
      module.material.emissiveIntensity = 0.12;
    });
    return;
  }

  const phase = time % 1200;
  const fastPhase = Math.floor(time / 100) % 2;

  emergencyModules.forEach((module, index) => {
    let on = false;

    if (emergencyPattern === 0) {
      // Pattern 1: alternating red and blue.
      on = module.side === (Math.floor(time / 180) % 2 === 0 ? 'red' : 'blue');
    }

    if (emergencyPattern === 1) {
      // Pattern 2: rapid alternating flashes.
      on = module.side === (fastPhase === 0 ? 'red' : 'blue');
    }

    if (emergencyPattern === 2) {
      // Pattern 3: double flash, then pause.
      const flash = phase < 100 || (phase >= 200 && phase < 300);
      on = flash && module.side === (Math.floor(time / 600) % 2 === 0 ? 'red' : 'blue');
    }

    // Small variation across modules creates a more realistic sequence.
    if (index >= 8) {
      on = on && Math.floor(time / 180) % 2 === 0;
    }

    module.light.intensity = on ? 5 : 0;
    module.material.emissiveIntensity = on ? 3.5 : 0.12;
  });
}

// LOAD FORD EXPLORER
const loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
);
loader.setDRACOLoader(dracoLoader);

loader.load(
  './police_explorer.glb',

  (gltf) => {
    const model = gltf.scene;

    // Preserve working Explorer alignment.
    model.rotation.y = Math.PI;

    const originalBox = new THREE.Box3().setFromObject(model);
    const originalSize = originalBox.getSize(new THREE.Vector3());

    const scale = 8.5 / Math.max(originalSize.x, originalSize.z);
    model.scale.setScalar(scale);

    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());

    model.position.set(
      -center.x,
      -box.min.y,
      -center.z
    );

    model.updateMatrixWorld(true);

    policeCar.clear();
    policeCar.add(model);
    policeCar.updateMatrixWorld(true);

    installVehicleLights(model);

    message.textContent = 'Ford Explorer loaded!';
    console.log('Ford Explorer loaded successfully!');
  },

  (progress) => {
    if (progress.total > 0) {
      console.log(
        'Loading Explorer:',
        Math.round((progress.loaded / progress.total) * 100) + '%'
      );
    }
  },

  (error) => {
    console.error('FORD EXPLORER LOADING ERROR:', error);
    message.textContent = 'Explorer failed to load!';
  }
);

// PLAYER CONTROLS
let yaw = 0;
let pitch = 0;
let driving = false;
let carSpeed = 0;

const keys = {};

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  keys[key] = true;

  // ENTER / EXIT VEHICLE
  if (key === 'e' && !event.repeat) {
    if (!driving) {
      const distance = Math.hypot(
        camera.position.x - policeCar.position.x,
        camera.position.z - policeCar.position.z
      );

      if (distance < 7) {
        driving = true;
        carSpeed = 0;
        yaw = policeCar.rotation.y;
        pitch = 0;
        document.exitPointerLock?.();
      } else {
        message.textContent = 'Walk closer to your police SUV!';
      }
    } else {
      driving = false;
      carSpeed = 0;

      const offset = new THREE.Vector3(3.5, 0, 0);
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        policeCar.rotation.y
      );

      camera.position.set(
        policeCar.position.x + offset.x,
        2,
        policeCar.position.z + offset.z
      );

      yaw = policeCar.rotation.y;
      pitch = 0;
    }
  }

  // HEADLIGHT SWITCH
  if (key === 'h' && !event.repeat) {
    headlightsOn = !headlightsOn;
    updateVehicleLights();
  }

  // EMERGENCY LIGHT SWITCH
  if (key === 'j' && !event.repeat) {
    emergencyLightsOn = !emergencyLightsOn;
    updateEmergencyStatus();
  }

  // CHANGE EMERGENCY FLASH PATTERN
  if (key === 'k' && !event.repeat) {
    emergencyPattern = (emergencyPattern + 1) % 3;
    updateEmergencyStatus();
  }

  // LEFT TURN SIGNAL
  if (event.code === 'Comma' && event.shiftKey && !event.repeat) {
    event.preventDefault();
    turnSignal = turnSignal === 'left' ? 'off' : 'left';
  }

  // RIGHT TURN SIGNAL
  if (event.code === 'Period' && event.shiftKey && !event.repeat) {
    event.preventDefault();
    turnSignal = turnSignal === 'right' ? 'off' : 'right';
  }

  // CANCEL TURN SIGNALS
  if (key === 'b' && !event.repeat) {
    turnSignal = 'off';
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

// MOUSE LOOK
renderer.domElement.addEventListener('click', () => {
  if (!driving) renderer.domElement.requestPointerLock();
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === renderer.domElement && !driving) {
    yaw -= event.movementX * 0.002;
    pitch -= event.movementY * 0.002;
    pitch = THREE.MathUtils.clamp(pitch, -1.4, 1.4);
  }
});

// GAME LOOP
function animate() {
  requestAnimationFrame(animate);

  if (!driving) {
    const direction = new THREE.Vector3();

    if (keys.w) direction.z -= 1;
    if (keys.s) direction.z += 1;
    if (keys.a) direction.x -= 1;
    if (keys.d) direction.x += 1;

    direction.normalize();
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    camera.position.x += direction.x * 0.13;
    camera.position.z += direction.z * 0.13;

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -140, 140);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -140, 140);

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    hud.querySelector('#status').textContent = 'ON FOOT';

    const distance = Math.hypot(
      camera.position.x - policeCar.position.x,
      camera.position.z - policeCar.position.z
    );

    message.textContent =
      distance < 7 ? 'Press E to enter your police SUV' : '';

  } else {
    if (keys.w) carSpeed += 0.012;
    if (keys.s) carSpeed -= 0.012;

    carSpeed *= 0.985;
    carSpeed = THREE.MathUtils.clamp(carSpeed, -0.3, 0.7);

    if (Math.abs(carSpeed) > 0.01) {
      if (keys.a) policeCar.rotation.y += 0.025 * Math.sign(carSpeed);
      if (keys.d) policeCar.rotation.y -= 0.025 * Math.sign(carSpeed);
    }

    policeCar.position.x -= Math.sin(policeCar.rotation.y) * carSpeed;
    policeCar.position.z -= Math.cos(policeCar.rotation.y) * carSpeed;

    const offset = new THREE.Vector3(0, 3.5, 8);
    offset.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      policeCar.rotation.y
    );

    camera.position.copy(policeCar.position).add(offset);

    camera.lookAt(
      policeCar.position.x,
      policeCar.position.y + 1,
      policeCar.position.z
    );

    hud.querySelector('#status').textContent =
      'DRIVING | SPEED: ' + Math.round(Math.abs(carSpeed) * 100);

    message.textContent = 'Press E to exit';
  }

  // TURN SIGNALS
  const signalFlash = Math.floor(performance.now() / 450) % 2 === 0;

  leftSignals.forEach(light => {
    light.visible = turnSignal === 'left' && signalFlash;
  });

  rightSignals.forEach(light => {
    light.visible = turnSignal === 'right' && signalFlash;
  });

  // BRAKE LIGHTS
  brakeLights.forEach(light => {
    light.intensity = keys.s ? 3 : 0;
  });

  // EMERGENCY LIGHTS
  updateEmergencyLights(performance.now());

  renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
