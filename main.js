import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ==========================================
// SCENE
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 220);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ==========================================
// LIGHTING
// ==========================================

scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
scene.add(sun);

// ==========================================
// HUD
// ==========================================

const hud = document.createElement('div');

hud.style.cssText = `
position:fixed;
top:15px;
left:15px;
padding:14px;
background:#111c;
color:white;
border-radius:8px;
font:15px Arial;
line-height:1.7;
z-index:10;
`;

hud.innerHTML = `
<b>POLICE SIMULATOR</b><br>
WASD - Move / Drive<br>
Mouse - Look around<br>
E - Enter / Exit vehicle<br>
H - Headlights On / Off<br>
J - Emergency Lights On / Off<br>
K - Change Emergency Pattern<br>
<span id="status">ON FOOT</span><br>
<span id="lightStatus">HEADLIGHTS OFF</span><br>
<span id="emergencyStatus">EMERGENCY LIGHTS OFF</span>
`;

document.body.appendChild(hud);

const message = document.createElement('div');

message.style.cssText = `
position:fixed;
bottom:35px;
left:50%;
transform:translateX(-50%);
padding:12px 20px;
background:#111c;
color:white;
border-radius:8px;
font:bold 18px Arial;
z-index:10;
`;

document.body.appendChild(message);

// ==========================================
// GROUND AND ROADS
// ==========================================

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0x477b43 })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
scene.add(ground);

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

for (let i = -140; i <= 140; i += 12) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );

  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.03, i);
  scene.add(line);
}

// ==========================================
// BUILDINGS
// ==========================================

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
      x,
      z,
      12,
      10 + Math.random() * 22,
      12,
      buildingColors[Math.floor(Math.random() * buildingColors.length)]
    );
  }
}

// ==========================================
// POLICE VEHICLE
// ==========================================

const policeCar = new THREE.Group();
scene.add(policeCar);
policeCar.position.set(6, 0, 8);

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

// ==========================================
// LIGHT VARIABLES
// ==========================================

let headlights = [];
let emergencyModules = [];
let roofEmergencyLights = [];

let headlightsOn = false;
let emergencyLightsOn = false;
let emergencyPattern = 0;

// ==========================================
// HIDDEN LENS
// ==========================================

function makeHiddenLens(color, width, height, depth, x, y, z, parent) {
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 6),
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

// ==========================================
// VEHICLE BOUNDS
// ==========================================

function getVehicleBounds(model) {
  model.updateWorldMatrix(true, true);
  policeCar.updateWorldMatrix(true, true);

  const localBox = new THREE.Box3();
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());

  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    const box = child.geometry.boundingBox;
    if (!box || box.isEmpty()) return;

    const min = box.min;
    const max = box.max;

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

// ==========================================
// COORDINATE CONVERSION
// ==========================================

function vehiclePointToModel(model, point) {
  const worldPoint = policeCar.localToWorld(point.clone());
  return model.worldToLocal(worldPoint);
}

// ==========================================
// HEADLIGHT SPOTLIGHTS
// ==========================================

function makeSpotlight(x, y, z, targetZ) {
  const beam = new THREE.SpotLight(
    0xffffff, 55, 65, Math.PI / 5, 0.45, 1
  );

  beam.position.set(x, y, z);
  beam.target.position.set(x, y - 0.2, targetZ);
  beam.visible = false;
  beam.castShadow = false;

  policeCar.add(beam);
  policeCar.add(beam.target);

  return beam;
}

// ==========================================
// REALISTIC LOW-PROFILE LED LIGHTBAR
// ==========================================

