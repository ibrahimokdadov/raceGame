import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

const scoreDisplay = document.getElementById('score');
const speedometerDisplay = document.getElementById('speedometer');
const gameOverDisplay = document.getElementById('gameOver');
const restartButton = document.getElementById('restartButton');
const threejsContainer = document.getElementById('threejs-container');
const moneyDisplay = document.getElementById('money-display'); // Get reference to money display
let steeringWheel; // Declare globally, assign in init
let fineNotificationDiv; // overlay for fines
let fineMessageTimeout; // handle to clear previous timers
// FX globals
let audioCtx, screechOsc, screechGain, screechFilter;
let smokePool = [];
const SMOKE_POOL_SIZE = 40;
let smokeGroup; // attached to playerCar
let cameraShakeIntensity = 0; // 0..1
const MAX_CAMERA_SHAKE = 0.08;
let baseCameraPos = { x: 0, y: 5, z: 10 };
let smokeSpriteMaterial; // prepared in init before pool creation
let isBraking = false; // normal brake flag for tail lights
let lightsOn = true; // toggle headlights and running tail lights

let scene, camera, renderer;
let playerCar;
let road;
let obstacles = [];
let coins = []; // Array to hold coins
let laneMarkings = [];

let gameRunning = false;
let currentRoadSpeed = 0.1;
const BASE_ROAD_SPEED = 0.1;
let maxRoadSpeed = 0.5;
const ACCELERATION_RATE = 0.005;
const DECELERATION_RATE = 0.01;
const HANDBRAKE_DECEL_RATE = 0.035; // stronger than normal brake for quick but not instant stop
let isHandBraking = false;

const OBSTACLE_WIDTH = 1; // Width of obstacle
const OBSTACLE_HEIGHT = 1; // Height of obstacle
const OBSTACLE_DEPTH = 1; // Depth of obstacle
const OBSTACLE_SPAWN_INTERVAL = 2000; // milliseconds
const COIN_SIZE = 0.5; // Size of coin
const COIN_SPAWN_INTERVAL = 1000; // milliseconds
const LANE_POSITIONS = [-3, 0, 3]; // X positions for 3 lanes
let currentLane = 1; // 0 for left, 1 for middle, 2 for right

let distance = 0;
let currentMoney = 0;
const STEERING_ANGLE = 45;
let currentSteeringAngle = 0;

let lastObstacleSpawnTime = 0;
let lastCoinSpawnTime = 0;

let trafficLights = [];
// Prefer distance-based spawning so braking doesn't pile lights close by
const TRAFFIC_LIGHT_SPAWN_DISTANCE = 180; // spawn every 180 distance units
let lastTrafficLightSpawnDistance = 0;
const MAX_TRAFFIC_LIGHTS = 6;
const MIN_TRAFFIC_LIGHT_GAP_Z = 140; // ensure very wide spacing between lights

let lightPoles = [];



let trees = [];
let mountains = [];

function init() {
    steeringWheel = document.getElementById('steering-wheel');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x70c5ce); // Sky blue background
    scene.fog = new THREE.Fog(0x70c5ce, 50, 150); // Add fog

    // Skybox
    const skyboxGeometry = new THREE.BoxGeometry(500, 500, 500);
    const skyboxMaterial = new THREE.MeshStandardMaterial({ color: 0x70c5ce, side: THREE.BackSide });
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    scene.add(skybox);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    // Capture base camera pos for shake
    baseCameraPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadow maps
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    threejsContainer.appendChild(renderer.domElement);

    // Fine notification overlay
    fineNotificationDiv = document.createElement('div');
    fineNotificationDiv.style.position = 'fixed';
    fineNotificationDiv.style.top = '15%';
    fineNotificationDiv.style.left = '50%';
    fineNotificationDiv.style.transform = 'translate(-50%, -50%) scale(1)';
    fineNotificationDiv.style.padding = '12px 18px';
    fineNotificationDiv.style.borderRadius = '8px';
    fineNotificationDiv.style.background = 'rgba(0,0,0,0.6)';
    fineNotificationDiv.style.color = '#ff4444';
    fineNotificationDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
    fineNotificationDiv.style.fontSize = '56px';
    fineNotificationDiv.style.fontWeight = '800';
    fineNotificationDiv.style.letterSpacing = '1px';
    fineNotificationDiv.style.textShadow = '0 2px 6px rgba(0,0,0,0.8)';
    fineNotificationDiv.style.zIndex = '10000';
    fineNotificationDiv.style.opacity = '0';
    fineNotificationDiv.style.pointerEvents = 'none';
    fineNotificationDiv.style.transition = 'opacity 200ms ease, transform 200ms ease';
    document.body.appendChild(fineNotificationDiv);

    // Controls overlay
    createControlsOverlay();
    window.addEventListener('resize', positionControlsOverlay);

    // Prepare smoke sprite texture (small grey circle)
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 64; smokeCanvas.height = 64;
    const sctx = smokeCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 10, 32, 32, 30);
    grad.addColorStop(0, 'rgba(200,200,200,0.8)');
    grad.addColorStop(1, 'rgba(200,200,200,0.0)');
    sctx.fillStyle = grad;
    sctx.beginPath(); sctx.arc(32, 32, 30, 0, Math.PI * 2); sctx.fill();
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
    smokeSpriteMaterial = new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, depthWrite: false });

    const hemisphereLight = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.5); // Sky color, ground color, intensity
    scene.add(hemisphereLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 20, 10);
    directionalLight.castShadow = true; // Enable shadow casting for this light
    directionalLight.shadow.mapSize.width = 2048; // default is 512
    directionalLight.shadow.mapSize.height = 2048; // default is 512
    directionalLight.shadow.camera.near = 0.5; // default
    directionalLight.shadow.camera.far = 50; // default
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    const roadGeometry = new THREE.PlaneGeometry(10, 100);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
    road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.position.z = -40;
    road.receiveShadow = true; // Road receives shadows
    scene.add(road);

    createLaneMarkings();

    playerCar = createPlayerCarMesh();
    playerCar.position.set(0, 0.25, 5);
    scene.add(playerCar);

    // Initialize smoke group and pool after playerCar exists
    smokeGroup = new THREE.Group();
    playerCar.add(smokeGroup);
    for (let i = 0; i < SMOKE_POOL_SIZE; i++) {
        const sprite = new THREE.Sprite((smokeSpriteMaterial || new THREE.SpriteMaterial({ color: 0xffffff, transparent: true })).clone());
        sprite.visible = false;
        sprite.scale.set(0.1, 0.1, 0.1);
        sprite.material.opacity = 0;
        smokeGroup.add(sprite);
        smokePool.push({ sprite, life: 0, maxLife: 1 });
    }

    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    restartButton.addEventListener('click', restartGame);

    // Add light poles
    for (let i = 0; i < 10; i++) {
        createLightPole(-7, -40 + (i * 20));
        createLightPole(7, -40 + (i * 20));
    }

    

    // Add trees
    for (let i = 0; i < 10; i++) {
        createTree(-25, -40 + (i * 20)); // Left side, further out
        createTree(25, -40 + (i * 20));  // Right side, further out
    }

    // Add mountains
    for (let i = 0; i < 5; i++) { // Fewer mountains, they are larger
        createMountain(-50, -80 + (i * 40)); // Left side, even further out
        createMountain(50, -80 + (i * 40));  // Right side, even further out
    }

    // Do not auto-start; show Start overlay instead
    createStartOverlay();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (!gameRunning) return;

    switch (event.key) {
        case 'ArrowUp':
            currentRoadSpeed = Math.min(maxRoadSpeed, currentRoadSpeed + ACCELERATION_RATE);
            break;
        case 'ArrowDown':
            currentRoadSpeed = Math.max(0, currentRoadSpeed - DECELERATION_RATE);
            isBraking = true;
            updateBrakeLights();
            break;
        case ' ': // Spacebar for handbrake
            isHandBraking = true;
            startScreech();
            updateBrakeLights();
            break;
        case 'l':
        case 'L':
            lightsOn = !lightsOn;
            updateBrakeLights();
            break;
        case 'ArrowLeft':
            if (currentLane > 0) {
                currentLane--;
                playerCar.position.x = LANE_POSITIONS[currentLane];
            }
            currentSteeringAngle = -STEERING_ANGLE;
            break;
        case 'ArrowRight':
            if (currentLane < LANE_POSITIONS.length - 1) {
                currentLane++;
                playerCar.position.x = LANE_POSITIONS[currentLane];
            }
            currentSteeringAngle = STEERING_ANGLE;
            break;
    }
    updateSteeringWheel();
}

