import * as THREE from 'three';
import { scene } from './scene.js';
import { Ball } from './ball.js';

function calculateTrajectory(startPos, startVel, gravity, numSteps) {
    const points = [];
    const currentPos = startPos.clone();
    const currentVel = startVel.clone();
    points.push(currentPos.clone());
    for (let i = 1; i <= numSteps; i++) {
        currentVel.y -= gravity;
        currentPos.add(currentVel);
        points.push(currentPos.clone());
        if (currentPos.y < 0.1) break;
    }
    return points;
}

export class ShootingSystem {
    constructor(playerRef) {
        this.mousePosition = { x: 0, y: 0 };
        this.throwPower = 0;
        this.maxThrowPower = 1.0;
        this.powerBarElement = this.createPowerBar();
        this.trajectoryLine = null;
        this.gravity = new Ball().gravity;
        this.verticalAngle = Math.PI / 4;
        this.minAngle = Math.PI / 8;
        this.maxAngle = Math.PI / 2.5;
        this.angleChangeSpeed = 0.02;
        this.powerIncrement = 0.1;
        this.isAimAssisted = false;
        this.autoAimVelocity = new THREE.Vector3();

        this.player = playerRef;

        this.setupMouseListeners();
        this.updatePowerBar();
    }

    createPowerBar() {
        const powerBarContainer = document.createElement('div'); powerBarContainer.style.position = 'fixed';
        powerBarContainer.style.left = '30px'; powerBarContainer.style.top = '50%';
        powerBarContainer.style.transform = 'translateY(-50%)'; powerBarContainer.style.width = '20px';
        powerBarContainer.style.height = '200px'; powerBarContainer.style.backgroundColor = '#222';
        powerBarContainer.style.border = '2px solid #fff'; powerBarContainer.style.borderRadius = '5px';
        powerBarContainer.style.overflow = 'hidden'; powerBarContainer.style.zIndex = '100';
        const powerLevel = document.createElement('div'); powerLevel.style.position = 'absolute';
        powerLevel.style.bottom = '0'; powerLevel.style.width = '100%';
        powerLevel.style.backgroundColor = '#4CAF50'; powerLevel.style.transition = 'height 0.1s ease-out';
        powerLevel.style.height = '0%'; powerBarContainer.appendChild(powerLevel);
        document.body.appendChild(powerBarContainer); return powerBarContainer;
    }

    setupMouseListeners() {
        window.addEventListener('mousemove', (event) => {
            if (!this.isAimAssisted) {
                this.mousePosition.x = -((event.clientX / window.innerWidth) * 2 - 1);
            }
        });
    }

    adjustAngle(amount) {
        if (this.isAimAssisted) return;
        this.verticalAngle += amount;
        this.verticalAngle = Math.max(this.minAngle, Math.min(this.maxAngle, this.verticalAngle));
    }

    increasePower() {
        if (this.isAimAssisted) return;
        if (this.throwPower >= this.maxThrowPower) {
            this.throwPower = 0;
        } else {
            this.throwPower += this.powerIncrement;
            this.throwPower = Math.min(this.throwPower, this.maxThrowPower);
        }
        this.updatePowerBar();
    }