function installEmergencyLights(model, bounds) {
  emergencyModules = [];
  roofEmergencyLights = [];

  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  const modelScale = Math.abs(model.scale.x) || 1;

  // Convert vehicle dimensions into model-local dimensions.
  const localWidth = width / modelScale;
  const localHeight = height / modelScale;

  // Place the bar just above the highest point of the vehicle.
  const roofY = bounds.max.y + height * 0.004;
  const roofZ = (bounds.min.z + bounds.max.z) / 2;

  // Overall lightbar proportions.
  const barWidth = localWidth * 0.49;
  const barDepth = localWidth * 0.095;

  const baseHeight = localHeight * 0.009;
  const lensHeight = localHeight * 0.026;

  const lensDepth = barDepth * 0.76;

  // Convert a vehicle-space position to model space.
  function addPartPosition(mesh, x, y, z) {
    mesh.position.copy(
      vehiclePointToModel(
        model,
        new THREE.Vector3(x, y, z)
      )
    );

    model.add(mesh);
  }

  // Convert vehicle-space dimensions to model-space dimensions.
  function localDimensions(w, h, d) {
    return [
      w / modelScale,
      h / modelScale,
      d / modelScale
    ];
  }

  // Black metal mounting base.
  const [baseW, baseH, baseD] = localDimensions(
    barWidth,
    baseHeight,
    barDepth
  );

  const base = new THREE.Mesh(
    new RoundedBoxGeometry(
      baseW,
      baseH,
      baseD,
      3,
      Math.max(0.001, baseH * 0.2)
    ),
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      metalness: 0.75,
      roughness: 0.28
    })
  );

  addPartPosition(
    base,
    0,
    roofY + baseHeight / 2,
    roofZ
  );

  // Small black mounting feet.
  const footMaterial = new THREE.MeshStandardMaterial({
    color: 0x08090b,
    metalness: 0.6,
    roughness: 0.35
  });

  for (const x of [-barWidth * 0.32, barWidth * 0.32]) {
    const [footW, footH, footD] = localDimensions(
      barWidth * 0.035,
      baseHeight * 0.8,
      barDepth * 0.55
    );

    const foot = new THREE.Mesh(
      new RoundedBoxGeometry(footW, footH, footD, 2, footH * 0.2),
      footMaterial
    );

    addPartPosition(
      foot,
      x,
      roofY - baseHeight * 0.15,
      roofZ
    );
  }

  // Six separate LED modules: three red and three blue.
  const moduleWidth = barWidth * 0.145;
  const moduleHeight = lensHeight * 0.78;
  const moduleDepth = lensDepth * 0.72;

  const moduleSpacing = barWidth * 0.163;
  const moduleY = roofY + baseHeight + lensHeight / 2;

  const redMaterials = [];
  const blueMaterials = [];

  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? 'red' : 'blue';
    const color = side === 'red' ? 0xff2020 : 0x176bff;
    const emissive = side === 'red' ? 0xff0000 : 0x004cff;

    const x = (i - 2.5) * moduleSpacing;

    // Dark reflector behind each LED module.
    const [reflectW, reflectH, reflectD] = localDimensions(
      moduleWidth * 1.08,
      moduleHeight * 1.12,
      moduleDepth * 1.08
    );

    const reflector = new THREE.Mesh(
      new RoundedBoxGeometry(
        reflectW,
        reflectH,
        reflectD,
        3,
        reflectH * 0.15
      ),
      new THREE.MeshStandardMaterial({
        color: 0x171a20,
        metalness: 0.8,
        roughness: 0.25
      })
    );

    addPartPosition(reflector, x, moduleY, roofZ);

    // LED lens material.
    const ledMaterial = new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 0,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08
    });

    const [lensW, lensH, lensD] = localDimensions(
      moduleWidth * 0.88,
      moduleHeight * 0.78,
      moduleDepth * 0.72
    );

    const ledLens = new THREE.Mesh(
      new RoundedBoxGeometry(
        lensW,
        lensH,
        lensD,
        4,
        lensH * 0.18
      ),
      ledMaterial
    );

    addPartPosition(
      ledLens,
      x,
      moduleY,
      roofZ
    );

    roofEmergencyLights.push({
      material: ledMaterial,
      side
    });

    if (side === 'red') {
      redMaterials.push(ledMaterial);
    } else {
      blueMaterials.push(ledMaterial);
    }

    // Small internal LED points across each module.
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: side === 'red' ? 0xffaaaa : 0xaacaff
    });

    for (let dot = -1; dot <= 1; dot++) {
      const [dotW, dotH, dotD] = localDimensions(
        moduleWidth * 0.13,
        moduleHeight * 0.2,
        moduleDepth * 0.12
      );

      const dotMesh = new THREE.Mesh(
        new RoundedBoxGeometry(
          dotW,
          dotH,
          dotD,
          2,
          dotH * 0.2
        ),
        dotMaterial
      );

      addPartPosition(
        dotMesh,
        x + dot * moduleWidth * 0.23,
        moduleY,
        roofZ - barDepth * 0.12
      );
    }
  }

  // Smoked transparent outer cover.
  // This sits over the LED modules without hiding their colors.
  const coverHeight = baseHeight + lensHeight * 1.12;

  const [coverW, coverH, coverD] = localDimensions(
    barWidth * 1.015,
    coverHeight,
    barDepth * 0.94
  );

  const coverMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x26313e,
    transparent: true,
    opacity: 0.2,
    roughness: 0.16,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    depthWrite: false
  });

  const cover = new THREE.Mesh(
    new RoundedBoxGeometry(
      coverW,
      coverH,
      coverD,
      5,
      coverH * 0.12
    ),
    coverMaterial
  );

  cover.renderOrder = 2;

  addPartPosition(
    cover,
    0,
    roofY + coverHeight / 2,
    roofZ
  );

  // ========================================
  // INVISIBLE EMERGENCY SPOTLIGHTS
  // ========================================

  function addEmergencySpot(color, x, y, z, targetZ, side) {
    const position = vehiclePointToModel(
      model,
      new THREE.Vector3(x, y, z)
    );

    const targetPosition = vehiclePointToModel(
      model,
      new THREE.Vector3(x, y - 0.2, targetZ)
    );

    const light = new THREE.SpotLight(
      color, 0, 25, Math.PI / 2.5, 0.5, 1
    );

    light.position.copy(position);
    light.target.position.copy(targetPosition);
    light.castShadow = false;

    model.add(light);
    model.add(light.target);

    emergencyModules.push({ light, side });
  }

  const frontZ = bounds.min.z - 0.08;
  const rearZ = bounds.max.z + 0.08;
  const lightY = bounds.min.y + height * 0.62;

  addEmergencySpot(
    0xff0000, -width * 0.25, lightY,
    frontZ, frontZ - 15, 'red'
  );

  addEmergencySpot(
    0x0066ff, width * 0.25, lightY,
    frontZ, frontZ - 15, 'blue'
  );

  addEmergencySpot(
    0x0066ff, -width * 0.25, lightY,
    rearZ, rearZ + 15, 'blue'
  );

  addEmergencySpot(
    0xff0000, width * 0.25, lightY,
    rearZ, rearZ + 15, 'red'
  );

  console.log('Realistic LED lightbar installed.');
}