function onKeyUp(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        currentSteeringAngle = 0;
    }
    if (event.key === ' ') {
        isHandBraking = false;
        stopScreech();
    }
    if (event.key === 'ArrowDown') {
        isBraking = false;
    }
    updateSteeringWheel();
    updateBrakeLights();
}

function updateSteeringWheel() {
    if (steeringWheel) {
        steeringWheel.style.transform = `rotate(${currentSteeringAngle}deg)`;
    }
}

function updateBrakeLights() {
    if (!playerCar || !playerCar.userData) return;
    const tailMats = playerCar.userData.taillightMats || [];
    const headMats = playerCar.userData.headlightMats || [];
    const frontPts = playerCar.userData.frontPointLights || [];
    const rearPts = playerCar.userData.rearBrakeLights || [];
    const braking = isBraking || isHandBraking;
    // Tail brighter when braking, base glow depends on lightsOn
    tailMats.forEach(m => {
        if (!m) return;
        const base = lightsOn ? 0.7 : 0.0;
        m.emissiveIntensity = braking ? 3.0 : base;
    });
    // Headlights depend on lightsOn
    headMats.forEach(m => { if (m) m.emissiveIntensity = lightsOn ? 1.6 : 0.0; });
    // Real point lights: headlights steady if on, rear lights brighten on brake
    frontPts.forEach(l => { if (l) l.intensity = lightsOn ? 0.9 : 0.0; });
    rearPts.forEach(l => { if (l) l.intensity = braking ? 1.8 : (lightsOn ? 0.15 : 0.0); });
}

// Small controls overlay at top-left
function createControlsOverlay() {
    const div = document.createElement('div');
    div.id = 'controls-overlay';
    div.style.position = 'fixed';
    // position computed relative to speedometer
    div.style.padding = '8px 10px';
    div.style.borderRadius = '6px';
    div.style.background = 'rgba(0,0,0,0.45)';
    div.style.color = '#eaeaea';
    div.style.fontFamily = 'Arial, Helvetica, sans-serif';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.35';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '10001';
    div.innerHTML = [
        '<b>Controls</b>',
        'Arrow Left/Right: Steer',
        'Arrow Up: Accelerate',
        'Arrow Down: Brake',
        'Space: Handbrake',
        'L: Toggle Lights'
    ].join('<br/>');
    document.body.appendChild(div);
    positionControlsOverlay();
}

function positionControlsOverlay() {
    const overlay = document.getElementById('controls-overlay');
    const speedEl = speedometerDisplay || document.getElementById('speedometer');
    if (!overlay || !speedEl) return;
    const rect = speedEl.getBoundingClientRect();
    const margin = 6;
    overlay.style.top = `${rect.bottom + margin}px`;
    overlay.style.left = `${rect.left}px`;
}

function createLaneMarkings() {
    const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const markingGeometry = new THREE.BoxGeometry(0.1, 0.02, 4);

    for (let i = 0; i < 20; i++) {
        const marking1 = new THREE.Mesh(markingGeometry, markingMaterial);
        marking1.position.set(-1.5, 0.01, -45 + i * 5);
        scene.add(marking1);
        laneMarkings.push(marking1);

        const marking2 = new THREE.Mesh(markingGeometry, markingMaterial);
        marking2.position.set(1.5, 0.01, -45 + i * 5);
        scene.add(marking2);
        laneMarkings.push(marking2);
    }
}

