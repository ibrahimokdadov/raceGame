import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

const scoreDisplay = document.getElementById('score');
const speedometerDisplay = document.getElementById('speedometer');
const gameOverDisplay = document.getElementById('gameOver');
const restartButton = document.getElementById('restartButton');
const threejsContainer = document.getElementById('threejs-container');
const moneyDisplay = document.getElementById('money-display'); // Get reference to money display
let steeringWheel; // Declare globally, assign in init

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

let lightPoles = [];

let sideObjects = [];

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

    const carGeometry = new THREE.BoxGeometry(1, 1, 2);
    const carMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    playerCar = new THREE.Mesh(carGeometry, carMaterial);
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

    // Add side objects
    for (let i = 0; i < 10; i++) {
        createSideObject(-15, -40 + (i * 20)); // Left side
        createSideObject(15, -40 + (i * 20));  // Right side
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
    const obstacleGeometry = new THREE.BoxGeometry(OBSTACLE_WIDTH, OBSTACLE_HEIGHT, OBSTACLE_DEPTH);
    const obstacleMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);

    const laneIndex = Math.floor(Math.random() * LANE_POSITIONS.length);
    obstacle.position.set(LANE_POSITIONS[laneIndex], OBSTACLE_HEIGHT / 2, -50); // Start far back
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

function createSideObject(x, z) {
    const houseGroup = new THREE.Group();

    // House body (random size for variety)
    const bodyWidth = 2 + Math.random() * 2;
    const bodyHeight = 3 + Math.random() * 3;
    const bodyDepth = 2 + Math.random() * 2;
    const bodyGeometry = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }); // Random color for body
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(x, bodyHeight / 2, z);
    houseGroup.add(body);

    // Roof (cone for simplicity, positioned on top of the body)
    const roofRadius = bodyWidth / 1.5;
    const roofHeight = bodyWidth / 1.5;
    const roofGeometry = new THREE.ConeGeometry(roofRadius, roofHeight, 4); // 4 segments for a pyramid-like roof
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown for roof
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(x, bodyHeight + roofHeight / 2, z);
    houseGroup.add(roof);

    scene.add(houseGroup);
    sideObjects.push(houseGroup);
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

    // Clear existing side objects
    sideObjects.forEach(sideObject => scene.remove(sideObject));
    sideObjects = [];

    // Clear existing trees
    trees.forEach(treeGroup => scene.remove(treeGroup));
    trees = [];

    // Clear existing mountains
    mountains.forEach(mountainGroup => scene.remove(mountainGroup));
    mountains = [];

    // Reset lane markings
    laneMarkings.forEach(marking => scene.remove(marking));
    laneMarkings = [];
    createLaneMarkings();

    // Re-add light poles
    for (let i = 0; i < 10; i++) {
        createLightPole(-7, -40 + (i * 20));
        createLightPole(7, -40 + (i * 20));
    }

    // Re-add side objects
    for (let i = 0; i < 10; i++) {
        createSideObject(-15, -40 + (i * 20)); // Left side
        createSideObject(15, -40 + (i * 20));  // Right side
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

    // Move side objects
    sideObjects.forEach(sideObject => {
        sideObject.position.z += currentRoadSpeed;
        if (sideObject.position.z > 10) {
            sideObject.position.z -= 100; // Move back to the start
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

    // Update distance and speedometer
    distance += currentRoadSpeed * 10;
    scoreDisplay.textContent = `Distance: ${Math.floor(distance)}`;
    speedometerDisplay.textContent = `Speed: ${Math.floor(currentRoadSpeed * 100)} km/h`;
    moneyDisplay.textContent = currentMoney;

    // Gradually increase max speed and obstacle frequency based on distance
    maxRoadSpeed = 0.5 + (distance / 1000) * 0.05;

    // Auto-accelerate currentRoadSpeed
    currentRoadSpeed = Math.min(maxRoadSpeed, currentRoadSpeed + 0.0005);

    const currentTime = performance.now();
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
        obstacle.position.z += currentRoadSpeed; // Move towards camera

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

init();
animate();