// ==========================================
// INSTALL HEADLIGHTS
// ==========================================

function installVehicleLights(model) {
  headlights = [];

  const bounds = getVehicleBounds(model);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  const leftX = bounds.min.x + width * 0.29;
  const rightX = bounds.max.x - width * 0.29;

  const frontLeft = new THREE.Vector3(
    leftX, bounds.min.y + height * 0.62, bounds.min.z
  );

  const frontRight = new THREE.Vector3(
    rightX, bounds.min.y + height * 0.62, bounds.min.z
  );

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
      makeSpotlight(
        point.x, point.y, point.z - 0.12, point.z - 30
      )
    );
  }

  installEmergencyLights(model, bounds);
  updateVehicleLights();
  updateEmergencyStatus();
}

// ==========================================
// UPDATE HEADLIGHTS
// ==========================================

function updateVehicleLights() {
  headlights.forEach(light => {
    light.visible = headlightsOn;
  });

  const status = document.getElementById('lightStatus');

  if (status) {
    status.textContent = headlightsOn
      ? 'HEADLIGHTS ON'
      : 'HEADLIGHTS OFF';
  }
}

// ==========================================
// EMERGENCY STATUS
// ==========================================

function updateEmergencyStatus() {
  const status = document.getElementById('emergencyStatus');
  if (!status) return;

  status.textContent = emergencyLightsOn
    ? `EMERGENCY LIGHTS ON | PATTERN ${emergencyPattern + 1}`
    : 'EMERGENCY LIGHTS OFF';
}

// ==========================================
// EMERGENCY FLASHING
// ==========================================