function createObstacle() {
    const obstacle = createRandomCarShape(); // Use the new function

    // Pick a lane and ensure spacing from last obstacle in that lane
    let laneIndex = Math.floor(Math.random() * LANE_POSITIONS.length);
    const baseSpawnZ = -50;
    const MIN_LANE_GAP_Z = 18; // avoid side-by-side blocks in same lane

    // Try up to 3 times to find a lane with space; otherwise push farther back
    let spawnZ = baseSpawnZ;
    for (let attempt = 0; attempt < 3; attempt++) {
        const nearestAhead = obstacles
            .filter(o => Math.abs(o.position.x - LANE_POSITIONS[laneIndex]) < 0.1)
            .reduce((acc, o) => Math.min(acc, o.position.z), Infinity);
        if (nearestAhead === Infinity || (nearestAhead - spawnZ) >= MIN_LANE_GAP_Z) {
            break;
        } else {
            // try another lane
            const otherLanes = [0,1,2].filter(i => i !== laneIndex);
            laneIndex = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        }
    }
    // Final spacing push if still crowded
    const sameLaneObstacles = obstacles.filter(o => Math.abs(o.position.x - LANE_POSITIONS[laneIndex]) < 0.1);
    if (sameLaneObstacles.length) {
        const nearestZ = sameLaneObstacles.reduce((acc, o) => Math.min(acc, o.position.z), Infinity);
        if (isFinite(nearestZ) && (nearestZ - spawnZ) < MIN_LANE_GAP_Z) {
            spawnZ = nearestZ - MIN_LANE_GAP_Z;
        }
    }

    obstacle.position.set(LANE_POSITIONS[laneIndex], 0, spawnZ);

    // Assign a small relative speed so some cars move faster/slower
    const relSpeed = (Math.random() * 0.05) - 0.015; // [-0.015, 0.035]
    obstacle.userData = {
        laneIndex,
        relSpeed
    };

    scene.add(obstacle);
    obstacles.push(obstacle);
}

function createCoin() {
    const coinGeometry = new THREE.CylinderGeometry(COIN_SIZE / 2, COIN_SIZE / 2, 0.1, 16); // radiusTop, radiusBottom, height, radialSegments
    const coinMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 }); // Gold color
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);

    const laneIndex = Math.floor(Math.random() * LANE_POSITIONS.length);
    coin.position.set(LANE_POSITIONS[laneIndex], COIN_SIZE / 2, -50); // Start far back, slightly above road
    coin.rotation.x = Math.PI / 2; // Rotate to be upright
    scene.add(coin);
    coins.push(coin);
}

function createLightPole(x, z) {
    const poleGroup = new THREE.Group();

    // Rectangular pole (avoid round shapes)
    const poleGeometry = new THREE.BoxGeometry(0.2, 5, 0.2);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, metalness: 0.3, roughness: 0.8 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 2.5, z);
    pole.castShadow = false;
    pole.receiveShadow = false;
    poleGroup.add(pole);

    // Rectangular lamp head with cool-white panel (not yellow to avoid coin color clash)
    const headGroup = new THREE.Group();
    headGroup.position.set(x, 5, z);

    // Housing
    const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x232323, metalness: 0.2, roughness: 0.7 })
    );
    housing.castShadow = false;
    housing.receiveShadow = false;
    headGroup.add(housing);

    // Light panel (cool white/blue-ish)
    const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.25, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x88c6ff, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0 })
    );
    panel.position.set(0, 0, 0.23);
    panel.castShadow = false;
    panel.receiveShadow = false;
    headGroup.add(panel);

    // Small top visor/hood
    const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.05, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.2, roughness: 0.6 })
    );
    visor.position.set(0, 0.25, 0);
    visor.castShadow = false;
    visor.receiveShadow = false;
    headGroup.add(visor);

    poleGroup.add(headGroup);

    // Subtle cool-white light
    const pointLight = new THREE.PointLight(0xcfe8ff, 0.4, 35);
    pointLight.position.set(x, 5, z + 0.2);
    pointLight.castShadow = false;
    poleGroup.add(pointLight);

    scene.add(poleGroup);
    lightPoles.push(poleGroup);
}



function createTree(x, z) {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.BoxGeometry(0.5, 3, 0.5);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, 1.5, z); // Half height
    treeGroup.add(trunk);

    // Foliage
    const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8); // Radius, height, segments
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.set(x, 4.5, z); // Above trunk
    treeGroup.add(foliage);

    scene.add(treeGroup);
    trees.push(treeGroup);
}

function createMountain(x, z) {
    const mountainGroup = new THREE.Group();

    // Mountain shape (simple cone)
    const mountainGeometry = new THREE.ConeGeometry(10, 30, 8); // Radius, height, segments
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    mountain.position.set(x, 15, z); // Half height
    mountainGroup.add(mountain);

    scene.add(mountainGroup);
    mountains.push(mountainGroup);
}

