import * as THREE from 'three';
import { ShootingSystem } from './shoot.js';
import { fbx_loader, levelSettings, currentLevel } from '../game.js'; // game.js'den import ediliyor
import { scene } from './scene.js';

export class Player {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.mesh.position.set(0, 0, 0);
        this.direction = new THREE.Vector3(0, 0, -1);
        this.speed = 0.15;
        this.rotationSpeed = 0.05;

        this.velocityY = 0;
        this.isJumping = false;
        this.onGround = true;
        this.jumpForce = 0.25;
        this.playerGravity = levelSettings[currentLevel] ? levelSettings[currentLevel].gravity * 0.8 : 0.015 * 0.8;
        this.modelObject = null;

        this.mixer = null;
        this.actions = {};
        this.activeActionName = null;
        this.isAnimatingAction = false;
        this.isMovingHorizontal = false;

        this.loadCharacterAndAnimations();
    }

    loadCharacterAndAnimations() {
        const modelPath = 'models/Idle.fbx';
        const animPaths = {
            run: 'models/running.fbx',
            jump_up: 'models/jumping_up.fbx',
            jump_down: 'models/jumping_down.fbx',
            shoot: 'models/shooting.fbx'
        };

        fbx_loader.load(modelPath, (loadedFbx) => {
            this.modelObject = loadedFbx;
            this.modelObject.scale.set(0.01, 0.01, 0.01);
            this.modelObject.rotation.y = Math.PI;

            this.modelObject.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.mesh.add(this.modelObject);
            scene.add(this.mesh);
            console.log("Oyuncu ana modeli (Idle) yüklendi:", modelPath);

            this.mixer = new THREE.AnimationMixer(this.modelObject);

            if (loadedFbx.animations && loadedFbx.animations.length > 0) {
                const idleClip = loadedFbx.animations[0];
                this.actions['idle'] = this.mixer.clipAction(idleClip);
                this.actions['idle'].play();
                this.activeActionName = 'idle';
                console.log("Varsayılan 'idle' animasyonu oynatılıyor:", idleClip.name);
            } else {
                console.warn(modelPath + " içinde varsayılan animasyon bulunamadı.");
            }

            Object.keys(animPaths).forEach(animName => {
                const path = animPaths[animName];
                fbx_loader.load(path, (animFbx) => {
                    if (animFbx.animations && animFbx.animations.length > 0) {
                        const clip = animFbx.animations[0];
                        this.actions[animName] = this.mixer.clipAction(clip);
                        console.log("'" + animName + "' animasyonu yüklendi:", clip.name);

                        if (['jump_up', 'jump_down', 'shoot'].includes(animName)) {
                            this.actions[animName].setLoop(THREE.LoopOnce);
                            this.actions[animName].clampWhenFinished = true;
                        }
                    } else {
                        console.warn(path + " içinde animasyon klibi bulunamadı.");
                    }
                }, undefined, (error) => console.error(path + " yüklenirken hata:", error));
            });

        }, undefined, (error) => {
            console.error(modelPath + ' yüklenirken hata:', error);
        });
    }

    playAnimation(name, crossFadeDuration = 0.2) {
        if (this.activeActionName === name || !this.actions[name] || !this.mixer || this.isAnimatingAction) return;

        const previousAction = this.actions[this.activeActionName];
        const newAction = this.actions[name];

        if (previousAction && previousAction !== newAction) {
            previousAction.fadeOut(crossFadeDuration);
        }

        newAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(crossFadeDuration)
            .play();

        this.activeActionName = name;
    }

    playAnimationOnce(name, onFinishedCallback, crossFadeDuration = 0.1) {
        if (!this.actions[name] || !this.mixer || this.isAnimatingAction) {
            if (onFinishedCallback) onFinishedCallback();
            return;
        }

        this.isAnimatingAction = true;
        const actionToPlay = this.actions[name];
        const previousActionName = this.activeActionName;

        if (this.actions[previousActionName] && this.actions[previousActionName] !== actionToPlay) {
            this.actions[previousActionName].fadeOut(crossFadeDuration);
        }

        actionToPlay
            .reset()
            .setLoop(THREE.LoopOnce, 1)
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(crossFadeDuration)
            .play();
        this.activeActionName = name;

        const listener = (event) => {
            if (event.action === actionToPlay) {
                this.mixer.removeEventListener('finished', listener);
                this.isAnimatingAction = false;
                if (name !== 'shoot' && name !== 'jump_down') {
                     this.playAnimation(this.isMovingHorizontal ? 'run' : 'idle');
                }
                if (onFinishedCallback) {
                    onFinishedCallback();
                }
            }
        };
        this.mixer.addEventListener('finished', listener);
    }

    jump() {
        if (this.onGround && !this.isAnimatingAction) {
            this.velocityY = this.jumpForce;
            this.isJumping = true;
            this.onGround = false;
            this.playAnimationOnce('jump_up', () => {});
        }
    }

    move(keysPressed, deltaTime) {
        this.playerGravity = levelSettings[currentLevel] ? levelSettings[currentLevel].gravity * 0.8 : 0.015 * 0.8;
        
        const moveVector = new THREE.Vector3(0, 0, 0);
        this.isMovingHorizontal = false;

        const currentSpeed = this.speed;
        const currentRotationSpeed = this.rotationSpeed;

        if (keysPressed['w'] || keysPressed['arrowup']) { moveVector.z = -currentSpeed; this.isMovingHorizontal = true; }
        if (keysPressed['s'] || keysPressed['arrowdown']) { moveVector.z = currentSpeed; this.isMovingHorizontal = true; }
        if (keysPressed['a'] || keysPressed['arrowleft']) { this.mesh.rotation.y += currentRotationSpeed; }
        if (keysPressed['d'] || keysPressed['arrowright']) { this.mesh.rotation.y -= currentRotationSpeed; }

        moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        this.mesh.position.add(moveVector);

        const timeScale = deltaTime * 60;
        this.velocityY -= this.playerGravity * timeScale;
        this.mesh.position.y += this.velocityY * timeScale;

        if (this.mesh.position.y < 0) {
            this.mesh.position.y = 0;
            this.velocityY = 0;
            if (this.isJumping) {
                this.playAnimationOnce('jump_down', () => {
                    this.playAnimation(this.isMovingHorizontal ? 'run' : 'idle');
                });
            }
            this.isJumping = false;
            this.onGround = true;
        }

        if (!this.isAnimatingAction && this.onGround) {
            if (this.isMovingHorizontal) {
                this.playAnimation('run');
            } else {
                this.playAnimation('idle');
            }
        }

        const courtWidth = 15.24; const courtLength = 28.65; const playerMargin = 0.3;
        const minX = -courtWidth / 2 + playerMargin; const maxX = courtWidth / 2 - playerMargin;
        const minZ = -courtLength / 2 + playerMargin; const maxZ = courtLength / 2 - playerMargin;
        this.mesh.position.x = Math.max(minX, Math.min(maxX, this.mesh.position.x));
        this.mesh.position.z = Math.max(minZ, Math.min(maxZ, this.mesh.position.z));

        this.direction.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }

    getPosition() { return this.mesh.position; }
    getDirection() { return this.direction; }
    getRotation() { return this.mesh.rotation.y; }
}

