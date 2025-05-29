import * as THREE from 'three';

export let scene;
export let renderer; // Bu global renderer, game.js'deki ana renderer ile aynı nesne olmalı.

export function createScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Açık mavi gökyüzü
    return scene;
}

export function createRenderer() {
    // Bu fonksiyon game.js'de çağrılıp global `renderer` atanıyor.
    const localRenderer = new THREE.WebGLRenderer({ antialias: true });
    localRenderer.setSize(window.innerWidth, window.innerHeight);
    localRenderer.shadowMap.enabled = true;
    document.body.appendChild(localRenderer.domElement);
    return localRenderer;
}

// handleWindowResize, artık aktif renderer'ı parametre olarak alıyor.
export function handleWindowResize(camera, activeRenderer) {
    const onWindowResize = () => {
        if (camera && activeRenderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            activeRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    };

    window.addEventListener('resize', onWindowResize);

    // Temizleme fonksiyonunu döndür
    const cleanupResizeListener = () => {
        console.log("Window resize listener (scene.js) kaldırılıyor...");
        window.removeEventListener('resize', onWindowResize);
    };
    return cleanupResizeListener;
}