import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ==========================================
// SCENE
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 220);

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  500
);

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

scene.add(
  new THREE.HemisphereLight(0xffffff, 0x555566, 2)
);

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
// GROUND
// ==========================================

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0x477b43 })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
scene.add(ground);

// ==========================================
// ROADS
// ==========================================

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

// ==========================================
// ROAD MARKINGS
// ==========================================

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

const buildingColors = [
  0x888888,
  0x9b8065,
  0x777f8a,
  0xb5a28c
];

for (let x = -100; x <= 100; x += 30) {
  for (let z = -100; z <= 100; z += 30) {
    if (Math.abs(x) < 15 || Math.abs(z) < 15) continue;

    makeBuilding(
      x,
      z,
      12,
      10 + Math.random() * 22,
      12,
      buildingColors[
        Math.floor(Math.random() * buildingColors.length)
      ]
    );
  }
}

// ==========================================
// POLICE VEHICLE
// ==========================================

const policeCar = new THREE.Group();

scene.add(policeCar);
policeCar.position.set(6, 0, 8);

// Temporary vehicle while Explorer loads.
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

let headlightsOn = false;
let emergencyLightsOn = false;
let emergencyPattern = 0;

// ==========================================
// HIDDEN LENS
// ==========================================

function makeHiddenLens(
  color,
  width,
  height,
  depth,
  x,
  y,
  z,
  parent
) {
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

// ==========================================
// CONVERT POSITION
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
    0xffffff,
    55,
    65,
    Math.PI / 5,
    0.45,
    1
  );

  beam.position.set(x, y, z);

  beam.target.position.set(
    x,
    y - 0.2,
    targetZ
  );

  beam.visible = false;
  beam.castShadow = false;

  policeCar.add(beam);
  policeCar.add(beam.target);

  return beam;
}

// ==========================================
// INVISIBLE EMERGENCY LIGHTS
// ==========================================

function installEmergencyLights(model, bounds) {
  emergencyModules = [];

  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

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
      color,
      0,
      16,
      Math.PI / 3,
      0.7,
      2
    );

    light.position.copy(position);
    light.target.position.copy(targetPosition);

    light.castShadow = false;

    model.add(light);
    model.add(light.target);

    emergencyModules.push({
      light,
      side
    });
  }

  const frontZ = bounds.min.z - 0.08;
  const rearZ = bounds.max.z + 0.08;
  const lightY = bounds.min.y + height * 0.62;

  // Front red and blue.
  addEmergencySpot(
    0xff1010,
    -width * 0.25,
    lightY,
    frontZ,
    frontZ - 12,
    'red'
  );

  addEmergencySpot(
    0x086bff,
    width * 0.25,
    lightY,
    frontZ,
    frontZ - 12,
    'blue'
  );

  // Rear blue and red.
  addEmergencySpot(
    0x086bff,
    -width * 0.25,
    lightY,
    rearZ,
    rearZ + 12,
    'blue'
  );

  addEmergencySpot(
    0xff1010,
    width * 0.25,
    lightY,
    rearZ,
    rearZ + 12,
    'red'
  );

  console.log('Four invisible emergency lights installed.');
}

// ==========================================
// INSTALL HEADLIGHTS
// ==========================================

function installVehicleLights(model) {
  headlights = [];

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

  // Front positions.
  const frontLeft = new THREE.Vector3(
    leftX,
    bounds.min.y + height * 0.62,
    bounds.min.z
  );

  const frontRight = new THREE.Vector3(
    rightX,
    bounds.min.y + height * 0.62,
    bounds.min.z
  );

  // Hidden headlight lenses.
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

    const beam = makeSpotlight(
      point.x,
      point.y,
      point.z - 0.12,
      point.z - 30
    );

    headlights.push(beam);
  }

  // Install invisible red and blue emergency lights.
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

    return;
  }

  const phase = Math.floor(time / 180) % 2;
  const fastPhase = Math.floor(time / 100) % 2;

  const doubleFlash =
    (time % 1000 < 120) ||
    (time % 1000 > 240 && time % 1000 < 360);

  emergencyModules.forEach(module => {
    let on = false;

    if (emergencyPattern === 0) {
      on = module.side === (
        phase === 0 ? 'red' : 'blue'
      );
    }

    if (emergencyPattern === 1) {
      on = module.side === (
        fastPhase === 0 ? 'red' : 'blue'
      );
    }

    if (emergencyPattern === 2) {
      on = doubleFlash &&
        module.side === (
          Math.floor(time / 500) % 2 === 0
            ? 'red'
            : 'blue'
        );
    }

    module.light.intensity = on ? 22 : 0;
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

    // Preserve working Explorer alignment.
    model.rotation.y = Math.PI;

    const originalBox = new THREE.Box3().setFromObject(model);

    const originalSize = originalBox.getSize(
      new THREE.Vector3()
    );

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
        Math.round(
          (progress.loaded / progress.total) * 100
        ) + '%'
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
        message.textContent =
          'Walk closer to your police SUV!';
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

  // CHANGE EMERGENCY PATTERN
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

    pitch = THREE.MathUtils.clamp(
      pitch,
      -1.4,
      1.4
    );
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
      camera.position.x,
      -140,
      140
    );

    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      -140,
      140
    );

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    hud.querySelector('#status').textContent = 'ON FOOT';

    const distance = Math.hypot(
      camera.position.x - policeCar.position.x,
      camera.position.z - policeCar.position.z
    );

    message.textContent =
      distance < 7
        ? 'Press E to enter your police SUV'
        : '';

  } else {
    // ACCELERATION
    if (keys.w) carSpeed += 0.012;
    if (keys.s) carSpeed -= 0.012;

    carSpeed *= 0.985;

    carSpeed = THREE.MathUtils.clamp(
      carSpeed,
      -0.3,
      0.7
    );

    // STEERING
    if (Math.abs(carSpeed) > 0.01) {
      if (keys.a) {
        policeCar.rotation.y +=
          0.025 * Math.sign(carSpeed);
      }

      if (keys.d) {
        policeCar.rotation.y -=
          0.025 * Math.sign(carSpeed);
      }
    }

    // MOVEMENT
    policeCar.position.x -=
      Math.sin(policeCar.rotation.y) * carSpeed;

    policeCar.position.z -=
      Math.cos(policeCar.rotation.y) * carSpeed;

    // FOLLOW CAMERA
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

  // EMERGENCY LIGHT ANIMATION
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
