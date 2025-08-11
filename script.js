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

    restartGame();
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
            break;
        case ' ': // Spacebar for handbrake
            isHandBraking = true;
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
    }
    updateSteeringWheel();
}

function updateSteeringWheel() {
    if (steeringWheel) {
        steeringWheel.style.transform = `rotate(${currentSteeringAngle}deg)`;
    }
}

function updateBrakeLights() {
    // No brake lights for placeholder cube
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

    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 2.5, z);
    poleGroup.add(pole);

    const lightBulbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const lightBulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const lightBulb = new THREE.Mesh(lightBulbGeometry, lightBulbMaterial);
    lightBulb.position.set(x, 5, z);
    poleGroup.add(lightBulb);

    const pointLight = new THREE.PointLight(0xffffff, 0.5, 50);
    pointLight.position.set(x, 5, z);
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
    } else {
        currentRoadSpeed = Math.min(maxRoadSpeed, currentRoadSpeed + 0.0005);
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

init();
animate();