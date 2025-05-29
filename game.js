import { createScene, createRenderer, handleWindowResize, scene as globalScene } from './core/scene.js';
import { createCamera, enableCameraMotions, updateCameraPosition } from './core/camera.js';
import { createLights, createCourt, createHoops } from './core/world.js';
import { createPlayer, setupPlayerControls } from './core/player.js';
import { Ball } from './core/ball.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as THREE from 'three';

export const gltf_loader = new GLTFLoader();
export const fbx_loader = new FBXLoader();
let gameRenderer;
let camera;

let updatePlayerAndSystem;
let cleanupPlayerSystem = null;
let cleanupResizeHandler = null;

let ball;
export let hoops = [];
let score = 0;
let scoreElement;

export let currentLevel = 1;
export const levelSettings = {
    1: {
        name: "Dünya",
        gravity: 0.015,
        courtTexture: 'textures/court_texture.jpg',
        hdriPath: 'textures/hdri/earth_sky.hdr',
        skyColor: 0x87CEEB
    },
    2: {
        name: "Mars",
        gravity: 0.0057,
        courtTexture: 'textures/court_texture_mars.jpg',
        hdriPath: 'textures/hdri/mars_sky.hdr',
        skyColor: 0xFF7F50
    },
    3: {
        name: "Europa Uydusu",
        gravity: 0.01125,
        courtTexture: 'textures/court_texture_europa.jpg',
        hdriPath: 'textures/hdri/europa_sky.hdr',
        skyColor: 0xADD8E6
    },
    4: {
        name: "Kara Delik Gezegeni",
        gravity: 0.0225,
        courtTexture: 'textures/court_texture_blackhole.jpg',
        hdriPath: 'textures/hdri/blackhole_sky.hdr',
        skyColor: 0x101020
    }
};

const rgbeLoader = new RGBELoader();
const clock = new THREE.Clock();

function setEnvironment(settings) {
    if (settings.hdriPath) {
        rgbeLoader.load(settings.hdriPath, function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            globalScene.background = texture;
            globalScene.environment = texture;
            console.log(settings.name + " için HDRI yüklendi ve ayarlandı.");
        }, undefined, (err) => {
            console.error("HDRI yüklenirken hata: " + settings.hdriPath + ". Yedek renk kullanılıyor.", err);
            globalScene.background = new THREE.Color(settings.skyColor || 0x333333);
            globalScene.environment = null;
        });
    } else if (settings.skyColor) {
        globalScene.background = new THREE.Color(settings.skyColor);
        globalScene.environment = null;
        console.warn(settings.name + " için hdriPath tanımlanmamış, düz renk kullanılıyor.");
    } else {
        globalScene.background = new THREE.Color(0x333333);
        globalScene.environment = null;
        console.warn(settings.name + " için ne hdriPath ne de skyColor tanımlı. Varsayılan arka plan kullanılıyor.");
    }
}

function updateScoreDisplay() {
    if (scoreElement) {
        scoreElement.innerText = 'Skor: ' + score;
    }
}

export function incrementScore() {
    score++;
    updateScoreDisplay();
    // Skor olduğunda çağrılan `checkHoopCollision` içindeki konsol mesajı daha belirgin
}

let animationFrameId = null;

function performFullCleanup() {
    console.log("performFullCleanup çağrıldı. Önceki seviyeden kalanlar temizleniyor...");
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Animasyon durduruldu.");
    }
    if (cleanupPlayerSystem) {
        cleanupPlayerSystem();
        cleanupPlayerSystem = null;
    }
    updatePlayerAndSystem = null;
    if (cleanupResizeHandler) {
        cleanupResizeHandler();
        cleanupResizeHandler = null;
    }
    for (let i = globalScene.children.length - 1; i >= 0; i--) {
        const child = globalScene.children[i];
        // Kamera ve ışıkları sahnede tut
        if (child.isCamera || child.isLight) {
            continue;
        }
        
        // Belleği temizle
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(material => { if (material.dispose) material.dispose(); });
            } else if (child.material.dispose) {
                child.material.dispose();
            }
        }
        child.traverse(subChild => {
            if (subChild.isMesh) {
                if (subChild.geometry) subChild.geometry.dispose();
                if (subChild.material) {
                     if (Array.isArray(subChild.material)) {
                        subChild.material.forEach(material => { if (material.dispose) material.dispose(); });
                    } else if (subChild.material.dispose) {
                        subChild.material.dispose();
                    }
                }
            }
        });
        globalScene.remove(child);
    }
    hoops = [];
    ball = null;
    console.log("Sahne nesneleri temizlendi.");
}