function createTrafficLight(x, z, fixedIsRed) {
    const trafficLightGroup = new THREE.Group();
    // Position the whole group at the target Z so child meshes can use local coords
    trafficLightGroup.position.set(0, 0, z);

    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 7, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 3.5, 0);
    pole.frustumCulled = false;
    trafficLightGroup.add(pole);

    // Overhead arm from pole to center of road
    const armLength = Math.abs(x) + 0.2; // reach to x=0
    const armGeometry = new THREE.BoxGeometry(armLength, 0.15, 0.15);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set((x > 0 ? x - armLength / 2 : x + armLength / 2), 6.5, 0);
    arm.frustumCulled = false;
    trafficLightGroup.add(arm);

    // Over-road housing centered at x=0 for visibility
    const housingGeometry = new THREE.BoxGeometry(1.2, 2.2, 0.6);
    const housingMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.position.set(0, 6.5, 0);
    housing.frustumCulled = false;
    trafficLightGroup.add(housing);

    // Red light
    const redLightGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const redLightMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x220000, emissiveIntensity: 1.0 });
    const redLight = new THREE.Mesh(redLightGeometry, redLightMaterial);
    redLight.position.set(0, 7.2, 0.05); // Over the lane, slightly in front
    redLight.frustumCulled = false;
    trafficLightGroup.add(redLight);
    trafficLightGroup.redLight = redLight; // Store reference

    // Green light
    const greenLightGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const greenLightMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x003300, emissiveIntensity: 1.0 });
    const greenLight = new THREE.Mesh(greenLightGeometry, greenLightMaterial);
    greenLight.position.set(0, 6.2, 0.05); // Over the lane, slightly in front
    greenLight.frustumCulled = false;
    trafficLightGroup.add(greenLight);
    trafficLightGroup.greenLight = greenLight; // Store reference
    // Note: Removed point light glows to avoid spawn-time stutter.

    // Duplicate indicator lights on the pole so they're visible when close underneath
    const redPoleLightGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const redPoleLightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x220000, emissiveIntensity: 1.0 });
    const redPoleLight = new THREE.Mesh(redPoleLightGeo, redPoleLightMat);
    redPoleLight.position.set(x, 3.2, 0.12); // lower on pole, slightly forward for close-up visibility
    redPoleLight.frustumCulled = false;
    trafficLightGroup.add(redPoleLight);
    trafficLightGroup.redLightPole = redPoleLight;

    const greenPoleLightGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const greenPoleLightMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x003300, emissiveIntensity: 1.0 });
    const greenPoleLight = new THREE.Mesh(greenPoleLightGeo, greenPoleLightMat);
    greenPoleLight.position.set(x, 2.4, 0.12); // lower on pole, slightly forward for close-up visibility
    greenPoleLight.frustumCulled = false;
    trafficLightGroup.add(greenPoleLight);
    trafficLightGroup.greenLightPole = greenPoleLight;

    // Stop line on the road for clarity
    const stopLineGeometry = new THREE.PlaneGeometry(10, 0.35);
    const stopLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const stopLine = new THREE.Mesh(stopLineGeometry, stopLineMaterial);
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.position.set(0, 0.01, -0.2);
    stopLine.receiveShadow = false;
    stopLine.castShadow = false;
    stopLine.frustumCulled = false;
    trafficLightGroup.add(stopLine);
    trafficLightGroup.stopLine = stopLine;
    // Track world-space Z of the stop line for accurate crossing detection
    trafficLightGroup.stopLinePrevWorldZ = trafficLightGroup.position.z - 0.2;

    // Initial state (use provided state if given, else random)
    trafficLightGroup.isRed = (typeof fixedIsRed === 'boolean') ? fixedIsRed : (Math.random() < 0.5);
    trafficLightGroup.violationChecked = false; // Initialize violation flag
    trafficLightGroup.prevZ = trafficLightGroup.position.z; // track for crossing detection
    updateTrafficLightColor(trafficLightGroup);

    // Cycling config
    trafficLightGroup.cycleDuration = 6000; // ms for auto cycle
    trafficLightGroup.lastSwitchTime = performance.now();
    trafficLightGroup.waitingForGreen = false;
    trafficLightGroup.waitingStart = 0;

    trafficLightGroup.scale.set(1.5, 1.5, 1.5); // Increase scale
    trafficLightGroup.frustumCulled = false;
    scene.add(trafficLightGroup);
    trafficLights.push(trafficLightGroup);
}

function updateTrafficLightColor(lightGroup) {
    if (lightGroup.isRed) {
        lightGroup.redLight.material.color.set(0xff0000); // Red
        lightGroup.greenLight.material.color.set(0x003300); // Dim green
        if (lightGroup.redLightPole) lightGroup.redLightPole.material.color.set(0xff0000);
        if (lightGroup.greenLightPole) lightGroup.greenLightPole.material.color.set(0x003300);
    } else {
        lightGroup.redLight.material.color.set(0x330000); // Dim red
        lightGroup.greenLight.material.color.set(0x00ff00); // Green
        if (lightGroup.redLightPole) lightGroup.redLightPole.material.color.set(0x330000);
        if (lightGroup.greenLightPole) lightGroup.greenLightPole.material.color.set(0x00ff00);
    }
}

function createPlayerCarMesh() {
    const carGroup = new THREE.Group();

    // Car body
    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.5, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff }); // Blue
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.25, 0); // Centered
    carGroup.add(body);

    // Car cabin/roof
    const cabinGeometry = new THREE.BoxGeometry(1.2, 0.6, 1.5);
    const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x000080 }); // Darker blue
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, 0.7, -0.2); // On top of body, slightly back
    carGroup.add(cabin);

    // Windows (semi-transparent glass)
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x66aaff, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.0 });
    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.03), glassMat.clone());
    windshield.position.set(0, 0.85, 0.5);
    carGroup.add(windshield);
    // Rear window
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.03), glassMat.clone());
    rearWindow.position.set(0, 0.9, -0.9);
    carGroup.add(rearWindow);
    // Side windows
    const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.9), glassMat.clone());
    sideWinL.position.set(-0.61, 0.85, -0.2);
    carGroup.add(sideWinL);
    const sideWinR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.9), glassMat.clone());
    sideWinR.position.set(0.61, 0.85, -0.2);
    carGroup.add(sideWinR);

    // Wheels (4 cylinders)
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Dark gray

    const wheelPositions = [
        { x: -0.8, y: 0.1, z: 1.0 },  // Front left
        { x: 0.8, y: 0.1, z: 1.0 },   // Front right
        { x: -0.8, y: 0.1, z: -1.0 }, // Rear left
        { x: 0.8, y: 0.1, z: -1.0 }    // Rear right
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.rotation.z = Math.PI / 2; // Rotate to be horizontal
        carGroup.add(wheel);
    });

    // Lights
    const headlightMats = [];
    const taillightMats = [];
    const frontPointLights = [];
    const rearBrakeLights = [];
    // Headlights (rectangular, emissive cool white)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8f7ff, emissive: 0xaad9ff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0 });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.06), headMat);
    headL.position.set(-0.45, 0.35, -1.45);
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.06), headMat.clone());
    headR.position.set(0.45, 0.35, -1.45);
    carGroup.add(headL); carGroup.add(headR);
    headlightMats.push(headMat, headR.material);
    // Taillights (rectangular, emissive red)
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x662222, emissive: 0xff2222, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.06), tailMat);
    tailL.position.set(-0.5, 0.32, 1.5);
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.06), tailMat.clone());
    tailR.position.set(0.5, 0.32, 1.5);
    carGroup.add(tailL); carGroup.add(tailR);
    taillightMats.push(tailMat, tailR.material);

    // Keep taillights compact (no long extrusions)

    // Real light sources
    // Headlight point lights (cool white), slight forward offset
    const hL = new THREE.PointLight(0xcfe8ff, 0.9, 12);
    hL.position.set(-0.45, 0.35, -1.55);
    hL.castShadow = false;
    carGroup.add(hL);
    const hR = new THREE.PointLight(0xcfe8ff, 0.9, 12);
    hR.position.set(0.45, 0.35, -1.55);
    hR.castShadow = false;
    carGroup.add(hR);
    frontPointLights.push(hL, hR);

    // Rear brake lights (red), intensity driven by braking flags
    const rL = new THREE.PointLight(0xff3333, 0.05, 5, 2);
    rL.position.set(-0.5, 0.36, 1.58); // slightly behind the car, compact glow
    rL.castShadow = false;
    carGroup.add(rL);
    const rR = new THREE.PointLight(0xff3333, 0.05, 5, 2);
    rR.position.set(0.5, 0.36, 1.58);
    rR.castShadow = false;
    carGroup.add(rR);
    rearBrakeLights.push(rL, rR);

    carGroup.userData.headlightMats = headlightMats;
    carGroup.userData.taillightMats = taillightMats;
    carGroup.userData.frontPointLights = frontPointLights;
    carGroup.userData.rearBrakeLights = rearBrakeLights;
    // Initialize brake lights state
    updateBrakeLights();

    return carGroup;
}