export function createPlayer() {
    return new Player();
}

export function setupPlayerControls(player, ball, hoops) {
    const keysPressed = {};
    const shootingSystem = new ShootingSystem();

    const handleKeyDown = (event) => {
        const key = event.key.toLowerCase();
        keysPressed[key] = true;
        if (key === ' ' && ball.isHeld && !shootingSystem.isAimAssisted && !player.isAnimatingAction) {
            shootingSystem.increasePower();
            event.preventDefault();
        }
        if (key === 'f' && !ball.isHeld) {
            const distance = player.mesh.position.distanceTo(ball.mesh.position);
            if (distance < 2) {
                ball.pickUp(player.mesh);
                if (ball.isHeld) { shootingSystem.showTrajectory(ball); }
            }
        }
        if (key === 'shift' && event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
            player.jump();
            event.preventDefault();
        }
    };

    const handleKeyUp = (event) => {
        const key = event.key.toLowerCase();
        keysPressed[key] = false;
        if (key === 'x' && ball.isHeld) {
            shootingSystem.performAutoShot(ball, hoops);
        }
    };

    const handleMouseDown = (event) => {
        if (event.button === 0 && ball.isHeld && !player.isAnimatingAction) { // Sol Tıklama
            const canShoot = shootingSystem.isAimAssisted || shootingSystem.throwPower > 0;

            if (canShoot) {
                player.playAnimationOnce('shoot');

                // GÜNCELLENDİ: Bekleme süresi daha gerçekçi bir değere düşürüldü.
                const releaseTime = 450;
                setTimeout(() => {
                    if (ball.isHeld) {
                        shootingSystem.releaseCharge(ball);
                    }
                }, releaseTime);
            } else {
                console.log("Atış için yeterli güç yok veya otomatik nişan aktif değil.");
            }
        }
    };

    const handleBeforeUnload = () => {
        shootingSystem.dispose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const updateFunction = function updatePlayerMovement(deltaTime) {
        player.move(keysPressed, deltaTime);
        if (ball.isHeld) {
            if (!shootingSystem.isAimAssisted && !player.isAnimatingAction) {
                if (keysPressed['q']) { shootingSystem.adjustAngle(-shootingSystem.angleChangeSpeed); }
                if (keysPressed['e']) { shootingSystem.adjustAngle(shootingSystem.angleChangeSpeed); }
            }
            shootingSystem.update(ball);
        } else {
            shootingSystem.hideTrajectory();
        }
    };

    const cleanupFunction = () => {
        console.log("Player controls ve shooting system listener'ları (player.js) kaldırılıyor...");
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handleMouseDown);
        shootingSystem.dispose();
    };

    return {
        update: updateFunction,
        cleanup: cleanupFunction
    };
}