import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ==========================================
// PERFORMANCE SETTINGS
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
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));

// Disable expensive real-time shadows.
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

// ==========================================
// WORLD LIGHTING
// ==========================================

scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.8));

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(30, 50, 20);
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

// ==========================================
// LIGHT SYSTEM VARIABLES
// ==========================================

let headlights = [];
let emergencyLEDs = [];

let headlightsOn = false;
let emergencyLightsOn = false;
let emergencyPattern = 0;

// ==========================================
// VEHICLE BOUNDS
// ==========================================

function getVehicleBounds(model) {
  model.updateWorldMatrix(true, true);
  policeCar.updateWorldMatrix(true, true);

  const box = new THREE.Box3();
  const corners = Array.from(
    { length: 8 },
    () => new THREE.Vector3()
  );

  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    const b = child.geometry.boundingBox;
    if (!b || b.isEmpty()) return;

    const min = b.min;
    const max = b.max;

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
      box.expandByPoint(corner);
    }
  });

  return box;
}

// ==========================================
// LED CREATION
// ==========================================

function makeLED(x, y, z, width, height, depth, color, group = policeCar) {
  const material = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.05,
    roughness: 0.2,
    metalness: 0.05
  });

  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(
      width,
      height,
      depth,
      3,
      Math.min(height * 0.2, depth * 0.2)
    ),
    material
  );

  mesh.position.set(x, y, z);
  group.add(mesh);

  const entry = {
    mesh,
    material,
    color
  };

  emergencyLEDs.push(entry);
  return entry;
}

// ==========================================
// HEADLIGHTS
// ==========================================

function installHeadlights(bounds) {
  headlights = [];

  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  const frontZ = bounds.min.z - 0.025;
  const headlightY = bounds.min.y + height * 0.66;
  const headlightX = width * 0.34;

  for (const x of [-headlightX, headlightX]) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.05,
      roughness: 0.2
    });

    const lens = new THREE.Mesh(
      new RoundedBoxGeometry(
        width * 0.105,
        height * 0.052,
        0.035,
        3,
        0.01
      ),
      material
    );

    lens.position.set(x, headlightY, frontZ);
    policeCar.add(lens);

    headlights.push({ lens, material });
  }

  updateVehicleLights();
}

// ==========================================
// ROOF LIGHTBAR
// ==========================================

function installRoofLightbar(bounds) {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  // Low-profile lightbar proportions.
  const barWidth = width * 0.58;
  const barDepth = width * 0.085;
  const baseHeight = height * 0.014;
  const lensHeight = height * 0.035;

  const roofY = bounds.max.y + height * 0.004;

  // Cabin-centered position, slightly toward the front.
  const roofZ =
    bounds.min.z * 0.40 +
    bounds.max.z * 0.60;

  // Black mounting base.
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(
      barWidth,
      baseHeight,
      barDepth,
      4,
      baseHeight * 0.2
    ),
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      metalness: 0.7,
      roughness: 0.3
    })
  );

  base.position.set(
    0,
    roofY + baseHeight / 2,
    roofZ
  );

  policeCar.add(base);

  // Mounting feet.
  for (const x of [-barWidth * 0.32, barWidth * 0.32]) {
    const foot = new THREE.Mesh(
      new RoundedBoxGeometry(
        barWidth * 0.055,
        baseHeight * 0.8,
        barDepth * 0.55,
        2,
        0.006
      ),
      new THREE.MeshStandardMaterial({
        color: 0x08090b,
        metalness: 0.6,
        roughness: 0.4
      })
    );

    foot.position.set(x, roofY, roofZ);
    policeCar.add(foot);
  }

  // Three red modules and three blue modules.
  const moduleWidth = barWidth * 0.145;
  const moduleHeight = lensHeight * 0.78;
  const moduleDepth = barDepth * 0.68;
  const spacing = barWidth * 0.16;

  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? 'red' : 'blue';
    const color = side === 'red' ? 0xff1010 : 0x075dff;

    const x = (i - 2.5) * spacing;
    const y = roofY + baseHeight + moduleHeight / 2;

    const housing = new THREE.Mesh(
      new RoundedBoxGeometry(
        moduleWidth * 1.1,
        moduleHeight * 1.15,
        moduleDepth * 1.1,
        3,
        moduleHeight * 0.15
      ),
      new THREE.MeshStandardMaterial({
        color: 0x11151b,
        metalness: 0.5,
        roughness: 0.3
      })
    );

    housing.position.set(x, y, roofZ);
    policeCar.add(housing);

    makeLED(
      x,
      y,
      roofZ - moduleDepth * 0.06,
      moduleWidth * 0.82,
      moduleHeight * 0.75,
      moduleDepth * 0.8,
      color
    );
  }

  // Dark end caps.
  for (const x of [-barWidth * 0.49, barWidth * 0.49]) {
    const cap = new THREE.Mesh(
      new RoundedBoxGeometry(
        moduleWidth * 0.3,
        lensHeight * 0.65,
        barDepth * 0.65,
        3,
        0.008
      ),
      new THREE.MeshStandardMaterial({
        color: 0x11151b,
        metalness: 0.5,
        roughness: 0.3
      })
    );

    cap.position.set(
      x,
      roofY + baseHeight + lensHeight * 0.35,
      roofZ
    );

    policeCar.add(cap);
  }
}

