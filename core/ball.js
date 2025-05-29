import * as THREE from 'three';

export class Ball {
    constructor(gravityValue = 0.015) {
        const geometry = new THREE.SphereGeometry(0.3, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xf85e00,
            roughness: 0.7,
            metalness: 0.1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(2, 0.3, 0);

        this.isHeld = false;
        this.holder = null;
        this.velocity = new THREE.Vector3();
        this.gravity = gravityValue;
        this.isMoving = false;

        this.radius = 0.3;
        this.previousPosition = new THREE.Vector3();
        this.ballSphere = new THREE.Sphere(this.mesh.position, this.radius);

        this.hasScored = false;
        this.scoreTimeout = null;

        this.localOffset = new THREE.Vector3(0.0, 0.5, -0.7);
        this.tempQuaternion = new THREE.Quaternion();
    }

    // GÜNCELLENDİ: update fonksiyonu artık deltaTime parametresi alıyor
    update(deltaTime) {
        this.previousPosition.copy(this.mesh.position);

        if (this.isHeld && this.holder) {
            const playerRotation = this.holder.rotation.y;
            this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerRotation);
            const rotatedOffset = this.localOffset.clone().applyQuaternion(this.tempQuaternion);
            this.mesh.position.copy(this.holder.position).add(rotatedOffset);

        } else if (this.isMoving) {
            // --- FİZİK GÜNCELLEMESİ (deltaTime İLE DÜZELTİLDİ) ---
            // 60 FPS'i baz alarak bir ölçekleme faktörü oluşturuyoruz.
            const timeScale = deltaTime * 60;

            // Yerçekimini geçen süreye göre uygula
            this.velocity.y -= this.gravity * timeScale;
            // Hızı geçen süreyle çarparak pozisyonu güncelle
            this.mesh.position.add(this.velocity.clone().multiplyScalar(timeScale));
            // --------------------------------------------------------

            const courtWidth = 15.24;
            const courtLength = 28.65;
            const maxHeight = 15.0;
            const elasticity = 0.7;

            const minX = -courtWidth / 2 + this.radius;
            const maxX = courtWidth / 2 - this.radius;
            const minZ = -courtLength / 2 + this.radius;
            const maxZ = courtLength / 2 - this.radius;
            const minY = this.radius;

            if (this.mesh.position.x < minX || this.mesh.position.x > maxX) {
                this.mesh.position.x = Math.max(minX, Math.min(maxX, this.mesh.position.x));
                this.velocity.x *= -elasticity;
            }
            if (this.mesh.position.z < minZ || this.mesh.position.z > maxZ) {
                this.mesh.position.z = Math.max(minZ, Math.min(maxZ, this.mesh.position.z));
                this.velocity.z *= -elasticity;
            }
            if (this.mesh.position.y <= minY) {
                this.mesh.position.y = minY;
                this.velocity.y *= -0.6;
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                if (this.velocity.length() < 0.05) {
                   this.isMoving = false;
                   this.velocity.set(0, 0, 0);
                }
            } else if (this.mesh.position.y > maxHeight - this.radius) {
                this.mesh.position.y = maxHeight - this.radius;
                this.velocity.y *= -elasticity;
            }
        }
        this.ballSphere.center.copy(this.mesh.position);
    }

    throw(direction) {
        if (this.isHeld) {
            this.isHeld = false;
            this.holder = null;
            this.isMoving = true;
            this.velocity.copy(direction);
            this.hasScored = false;
            if(this.scoreTimeout) clearTimeout(this.scoreTimeout);
        }
    }

    pickUp(player) {
        if (!this.isHeld && !this.isMoving) {
            this.isHeld = true;
            this.holder = player;
            this.velocity.set(0, 0, 0);
            this.hasScored = false;
        }
    }

    checkHoopCollision(hoops, onScoreCallback) {
        if (!this.isMoving || this.hasScored) return;

        hoops.forEach(hoop => {
            const hoopCollisionMesh = hoop.userData.collisionMesh;
            if (!hoopCollisionMesh) return;

            const hoopY = hoopCollisionMesh.position.y;
            const hoopRadius = hoopCollisionMesh.geometry.parameters.radius;

            const hoopBBox = new THREE.Box3().setFromObject(hoopCollisionMesh);
            if (hoopBBox.intersectsSphere(this.ballSphere)) {
                
                // console.log(`Pota kontrol: Top Y: ${this.mesh.position.y.toFixed(3)}, Önceki Y: ${this.previousPosition.y.toFixed(3)}, Pota Y: ${hoopY.toFixed(3)}, Hız Y: ${this.velocity.y.toFixed(3)}`);

                const isMovingDown = this.velocity.y < 0;
                const wasAbove = this.previousPosition.y > hoopY;
                const isNowBelow = this.mesh.position.y <= hoopY;
                const isInHorizontalBounds = Math.abs(this.mesh.position.x - hoopCollisionMesh.position.x) < hoopRadius &&
                                             Math.abs(this.mesh.position.z - hoopCollisionMesh.position.z) < hoopRadius;

                if (isMovingDown && wasAbove && isNowBelow && isInHorizontalBounds)
                {
                    console.log("%cSKOR!", "color: green; font-size: 24px;");
                    this.hasScored = true;
                    if (onScoreCallback) {
                        onScoreCallback();
                    }
                    if (this.scoreTimeout) clearTimeout(this.scoreTimeout);
                    this.scoreTimeout = setTimeout(() => {
                        this.hasScored = false;
                    }, 2000);
                }
            }
        });
    }
}