function createRandomCarShape() {
    const carType = Math.floor(Math.random() * 5); // 0: SUV, 1: Mini, 2: Sports, 3: Truck, 4: Bus
    const carGroup = new THREE.Group();
    const bodyColor = new THREE.Color(Math.random() * 0xffffff); // Random color for each car

    // Common wheel properties
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

    switch (carType) {
        case 0: // SUV
            // Body
            const suvBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 3.5), new THREE.MeshStandardMaterial({ color: bodyColor }));
            suvBody.position.set(0, 0.4, 0);
            carGroup.add(suvBody);
            // Wheels
            [-0.9, 0.9].forEach(x => {
                [1.2, -1.2].forEach(z => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(x, 0.2, z);
                    wheel.rotation.z = Math.PI / 2;
                    carGroup.add(wheel);
                });
            });
            break;
        case 1: // Mini Car
            // Body
            const miniBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 2.0), new THREE.MeshStandardMaterial({ color: bodyColor }));
            miniBody.position.set(0, 0.3, 0);
            carGroup.add(miniBody);
            // Cabin
            const miniCabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor.r * 0.8, bodyColor.g * 0.8, bodyColor.b * 0.8) }));
            miniCabin.position.set(0, 0.7, -0.2);
            carGroup.add(miniCabin);
            // Wheels
            [-0.6, 0.6].forEach(x => {
                [0.7, -0.7].forEach(z => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(x, 0.15, z);
                    wheel.rotation.z = Math.PI / 2;
                    carGroup.add(wheel);
                });
            });
            break;
        case 2: // Sports Car
            // Body (low and sleek)
            const sportsBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 3.0), new THREE.MeshStandardMaterial({ color: bodyColor }));
            sportsBody.position.set(0, 0.2, 0);
            carGroup.add(sportsBody);
            // Cabin (very low)
            const sportsCabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.0), new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor.r * 0.8, bodyColor.g * 0.8, bodyColor.b * 0.8) }));
            sportsCabin.position.set(0, 0.45, -0.5);
            carGroup.add(sportsCabin);
            // Wheels
            [-0.7, 0.7].forEach(x => {
                [1.0, -1.0].forEach(z => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(x, 0.1, z);
                    wheel.rotation.z = Math.PI / 2;
                    carGroup.add(wheel);
                });
            });
            break;
        case 3: // Truck
            // Cabin
            const truckCabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.5), new THREE.MeshStandardMaterial({ color: bodyColor }));
            truckCabin.position.set(0, 0.5, 1.0);
            carGroup.add(truckCabin);
            // Bed
            const truckBed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 2.5), new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor.r * 0.8, bodyColor.g * 0.8, bodyColor.b * 0.8) }));
            truckBed.position.set(0, 0.25, -0.75);
            carGroup.add(truckBed);
            // Wheels
            [-0.8, 0.8].forEach(x => {
                [1.5, -0.5, -1.5].forEach(z => { // 6 wheels for a truck
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(x, 0.2, z);
                    wheel.rotation.z = Math.PI / 2;
                    carGroup.add(wheel);
                });
            });
            break;
        case 4: // Bus
            // Body
            const busBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 5.0), new THREE.MeshStandardMaterial({ color: bodyColor }));
            busBody.position.set(0, 0.75, 0);
            carGroup.add(busBody);
            // Wheels
            [-0.9, 0.9].forEach(x => {
                [2.0, 0.0, -2.0].forEach(z => { // 6 wheels for a bus
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(x, 0.2, z);
                    wheel.rotation.z = Math.PI / 2;
                    carGroup.add(wheel);
                });
            });
            break;
    }

    return carGroup;
}

function gameOver() {
    gameRunning = false;
    gameOverDisplay.style.display = 'block';
}