function resetAndInitLevel() {
    console.log("resetAndInitLevel çağrıldı.");
    performFullCleanup();
    score = 0;
    updateScoreDisplay();
    console.log("Tam temizlik yapıldı, yeni seviye için init() çağrılıyor.");
    init();
}

export function changeLevel(levelId) {
    if (levelSettings[levelId] && currentLevel !== levelId) {
        console.log((levelSettings[currentLevel]?.name || "Bilinmeyen Gezegen") + " gezegeninden " + (levelSettings[levelId]?.name || "Bilinmeyen Gezegen") + " gezegenine geçiliyor...");
        currentLevel = levelId;
        resetAndInitLevel();
    } else if (currentLevel === levelId) {
        console.log((levelSettings[currentLevel]?.name || "Bilinmeyen Gezegen") + " gezegenindesiniz zaten.");
    } else {
        console.warn("Geçersiz seviye ID'si:", levelId);
    }
}

function init() {
    const settings = levelSettings[currentLevel];
    if (!settings) {
        console.error("Geçerli seviye ayarları bulunamadı! Seviye ID:", currentLevel);
        currentLevel = 1;
        init(); // Güvenli bir şekilde tekrar başlat
        return;
    }
    console.log(settings.name + " gezegeni yükleniyor... Yerçekimi:", settings.gravity);

    createScene();
    setEnvironment(settings);
    camera = createCamera();

    if (!gameRenderer) {
        gameRenderer = createRenderer();
    } else {
        if (!gameRenderer.domElement.parentElement) {
            document.body.appendChild(gameRenderer.domElement);
        }
        gameRenderer.setSize(window.innerWidth, window.innerHeight);
    }

    scoreElement = document.getElementById('score');
    updateScoreDisplay();

    createLights(); // Işıkları sahneye ekle

    const player = createPlayer();
    ball = new Ball(settings.gravity);
    globalScene.add(ball.mesh);

    hoops = [];
    createHoops(hoops, gltf_loader);

    const playerControlSystem = setupPlayerControls(player, ball, hoops);
    updatePlayerAndSystem = playerControlSystem.update;
    cleanupPlayerSystem = playerControlSystem.cleanup;

    enableCameraMotions(gameRenderer, player);
    cleanupResizeHandler = handleWindowResize(camera, gameRenderer);

    createCourt(settings.courtTexture);

    const buttonConfigs = [
        { id: 'goToWorldButton', level: 1 },
        { id: 'goToMarsButton', level: 2 },
        { id: 'goToEuropaButton', level: 3 },
        { id: 'goToBlackholeButton', level: 4 }
    ];

    buttonConfigs.forEach(config => {
        const button = document.getElementById(config.id);
        if (button) {
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            newButton.addEventListener('click', () => changeLevel(config.level));
        }
    });

    if (!animationFrameId) {
         console.log("Animasyon döngüsü başlatılıyor.");
         clock.start();
         animate();
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();

    if (updatePlayerAndSystem) {
        updatePlayerAndSystem(deltaTime);
    }
    if (ball) {
        // GÜNCELLENDİ: ball.update'e deltaTime gönderiliyor
        ball.update(deltaTime);
        ball.checkHoopCollision(hoops, incrementScore);
    }
    updateCameraPosition();

    if (gameRenderer && globalScene && camera) {
        gameRenderer.render(globalScene, camera);
    }
}

// Oyunu başlat
init();