// ==========================================
// FRONT GRILLE LIGHTS
// ==========================================

function installFrontLights(bounds) {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  const frontZ = bounds.min.z - 0.045;
  const grilleY = bounds.min.y + height * 0.43;

  makeLED(
    -width * 0.19,
    grilleY,
    frontZ,
    width * 0.09,
    height * 0.045,
    0.035,
    0xff1010
  );

  makeLED(
    width * 0.19,
    grilleY,
    frontZ,
    width * 0.09,
    height * 0.045,
    0.035,
    0x075dff
  );
}

// ==========================================
// REAR EMERGENCY LIGHTS
// ==========================================

function installRearLights(bounds) {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  const rearZ = bounds.max.z + 0.045;
  const rearY = bounds.min.y + height * 0.63;

  makeLED(
    -width * 0.30,
    rearY,
    rearZ,
    width * 0.09,
    height * 0.045,
    0.035,
    0x075dff
  );

  makeLED(
    width * 0.30,
    rearY,
    rearZ,
    width * 0.09,
    height * 0.045,
    0.035,
    0xff1010
  );
}

// ==========================================
// INSTALL LIGHTING
// ==========================================

function installVehicleLights(model) {
  emergencyLEDs = [];

  const bounds = getVehicleBounds(model);

  installHeadlights(bounds);
  installRoofLightbar(bounds);
  installFrontLights(bounds);
  installRearLights(bounds);

  updateEmergencyStatus();

  console.log('Vehicle lighting installed.', bounds);
}

// ==========================================
// HEADLIGHT CONTROL
// ==========================================

function updateVehicleLights() {
  headlights.forEach(({ material }) => {
    material.emissiveIntensity = headlightsOn ? 2.5 : 0.05;
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
// EMERGENCY LIGHT FLASHING
// No spotlights, no shadows, no extra lights.
// ==========================================

function updateEmergencyLights(time) {
  if (!emergencyLEDs.length) return;

  if (!emergencyLightsOn) {
    emergencyLEDs.forEach(item => {
      item.material.emissiveIntensity = 0.05;
    });
    return;
  }

  const redOn = (sideTime) => {
    if (emergencyPattern === 0) {
      return Math.floor(sideTime / 180) % 2 === 0;
    }

    if (emergencyPattern === 1) {
      return Math.floor(sideTime / 85) % 2 === 0;
    }

    const phase = sideTime % 900;
    return phase < 100 || (phase > 190 && phase < 290);
  };

  const redActive = redOn(time);
  const blueActive = redOn(time + 180);

  emergencyLEDs.forEach(item => {
    const isRed =
      item.color === 0xff1010;

    const active = isRed ? redActive : blueActive;

    item.material.emissiveIntensity = active ? 5 : 0.04;
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