    calculateThrowVelocity(ball) {
        const basePower = 0.35;
        const powerBarFactor = 0.50;
        const horizontalDirection = new THREE.Vector3(0, 0, -1);
        const horizontalAngle = this.mousePosition.x * Math.PI / 4;
        horizontalDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalAngle);
        if (ball.holder) {
            horizontalDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), ball.holder.rotation.y);
        }
        let throwDirection = horizontalDirection.clone();
        throwDirection.y = Math.tan(this.verticalAngle);
        throwDirection.normalize();
        const finalPower = basePower + (this.throwPower * powerBarFactor);
        return throwDirection.multiplyScalar(finalPower);
    }

    hideTrajectory() {
         if (this.trajectoryLine) { scene.remove(this.trajectoryLine); this.trajectoryLine.geometry.dispose(); this.trajectoryLine.material.dispose(); this.trajectoryLine = null; }
    }

    showTrajectory(ball) { this.updateTrajectoryLine(ball); }

    updateTrajectoryLine(ball) {
        if (!ball.isHeld || !ball.holder) { this.hideTrajectory(); return; }
        this.gravity = ball.gravity;
        const initialVelocity = this.isAimAssisted ? this.autoAimVelocity : this.calculateThrowVelocity(ball);
        const points = calculateTrajectory(ball.mesh.position, initialVelocity, this.gravity, 70);
        this.hideTrajectory(); if (points.length < 2) return;
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffa500 });
        this.trajectoryLine = new THREE.Mesh(tubeGeo, tubeMat);
        scene.add(this.trajectoryLine);
    }

    update(ball) {
        if (ball.isHeld) {
            this.updateTrajectoryLine(ball);
        }
    }

    updatePowerBar() {
        if (!this.powerBarElement) return; const powerLevel = this.powerBarElement.firstChild; if (!powerLevel) return;
        const percentage = (this.throwPower / this.maxThrowPower) * 100; powerLevel.style.height = `${percentage}%`;
        const hue = (1 - this.throwPower / this.maxThrowPower) * 120;
        powerLevel.style.backgroundColor = `hsl(${hue}, 90%, 50%)`;
    }

    releaseCharge(ball) {
        if (!ball.isHeld) return;
        let velocity;
        if (this.isAimAssisted) {
            console.log("Otomatik atış yapılıyor...");
            velocity = this.autoAimVelocity.clone();
        } else {
            if (this.throwPower <= 0) return;
            console.log("Manuel atış yapılıyor... Güç:", this.throwPower.toFixed(1), "Açı:", THREE.MathUtils.radToDeg(this.verticalAngle).toFixed(1));
            velocity = this.calculateThrowVelocity(ball);
        }
        ball.throw(velocity);
        this.throwPower = 0;
        this.updatePowerBar();
        this.hideTrajectory();
        this.isAimAssisted = false;
        this.autoAimVelocity.set(0, 0, 0);
    }

    performAutoShot(ball, hoops) {
        if (!ball.isHeld || !hoops || hoops.length === 0) return;

        console.log("X Tuşu: Otomatik Nişan ve Güç Hesaplanıyor...");
        this.gravity = ball.gravity;

        const playerPos = ball.holder.position.clone();
        const playerDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ball.holder.rotation.y).normalize();

        let targetHoop = null;
        let maxDot = 0.1;
        hoops.forEach(hoop => {
            if (hoop.userData && hoop.userData.collisionMesh) {
                const hoopPos = hoop.userData.collisionMesh.position;
                const toHoop = hoopPos.clone().sub(playerPos).normalize();
                const dot = playerDir.dot(toHoop);
                if (dot > maxDot) {
                    maxDot = dot;
                    targetHoop = hoop;
                }
            }
        });

        if (targetHoop) {
            const targetPos = targetHoop.userData.collisionMesh.position.clone();
            targetPos.y += 0.25;
            
            const startPos = ball.mesh.position.clone();

            // SORUNUN KAYNAĞI BU SATIRDI. Skorlama koşulunu bozuyordu.
            // Bu satırı kaldırarak doğrudan çemberin merkezine nişan alıyoruz.
            // targetPos.y -= 0.15;

            const g = this.gravity;
            const dP_horizontal = new THREE.Vector3(targetPos.x - startPos.x, 0, targetPos.z - startPos.z);
            const delta_x = dP_horizontal.length();
            const delta_y = targetPos.y - startPos.y;

            const theta = Math.PI / 4;
            const cosTheta = Math.cos(theta);
            const tanTheta = Math.tan(theta);

            const numerator = g * delta_x * delta_x;
            const denominator = 2 * cosTheta * cosTheta * (delta_x * tanTheta - delta_y);

            if (denominator <= 0) {
                console.log("Hedef bu açıyla ulaşılamaz.");
                this.isAimAssisted = false;
                return;
            }

            const v0_squared = numerator / denominator;
            const v0 = Math.sqrt(v0_squared);

            if (isNaN(v0)) {
                console.log("Hesaplama hatası (v0 = NaN), hedef ulaşılamaz.");
                this.isAimAssisted = false;
                return;
            }

            const aimDirectionHorizontal = dP_horizontal.normalize();
            const horizontal_velocity_component = aimDirectionHorizontal.multiplyScalar(v0 * cosTheta);
            const idealVelocity = new THREE.Vector3(
                horizontal_velocity_component.x,
                v0 * Math.sin(theta),
                horizontal_velocity_component.z
            );

            this.autoAimVelocity.copy(idealVelocity);
            this.isAimAssisted = true;

            const finalPower = idealVelocity.length();
            const basePower = 0.35;
            const powerBarFactor = 0.50;
            this.throwPower = (finalPower - basePower) / powerBarFactor;
            this.throwPower = Math.max(0, Math.min(this.maxThrowPower, this.throwPower));
            this.verticalAngle = theta;

            console.log("Otomatik Nişan Ayarlandı. Güç:", this.throwPower.toFixed(2), "Açı:", THREE.MathUtils.radToDeg(this.verticalAngle).toFixed(1));
            this.updatePowerBar();
            this.updateTrajectoryLine(ball);
            console.log("Sol Tıkla Atış Yap.");

        } else {
            console.log("Uygun bir hedef pota bulunamadı.");
            this.isAimAssisted = false;
        }
    }

    dispose() {
        if (this.powerBarElement && this.powerBarElement.parentNode) {
            this.powerBarElement.parentNode.removeChild(this.powerBarElement);
            this.powerBarElement = null;
        }
        this.hideTrajectory();
    }
}