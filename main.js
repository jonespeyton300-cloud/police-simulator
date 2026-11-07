
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
Shift + , - Left Signal<br>
Shift + . - Right Signal<br>
B - Cancel Signals<br>
<span id="status">ON FOOT</span><br>
<span id="lightStatus">DAYTIME RUNNING LIGHTS</span>
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

// Rounded LED lens made from a scaled sphere
function makeRoundedLight(color, width, height, depth, x, y, z, parent) {
  const material = new THREE.MeshBasicMaterial({
    color,
    toneMapped: false
  });

  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    material
  );

  lens.scale.set(width / 2, height / 2, depth / 2);
  lens.position.set(x, y, z);
  parent.add(lens);

  return lens;
}

// Convert model mesh bounds to vehicle-local coordinates
function getVehicleBounds(object) {
  const box = new THREE.Box3().setFromObject(object);

  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z)
  ];

  const localBox = new THREE.Box3();

  for (const corner of corners) {
    policeCar.worldToLocal(corner);
    localBox.expandByPoint(corner);
  }

  return localBox;
}

// Search the actual model for named headlight and taillight meshes
function findLightParts(model, words) {
  const matches = [];

  model.traverse((child) => {
    if (!child.isMesh) return;

    const name = child.name.toLowerCase();

    if (!words.some(word => name.includes(word))) return;

    child.updateWorldMatrix(true, false);

    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    policeCar.worldToLocal(center);

    matches.push({
      x: center.x,
      y: center.y,
      z: center.z,
      name: child.name
    });
  });

  return matches;
}

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
  beam.target.position.set(x, y - 0.5, targetZ);
  beam.visible = false;

  policeCar.add(beam);
  policeCar.add(beam.target);

  return beam;
}

// INSTALL LIGHTS USING THE MODEL'S REAL GEOMETRY
function installVehicleLights(model) {
  headlights = [];
  daytimeLights = [];
  leftSignals = [];
  rightSignals = [];
  brakeLights = [];

  policeCar.updateMatrixWorld(true);

  const box = getVehicleBounds(model);
  const min = box.min;
  const max = box.max;

  const width = max.x - min.x;
  const height = max.y - min.y;
  const length = max.z - min.z;

  // The Explorer faces negative Z
  const frontZ = min.z;
  const rearZ = max.z;

  // Look for actual named light parts in the 3D model
  const namedFront = findLightParts(model, [
    'headlight', 'head_light', 'frontlamp', 'front_lamp'
  ]);

  const namedRear = findLightParts(model, [
    'taillight', 'tail_light', 'rear_lamp', 'rearlight'
  ]);

  console.log('Explorer front light parts:', namedFront);
  console.log('Explorer rear light parts:', namedRear);

  // If the model has named lamp meshes, use their positions.
  // Otherwise, calculate positions from the vehicle dimensions.
  const frontCandidates = namedFront.length >= 2
    ? namedFront.sort((a, b) => a.x - b.x).slice(0, 2)
    : [
        {
          x: min.x + width * 0.20,
          y: min.y + height * 0.39,
          z: frontZ
        },
        {
          x: max.x - width * 0.20,
          y: min.y + height * 0.39,
          z: frontZ
        }
      ];

  const rearCandidates = namedRear.length >= 2
    ? namedRear.sort((a, b) => a.x - b.x).slice(0, 2)
    : [
        {
          x: min.x + width * 0.20,
          y: min.y + height * 0.40,
          z: rearZ
        },
        {
          x: max.x - width * 0.20,
          y: min.y + height * 0.40,
          z: rearZ
        }
      ];

  // Front lights: left and right
  const frontLeft = frontCandidates[0];
  const frontRight = frontCandidates[1];

  for (const point of [frontLeft, frontRight]) {
    const lens = makeRoundedLight(
      0xffffff,
      width * 0.105,
      height * 0.045,
      0.045,
      point.x,
      point.y,
      point.z - 0.035,
      policeCar
    );

    headlights.push(lens);

    const beam = makeSpotlight(
      point.x,
      point.y,
      point.z - 0.12,
      point.z - 30
    );

    headlights.push(beam);
  }

  // Slim white daytime running lights
  for (const point of [frontLeft, frontRight]) {
    const drl = makeRoundedLight(
      0xe8fbff,
      width * 0.15,
      height * 0.018,
      0.035,
      point.x,
      point.y - height * 0.045,
      point.z - 0.045,
      policeCar
    );

    daytimeLights.push(drl);
  }

  // Front and rear indicators are grouped by vehicle side.
  // Negative X is the vehicle's left side.
  function makeIndicator(point, front) {
    const signal = makeRoundedLight(
      0xffa000,
      width * 0.065,
      height * 0.035,
      0.045,
      point.x,
      point.y,
      front ? point.z - 0.065 : point.z + 0.065,
      policeCar
    );

    signal.visible = false;
    return signal;
  }

  // LEFT: front AND rear
  leftSignals.push(makeIndicator(frontLeft, true));
  leftSignals.push(makeIndicator(rearCandidates[0], false));

  // RIGHT: front AND rear
  rightSignals.push(makeIndicator(frontRight, true));
  rightSignals.push(makeIndicator(rearCandidates[1], false));

  // Rear brake lights, placed slightly inward from the indicators
  for (const point of rearCandidates) {
    const brake = makeRoundedLight(
      0x550000,
      width * 0.11,
      height * 0.06,
      0.045,
      point.x,
      point.y - height * 0.07,
      point.z + 0.07,
      policeCar
    );

    brake.userData.dimColor = 0x550000;
    brake.userData.brightColor = 0xff1010;
    brakeLights.push(brake);
  }

  updateVehicleLights();

  console.log('Modern Explorer lighting installed!');
}

// UPDATE HEADLIGHTS AND DAYTIME RUNNING LIGHTS
function updateVehicleLights() {
  headlights.forEach(light => {
    light.visible = headlightsOn;
  });

  daytimeLights.forEach(light => {
    light.visible = !headlightsOn;
  });

  const lightStatus = document.getElementById('lightStatus');

  if (lightStatus) {
    lightStatus.textContent = headlightsOn
      ? 'HEADLIGHTS ON'
      : 'DAYTIME RUNNING LIGHTS';
  }
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

  // BOTH FRONT AND REAR SIGNALS FLASH TOGETHER
  const signalFlash = Math.floor(performance.now() / 450) % 2 === 0;

  leftSignals.forEach(light => {
    light.visible = turnSignal === 'left' && signalFlash;
  });

  rightSignals.forEach(light => {
    light.visible = turnSignal === 'right' && signalFlash;
  });

  // BRAKE LIGHTS
  brakeLights.forEach(light => {
    light.material.color.set(
      keys.s ? light.userData.brightColor : light.userData.dimColor
    );
  });

  renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