function restartGame() {
    gameOverDisplay.style.display = 'none';
    distance = 0;
    currentMoney = 0;
    scoreDisplay.textContent = `Distance: ${distance}`;
    moneyDisplay.textContent = currentMoney;

    // Clear existing obstacles
    obstacles.forEach(obstacle => scene.remove(obstacle));
    obstacles = [];

    // Clear existing coins
    coins.forEach(coin => scene.remove(coin));
    coins = [];

    // Clear existing light poles
    lightPoles.forEach(poleGroup => scene.remove(poleGroup));
    lightPoles = [];

    

    // Clear existing trees
    trees.forEach(treeGroup => scene.remove(treeGroup));
    trees = [];

    // Clear existing mountains
    mountains.forEach(mountainGroup => scene.remove(mountainGroup));
    mountains = [];

    // Clear existing traffic lights
    trafficLights.forEach(light => scene.remove(light));
    trafficLights = [];
    lastTrafficLightSpawnDistance = 0;

    // Reset lane markings
    laneMarkings.forEach(marking => scene.remove(marking));
    laneMarkings = [];
    createLaneMarkings();

    // Re-add light poles
    for (let i = 0; i < 10; i++) {
        createLightPole(-7, -40 + (i * 20));
        createLightPole(7, -40 + (i * 20));
    }

    

    // Re-add trees
    for (let i = 0; i < 10; i++) {
        createTree(-25, -40 + (i * 20)); // Left side, further out
        createTree(25, -40 + (i * 20));  // Right side, further out
    }

    // Re-add mountains
    for (let i = 0; i < 5; i++) { // Fewer mountains, they are larger
        createMountain(-50, -80 + (i * 40)); // Left side, even further out
        createMountain(50, -80 + (i * 40));  // Right side, even further out
    }

    currentLane = 1;
    playerCar.position.set(LANE_POSITIONS[currentLane], 0.25, 5);
    road.position.z = -40;
    currentRoadSpeed = BASE_ROAD_SPEED;
    maxRoadSpeed = 0.5;
    currentSteeringAngle = 0;
    updateSteeringWheel();
    gameRunning = true;
    lastObstacleSpawnTime = performance.now();
    lastCoinSpawnTime = performance.now();
}

// Start overlay/button to initiate the game
function createStartOverlay() {
    // Inject styles once
    if (!document.getElementById('start-overlay-styles')) {
        const style = document.createElement('style');
        style.id = 'start-overlay-styles';
        style.textContent = `
        @keyframes gradientMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{transform:translateY(0); box-shadow:0 6px 20px rgba(30,136,229,0.35)} 50%{transform:translateY(-1px); box-shadow:0 10px 28px rgba(30,136,229,0.55)} }
        @keyframes linesScroll { 0%{background-position:0 0} 100%{background-position:0 200px} }
        @keyframes revBeat { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(1.2)} }
        `;
        document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '10002';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.pointerEvents = 'auto';
    overlay.style.background = 'linear-gradient(120deg, rgba(8,24,68,0.92), rgba(2,62,138,0.92), rgba(33,158,188,0.9))';
    overlay.style.backgroundSize = '200% 200%';
    overlay.style.animation = 'gradientMove 10s ease infinite';

    // Subtle moving speed lines background layer
    const lines = document.createElement('div');
    lines.style.position = 'absolute';
    lines.style.inset = '0';
    lines.style.backgroundImage = 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 3px, transparent 40px)';
    lines.style.maskImage = 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.7), transparent)';
    lines.style.animation = 'linesScroll 1.2s linear infinite';
    overlay.appendChild(lines);

    const card = document.createElement('div');
    card.style.position = 'relative';
    card.style.padding = '22px 24px';
    card.style.borderRadius = '12px';
    card.style.background = 'rgba(0,0,0,0.35)';
    card.style.backdropFilter = 'blur(2px)';
    card.style.border = '1px solid rgba(255,255,255,0.12)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.boxShadow = '0 10px 40px rgba(0,0,0,0.4)';

    const title = document.createElement('div');
    title.textContent = 'L Driver';
    title.style.fontFamily = 'Arial, Helvetica, sans-serif';
    title.style.fontWeight = '800';
    title.style.letterSpacing = '0.5px';
    title.style.fontSize = '20px';
    title.style.color = '#E3F2FD';
    title.style.textShadow = '0 2px 10px rgba(0,0,0,0.6)';
    card.appendChild(title);


    // Revving indicator (hidden initially)
    const rev = document.createElement('div');
    rev.style.display = 'none';
    rev.style.height = '22px';
    rev.style.display = 'flex';
    rev.style.gap = '6px';
    ['#66bb6a','#ffee58','#ef5350'].forEach((col, i) => {
        const bar = document.createElement('div');
        bar.style.width = '10px';
        bar.style.height = '100%';
        bar.style.background = col;
        bar.style.borderRadius = '3px';
        bar.style.transformOrigin = 'bottom center';
        bar.style.animation = `revBeat ${600 + i*120}ms ease-in-out ${i*80}ms infinite`;
        rev.appendChild(bar);
    });
    card.appendChild(rev);

    const loading = document.createElement('div');
    loading.style.fontFamily = 'Arial, Helvetica, sans-serif';
    loading.style.fontSize = '13px';
    loading.style.color = '#E0E0E0';
    loading.style.opacity = '0.95';
    const baseText = 'Engines warmed and ready';
    loading.textContent = baseText + '...';
    card.appendChild(loading);

    const btn = document.createElement('button');
    btn.textContent = 'Start Driving';
    btn.style.padding = '10px 18px';
    btn.style.fontSize = '16px';
    btn.style.fontFamily = 'Arial, Helvetica, sans-serif';
    btn.style.fontWeight = '700';
    btn.style.color = '#ffffff';
    btn.style.background = '#1e88e5';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.animation = 'pulse 1.8s ease-in-out infinite';
    card.appendChild(btn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animated dots for loading text
    let dotCount = 0;
    const dotTimer = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        loading.textContent = baseText + '.'.repeat(dotCount);
    }, 450);
    overlay._dotTimer = dotTimer;

    const start = () => {
        // Transition UI: show rev indicator, change text
        try { if (overlay._dotTimer) clearInterval(overlay._dotTimer); } catch {}
        rev.style.display = 'flex';
        loading.textContent = 'Car started';
        btn.textContent = 'Let\'s Go!';
        btn.disabled = true;
        // Small delay to show rev, then start
        setTimeout(() => {
            document.removeEventListener('keydown', onKeyStart);
            overlay.remove();
            restartGame();
        }, 650);
    };

    btn.addEventListener('click', start);
    function onKeyStart(e){ if (e.key === 'Enter') start(); }
    document.addEventListener('keydown', onKeyStart);
}

