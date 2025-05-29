import * as THREE from 'three';
import { scene } from './scene.js';

export function createLights() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(0, 20, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
}

export function createCourt(texturePath = 'textures/court_texture.jpg') {
    const courtGeometry = new THREE.PlaneGeometry(15.24, 28.65);
    const textureLoader = new THREE.TextureLoader();

    console.log("Saha dokusu yükleniyor:", texturePath);
    const courtTexture = textureLoader.load(texturePath);

    const courtMaterial = new THREE.MeshStandardMaterial({
        map: courtTexture,
        side: THREE.DoubleSide
    });
    const court = new THREE.Mesh(courtGeometry, courtMaterial);
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    scene.add(court);
}

export function createHoops(hoopsArray, gltf_loader) {

    const hoopRingHeight = 3.05; // Pota çemberinin standart yerden yüksekliği (Y ekseni)
    const hoopRingRadius = 0.45;
    const hoopTubeRadius = 0.03;

    // --- BURASI ÇOK ÖNEMLİ: HİZALAMA AYARLARI ---
    // Bu ofset değerleriyle oynayarak kırmızı ve mavi tel kafes çemberleri
    // görsel pota modelinin tam içine oturacak şekilde ayarlamanız gerekiyor.
    // Özellikle Z eksenindeki kaymayı düzeltmek için bu değerleri değiştirin.
    // Örnek: Değeri -0.5, -0.4, 0, 0.1 gibi değiştirerek test edin.
    const hoop1_Z_offset = -0.6; // Birinci potanın (pozitif Z tarafındaki) tel kafes çemberinin Z ofseti.
    const hoop2_Z_offset = 0.6;  // İkinci potanın (negatif Z tarafındaki) tel kafes çemberinin Z ofseti.
    // ---------------------------------------------

    gltf_loader.load(
        'models/basketball_hoop2.glb',
        function (gltf) {
            // --- Birinci Pota ---
            const hoop1 = gltf.scene;
            hoop1.scale.set(0.01, 0.01, 0.01);
            hoop1.position.set(0, 2, 12.5); // Görsel modelin pozisyonu
            hoop1.rotation.y = Math.PI;
            hoop1.castShadow = false;
            hoop1.receiveShadow = false;
            scene.add(hoop1);

            const torusGeo1 = new THREE.TorusGeometry(hoopRingRadius, hoopTubeRadius, 16, 50);
            const torusMat1 = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
            const hoop1CollisionMesh = new THREE.Mesh(torusGeo1, torusMat1);

            // Çarpışma çemberinin pozisyonunu buradan ayarlayın
            hoop1CollisionMesh.position.set(hoop1.position.x, hoopRingHeight, hoop1.position.z + hoop1_Z_offset);
            hoop1CollisionMesh.rotation.x = Math.PI / 2;
            scene.add(hoop1CollisionMesh);
            hoop1.userData.collisionMesh = hoop1CollisionMesh;
            hoopsArray.push(hoop1);

            // --- İkinci Pota ---
            const hoop2 = gltf.scene.clone();
            hoop2.scale.set(0.01, 0.01, 0.01);
            hoop2.position.set(0, 2, -12.5); // Görsel modelin pozisyonu
            hoop2.rotation.y = Math.PI; // İkinci potanın yönü tersse burayı "0" olarak deneyin.
            hoop2.castShadow = false;
            hoop2.receiveShadow = false;
            scene.add(hoop2);

            const torusGeo2 = new THREE.TorusGeometry(hoopRingRadius, hoopTubeRadius, 16, 50);
            const torusMat2 = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true });
            const hoop2CollisionMesh = new THREE.Mesh(torusGeo2, torusMat2);

            // Çarpışma çemberinin pozisyonunu buradan ayarlayın
            hoop2CollisionMesh.position.set(hoop2.position.x, hoopRingHeight, hoop2.position.z + hoop2_Z_offset);
            hoop2CollisionMesh.rotation.x = Math.PI / 2;
            scene.add(hoop2CollisionMesh);
            hoop2.userData.collisionMesh = hoop2CollisionMesh;
            hoopsArray.push(hoop2);

            console.log("Potalar ve çarpışma çemberleri oluşturuldu.");
        },
        undefined, // XHR onProgress callback
        function (error) {
            console.error('Pota modeli yüklenirken hata oluştu:', error);
        }
    );
}