function updateEmergencyLights(time) {
  if (!emergencyModules.length) return;

  if (!emergencyLightsOn) {
    emergencyModules.forEach(module => {
      module.light.intensity = 0;
    });

    roofEmergencyLights.forEach(light => {
      light.material.emissiveIntensity = 0;
    });

    return;
  }

  const phase = Math.floor(time / 180) % 2;
  const fastPhase = Math.floor(time / 100) % 2;

  const doubleFlash =
    (time % 1000 < 120) ||
    (time % 1000 > 240 && time % 1000 < 360);

  function isSideOn(side) {
    if (emergencyPattern === 0) {
      return side === (phase === 0 ? 'red' : 'blue');
    }

    if (emergencyPattern === 1) {
      return side === (fastPhase === 0 ? 'red' : 'blue');
    }

    return doubleFlash &&
      side === (
        Math.floor(time / 500) % 2 === 0 ? 'red' : 'blue'
      );
  }

  emergencyModules.forEach(module => {
    module.light.intensity = isSideOn(module.side) ? 65 : 0;
  });

  roofEmergencyLights.forEach(light => {
    light.material.emissiveIntensity =
      isSideOn(light.side) ? 5 : 0.02;
  });
}

// ==========================================
// LOAD FORD EXPLORER
// ==========================================

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
    model.rotation.y = Math.PI;

    const originalBox = new THREE.Box3().setFromObject(model);
    const originalSize = originalBox.getSize(new THREE.Vector3());

    const scale = 8.5 / Math.max(
      originalSize.x,
      originalSize.z
    );

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
        Math.round(progress.loaded / progress.total * 100) + '%'
      );
    }
  },

  (error) => {
    console.error('FORD EXPLORER LOADING ERROR:', error);
    message.textContent = 'Explorer failed to load!';
  }
);

// ==========================================
// PLAYER CONTROLS
// ==========================================

let yaw = 0;
let pitch = 0;
let driving = false;
let carSpeed = 0;

const keys = {};

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

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

  if (key === 'h' && !event.repeat) {
    headlightsOn = !headlightsOn;
    updateVehicleLights();
  }

  if (key === 'j' && !event.repeat) {
    emergencyLightsOn = !emergencyLightsOn;
    updateEmergencyStatus();
  }

  if (key === 'k' && !event.repeat) {
    emergencyPattern = (emergencyPattern + 1) % 3;
    updateEmergencyStatus();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

// ==========================================
// MOUSE LOOK
// ==========================================

renderer.domElement.addEventListener('click', () => {
  if (!driving) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('mousemove', (event) => {
  if (
    document.pointerLockElement === renderer.domElement &&
    !driving
  ) {
    yaw -= event.movementX * 0.002;
    pitch -= event.movementY * 0.002;

    pitch = THREE.MathUtils.clamp(pitch, -1.4, 1.4);
  }
});

// ==========================================
// GAME LOOP
// ==========================================

function animate() {
  requestAnimationFrame(animate);

  if (!driving) {
    const direction = new THREE.Vector3();

    if (keys.w) direction.z -= 1;
    if (keys.s) direction.z += 1;
    if (keys.a) direction.x -= 1;
    if (keys.d) direction.x += 1;

    direction.normalize();

    direction.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw
    );

    camera.position.x += direction.x * 0.13;
    camera.position.z += direction.z * 0.13;

    camera.position.x = THREE.MathUtils.clamp(
      camera.position.x, -140, 140
    );

    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z, -140, 140
    );

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    hud.querySelector('#status').textContent = 'ON FOOT';

    const distance = Math.hypot(
      camera.position.x - policeCar.position.x,
      camera.position.z - policeCar.position.z
    );

    message.textContent = distance < 7
      ? 'Press E to enter your police SUV'
      : '';

  } else {
    if (keys.w) carSpeed += 0.012;
    if (keys.s) carSpeed -= 0.012;

    carSpeed *= 0.985;
    carSpeed = THREE.MathUtils.clamp(carSpeed, -0.3, 0.7);

    if (Math.abs(carSpeed) > 0.01) {
      if (keys.a) {
        policeCar.rotation.y += 0.025 * Math.sign(carSpeed);
      }

      if (keys.d) {
        policeCar.rotation.y -= 0.025 * Math.sign(carSpeed);
      }
    }

    policeCar.position.x -=
      Math.sin(policeCar.rotation.y) * carSpeed;

    policeCar.position.z -=
      Math.cos(policeCar.rotation.y) * carSpeed;

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
      'DRIVING | SPEED: ' +
      Math.round(Math.abs(carSpeed) * 100);

    message.textContent = 'Press E to exit';
  }

  updateEmergencyLights(performance.now());
  renderer.render(scene, camera);
}

animate();

// ==========================================
// RESIZE
// ==========================================

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