function animate() {
    requestAnimationFrame(animate);

    if (!gameRunning) return;

    const currentTime = performance.now(); // Moved declaration

    // Road scrolling
    road.position.z += currentRoadSpeed;
    if (road.position.z > 10) {
        road.position.z = -40;
    }

    // Move lane markings
    laneMarkings.forEach(marking => {
        marking.position.z += currentRoadSpeed;
        if (marking.position.z > 10) {
            marking.position.z -= 100; // Move back to the start
        }
    });

    // Move light poles
    lightPoles.forEach(poleGroup => {
        poleGroup.position.z += currentRoadSpeed;
        if (poleGroup.position.z > 10) {
            poleGroup.position.z -= 100; // Move back to the start
        }
    });

    

    // Move trees
    trees.forEach(treeGroup => {
        treeGroup.position.z += currentRoadSpeed;
        if (treeGroup.position.z > 10) {
            treeGroup.position.z -= 100; // Move back to the start
        }
    });

    // Move mountains
    mountains.forEach(mountainGroup => {
        mountainGroup.position.z += currentRoadSpeed;
        if (mountainGroup.position.z > 10) {
            mountainGroup.position.z -= 100; // Move back to the start
        }
    });

    // Spawn traffic lights based on distance rather than time to avoid close spawns when braking
    // Also ensure only one light is on screen at a time
    if ((distance - lastTrafficLightSpawnDistance) > TRAFFIC_LIGHT_SPAWN_DISTANCE) {
        // Only consider lights within the near field as "visible" to prevent multiple on screen
        const visibleLights = trafficLights.filter(l => l.position.z > -100);
        if (visibleLights.length === 0 && trafficLights.length < MAX_TRAFFIC_LIGHTS) {
            let spawnZ = -200; // spawn even farther so they appear from a distance
            // Enforce minimum Z gap from the farthest-back existing light
            if (trafficLights.length > 0) {
                const farthestBackZ = Math.min(...trafficLights.map(l => l.position.z));
                if (isFinite(farthestBackZ) && (farthestBackZ - spawnZ) < MIN_TRAFFIC_LIGHT_GAP_Z) {
                    spawnZ = farthestBackZ - MIN_TRAFFIC_LIGHT_GAP_Z;
                }
            }
            createTrafficLight(-5, spawnZ); // Single light (pole on left, housing centered)
            lastTrafficLightSpawnDistance = distance;
        }
    }

    // Update and check traffic lights
    for (let i = 0; i < trafficLights.length; i++) {
        const light = trafficLights[i];
        const prevZ = light.prevZ !== undefined ? light.prevZ : light.position.z;
        light.position.z += currentRoadSpeed;

        // Compute stop line world Z (group Z minus 0.2 because stopLine local Z is -0.2)
        const stopLineWorldZ = light.position.z - 0.2;
        const prevStopLineWorldZ = (typeof light.stopLinePrevWorldZ === 'number') ? light.stopLinePrevWorldZ : (prevZ - 0.2);

        const carZ = playerCar.position.z;
        const crossedStopLine = prevStopLineWorldZ < carZ && stopLineWorldZ >= carZ;

        // Apply violation strictly on geometric crossing, regardless of speed, so braking still shows fine message
        if (!light.violationChecked && crossedStopLine) {
            if (light.isRed) {
                currentMoney -= 20;
                console.log("Red light violation! -20 money. Current money: " + currentMoney);
                showFineMessage('Red light Fine -$20');
            }
            // Mark checked regardless of color to avoid any later false fines
            light.violationChecked = true;
        }

        // Simple auto-cycle to avoid being stuck forever
        if (currentTime - (light.lastSwitchTime || 0) > (light.cycleDuration || 6000)) {
            light.isRed = !light.isRed;
            light.lastSwitchTime = currentTime;
            updateTrafficLightColor(light);
        }

        // If player is stopped at the red light, turn green shortly to let them resume
        const distAhead = stopLineWorldZ - carZ; // positive if stop line is ahead
        const nearAndWaiting = light.isRed && distAhead > 0 && distAhead < 2.0 && currentRoadSpeed < 0.02;
        if (nearAndWaiting) {
            if (!light.waitingForGreen) {
                light.waitingForGreen = true;
                light.waitingStart = currentTime;
            } else if (currentTime - (light.waitingStart || 0) > 1200) {
                light.isRed = false;
                light.lastSwitchTime = currentTime;
                updateTrafficLightColor(light);
                light.waitingForGreen = false;
            }
        } else {
            light.waitingForGreen = false;
        }

        // update previous positions for next frame
        light.prevZ = light.position.z;
        light.stopLinePrevWorldZ = stopLineWorldZ;

        // Remove lights shortly after the car passes them to keep only one on screen
        const removeThreshold = playerCar.position.z + 20;
        if (light.position.z > removeThreshold) {
            scene.remove(light);
            trafficLights.splice(i, 1);
            i--;
        }
    }

    // Update distance and speedometer
    distance += currentRoadSpeed * 10;
    scoreDisplay.textContent = `Distance: ${Math.floor(distance)}`;
    speedometerDisplay.textContent = `Speed: ${Math.floor(currentRoadSpeed * 100)} km/h`;
    moneyDisplay.textContent = currentMoney;

    // Gradually increase max speed and obstacle frequency based on distance
    maxRoadSpeed = 0.5 + (distance / 1000) * 0.05;

    // Update speed: handbrake decelerates strongly but smoothly; otherwise gentle auto-acceleration
    if (isHandBraking) {
        currentRoadSpeed = Math.max(0, currentRoadSpeed - HANDBRAKE_DECEL_RATE);
        // Emit smoke depending on speed and add camera shake
        const emitCount = currentRoadSpeed > 0.2 ? 4 : currentRoadSpeed > 0.1 ? 2 : 1;
        emitSmoke(emitCount);
        cameraShakeIntensity = Math.min(1, cameraShakeIntensity + 0.08);
    } else {
        currentRoadSpeed = Math.min(maxRoadSpeed, currentRoadSpeed + 0.0005);
        cameraShakeIntensity = Math.max(0, cameraShakeIntensity - 0.06);
    }

    // Update smoke particles
    updateSmoke();

    // Apply camera shake
    if (cameraShakeIntensity > 0) {
        const k = cameraShakeIntensity * MAX_CAMERA_SHAKE;
        camera.position.x = baseCameraPos.x + (Math.random() - 0.5) * k;
        camera.position.y = baseCameraPos.y + (Math.random() - 0.5) * k * 0.6;
        camera.position.z = baseCameraPos.z; // keep z stable
    } else {
        camera.position.set(baseCameraPos.x, baseCameraPos.y, baseCameraPos.z);
    }

    const initialSpawnInterval = 2000;
    const minSpawnInterval = 400;
    const distanceToReachMinInterval = 60000;
    const dynamicSpawnInterval = Math.max(minSpawnInterval, initialSpawnInterval - (initialSpawnInterval - minSpawnInterval) * (distance / distanceToReachMinInterval));

    // Spawn obstacles
    if (currentTime - lastObstacleSpawnTime > dynamicSpawnInterval && obstacles.length < 10) {
        createObstacle();
        lastObstacleSpawnTime = currentTime;
    }

    // Spawn coins
    if (currentTime - lastCoinSpawnTime > COIN_SPAWN_INTERVAL) {
        createCoin();
        lastCoinSpawnTime = currentTime;
    }

    // Update and check obstacles
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        const rel = (obstacle.userData && typeof obstacle.userData.relSpeed === 'number') ? obstacle.userData.relSpeed : 0;
        obstacle.position.z += currentRoadSpeed + rel; // Per-obstacle relative speed

        // Collision detection (simple AABB for now)
        const playerBox = new THREE.Box3().setFromObject(playerCar);
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);

        if (playerBox.intersectsBox(obstacleBox)) {
            gameOver();
            return;
        }

        // Remove off-screen obstacles
        if (obstacle.position.z > camera.position.z + 5) { // If obstacle is past the camera
            scene.remove(obstacle);
            obstacles.splice(i, 1);
            i--; // Adjust index after removal
        }
    }

    // Update and check coins
    for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        coin.position.z += currentRoadSpeed; // Move towards camera

        // Coin collection detection
        const playerBox = new THREE.Box3().setFromObject(playerCar);
        const coinBox = new THREE.Box3().setFromObject(coin);

        if (playerBox.intersectsBox(coinBox)) {
            currentMoney++; // Increment money
            scene.remove(coin);
            coins.splice(i, 1);
            i--; // Adjust index after removal
        }

        // Remove off-screen coins
        if (coin.position.z > camera.position.z + 5) { // If coin is past the camera
            scene.remove(coin);
            coins.splice(i, 1);
            i--; // Adjust index after removal
        }
    }

    renderer.render(scene, camera);
}

function showFineMessage(text) {
    if (!fineNotificationDiv) return;
    fineNotificationDiv.textContent = text;
    // Clear previous timers if any
    if (fineMessageTimeout) {
        clearTimeout(fineMessageTimeout);
        fineMessageTimeout = null;
    }
    // Fade in
    fineNotificationDiv.style.opacity = '1';
    fineNotificationDiv.style.transform = 'translate(-50%, -50%) scale(1.0)';
    // Auto hide after 1.2s
    fineMessageTimeout = setTimeout(() => {
        fineNotificationDiv.style.opacity = '0';
        fineNotificationDiv.style.transform = 'translate(-50%, -50%) scale(0.98)';
    }, 1200);
}

// ---------------- FX Helpers (global) ----------------
function startScreech() {
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new Ctx();
        }
        if (screechGain) return; // already running
        screechOsc = audioCtx.createOscillator();
        screechOsc.type = 'sawtooth';
        screechFilter = audioCtx.createBiquadFilter();
        screechFilter.type = 'bandpass';
        screechFilter.frequency.value = 2200;
        screechFilter.Q.value = 6;
        screechGain = audioCtx.createGain();
        screechGain.gain.value = 0.0;
        screechOsc.connect(screechFilter);
        screechFilter.connect(screechGain);
        screechGain.connect(audioCtx.destination);
        const freq = 800 + Math.min(1, currentRoadSpeed * 6) * 1800;
        screechOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        screechOsc.start();
        screechGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.06);
    } catch (e) { /* ignore */ }
}

function stopScreech() {
    try {
        if (audioCtx && screechGain && screechOsc) {
            const t = audioCtx.currentTime;
            screechGain.gain.cancelScheduledValues(t);
            screechGain.gain.setTargetAtTime(0.0, t, 0.05);
            setTimeout(() => {
                try { screechOsc.stop(); } catch {}
                screechOsc.disconnect();
                screechGain.disconnect();
                screechFilter.disconnect();
                screechOsc = null; screechGain = null; screechFilter = null;
            }, 120);
        }
    } catch {}
}

function emitSmoke(count) {
    if (!smokePool || smokePool.length === 0 || !smokeGroup) return;
    for (let n = 0; n < count; n++) {
        const slot = smokePool.find(p => !p.sprite.visible);
        if (!slot) break;
        const { sprite } = slot;
        const side = (n % 2 === 0) ? -0.6 : 0.6;
        const baseZ = -0.7;
        sprite.visible = true;
        sprite.position.set(side + (Math.random()-0.5)*0.1, 0.15, baseZ + (Math.random()-0.5)*0.1);
        sprite.scale.set(0.18, 0.18, 0.18);
        sprite.material.opacity = 0.85;
        slot.life = 0;
        slot.maxLife = 0.6 + Math.random()*0.4;
        slot.vx = (Math.random() - 0.5) * 0.02;
        slot.vy = 0.02 + Math.random()*0.02;
        slot.vz = 0.03 + Math.random()*0.02;
    }
}

function updateSmoke() {
    if (!smokePool) return;
    const dt = 1/60;
    for (let i = 0; i < smokePool.length; i++) {
        const p = smokePool[i];
        if (!p.sprite.visible) continue;
        p.life += dt;
        const t = Math.min(1, p.life / p.maxLife);
        p.sprite.position.x += p.vx;
        p.sprite.position.y += p.vy;
        p.sprite.position.z += p.vz;
        const s = 0.18 + t * 0.6;
        p.sprite.scale.set(s, s, s);
        p.sprite.material.opacity = (1 - t) * 0.85;
        if (p.life >= p.maxLife) {
            p.sprite.visible = false;
            p.sprite.material.opacity = 0;
        }
    }
}

init();
animate();