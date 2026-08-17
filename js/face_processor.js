/**
 * FaceProcessor
 * Processes the user's face image into game sprites and provides
 * dynamic genetic image fusion to merge two parent face images into an offspring face!
 */

class FaceProcessor {
    constructor(imageSrc = 'seaman_face.png') {
        this.originalImage = new Image();
        this.isLoaded = false;
        this.imageSrc = imageSrc;
        
        // Default crop and transform settings
        this.config = {
            centerX: 0.50,
            centerY: 0.45,
            radiusX: 0.38,
            radiusY: 0.44,
            feather: 0.25,
            rotation: 0.0,
            brightness: 1.05,
            contrast: 1.05
        };

        this.faceCanvas = document.createElement('canvas');
        this.faceCtx = this.faceCanvas.getContext('2d');
        
        this.mouthCanvas = document.createElement('canvas');
        this.mouthCtx = this.mouthCanvas.getContext('2d');
    }

    async init(src = this.imageSrc) {
        return new Promise((resolve) => {
            let resolved = false;
            const safeResolve = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            // 500ms Safety Timeout Guarantee (prevents hanging in file:// or CORS restricted modes)
            const timeoutId = setTimeout(() => {
                this.createFallbackFace();
                this.isLoaded = true;
                safeResolve();
            }, 500);

            try {
                if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                    this.originalImage.crossOrigin = 'anonymous';
                }

                this.originalImage.onload = () => {
                    clearTimeout(timeoutId);
                    this.isLoaded = true;
                    try {
                        this.processFace();
                    } catch (e) {
                        console.warn('CORS / Canvas error during face processing, using fallback face:', e);
                        this.createFallbackFace();
                    }
                    safeResolve();
                };

                this.originalImage.onerror = () => {
                    clearTimeout(timeoutId);
                    this.createFallbackFace();
                    this.isLoaded = true;
                    safeResolve();
                };

                this.originalImage.src = src;
            } catch (err) {
                clearTimeout(timeoutId);
                this.createFallbackFace();
                this.isLoaded = true;
                safeResolve();
            }
        });
    }

    createFallbackFace(skinTone = '#f0c6a5', eyeColor = '#2e86de') {
        const size = 320;
        this.faceCanvas.width = size;
        this.faceCanvas.height = size;
        const ctx = this.faceCtx;
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;

        // 1. Shaded Face Base Oval
        const grad = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.42);
        grad.addColorStop(0, '#f8d7be');
        grad.addColorStop(0.7, skinTone);
        grad.addColorStop(1, '#c89574');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.38, size * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face outline
        ctx.strokeStyle = 'rgba(100, 50, 30, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 2. Eyebrows
        ctx.strokeStyle = '#331a00';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.26, cy - size * 0.14);
        ctx.quadraticCurveTo(cx - size * 0.15, cy - size * 0.19, cx - size * 0.05, cy - size * 0.14);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + size * 0.05, cy - size * 0.14);
        ctx.quadraticCurveTo(cx + size * 0.15, cy - size * 0.19, cx + size * 0.26, cy - size * 0.14);
        ctx.stroke();

        // 3. Eyes (Sclera + Iris + Pupil + Highlight)
        const eyeY = cy - size * 0.05;
        const leftEyeX = cx - size * 0.16;
        const rightEyeX = cx + size * 0.16;
        const eyeR = size * 0.08;

        [leftEyeX, rightEyeX].forEach(eyeX => {
            // Sclera (White)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(eyeX, eyeY, eyeR * 1.2, eyeR * 0.9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#663300';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Iris
            ctx.fillStyle = eyeColor;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, eyeR * 0.65, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, eyeR * 0.35, 0, Math.PI * 2);
            ctx.fill();

            // Catchlight reflection dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeX - eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.18, 0, Math.PI * 2);
            ctx.fill();
        });

        // 4. Nose Bridge & Nostrils
        ctx.strokeStyle = 'rgba(120, 60, 30, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.05);
        ctx.lineTo(cx - size * 0.04, cy + size * 0.1);
        ctx.lineTo(cx + size * 0.04, cy + size * 0.1);
        ctx.stroke();

        // 5. Expressive Lips / Mouth
        ctx.fillStyle = '#c05c5c';
        ctx.beginPath();
        ctx.ellipse(cx, cy + size * 0.22, size * 0.12, size * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#802626';
        ctx.lineWidth = 2;
        ctx.stroke();

        this.isLoaded = true;
    }

    processFace() {
        if (!this.isLoaded || !this.originalImage.width) return;

        const imgW = this.originalImage.width;
        const imgH = this.originalImage.height;
        const size = 320;

        this.faceCanvas.width = size;
        this.faceCanvas.height = size;
        const ctx = this.faceCtx;
        ctx.clearRect(0, 0, size, size);

        const centerX = size / 2;
        const centerY = size / 2;
        const rx = size * 0.42;
        const ry = size * 0.46;

        const grad = ctx.createRadialGradient(centerX, centerY, rx * (1 - this.config.feather), centerX, centerY, Math.max(rx, ry));
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.75, 'rgba(0,0,0,0.95)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.save();
        tempCtx.translate(centerX, centerY);
        tempCtx.rotate(this.config.rotation);
        
        const cropX = imgW * this.config.centerX;
        const cropY = imgH * this.config.centerY;
        const cropW = imgW * this.config.radiusX * 2;
        const cropH = imgH * this.config.radiusY * 2;

        tempCtx.drawImage(
            this.originalImage,
            cropX - cropW / 2, cropY - cropH / 2, cropW, cropH,
            -size / 2, -size / 2, size, size
        );
        tempCtx.restore();

        // Apply radial alpha mask
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.fillStyle = grad;
        tempCtx.beginPath();
        tempCtx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
        tempCtx.fill();

        ctx.drawImage(tempCanvas, 0, 0);
    }

    /**
     * GENETIC IMAGE FUSION: Merges two parent FaceProcessor photo instances into a crisp 50/50 offspring face!
     */
    static createOffspringFace(parentA, parentB, blendRatio = 0.5) {
        const size = 320;
        const offspring = new FaceProcessor();
        offspring.faceCanvas.width = size;
        offspring.faceCanvas.height = size;
        const oCtx = offspring.faceCtx;

        const ctxA = parentA.faceCanvas.getContext('2d');
        const ctxB = parentB.faceCanvas.getContext('2d');

        const imgDataA = ctxA.getImageData(0, 0, size, size);
        const imgDataB = ctxB.getImageData(0, 0, size, size);
        const outData = oCtx.createImageData(size, size);

        const dataA = imgDataA.data;
        const dataB = imgDataB.data;
        const dataOut = outData.data;

        for (let i = 0; i < dataA.length; i += 4) {
            const alphaA = dataA[i + 3] / 255;
            const alphaB = dataB[i + 3] / 255;

            if (alphaA === 0 && alphaB === 0) continue;

            let r, g, b, a;
            if (alphaA > 0 && alphaB > 0) {
                // True 50/50 photo feature blend
                r = dataA[i] * (1 - blendRatio) + dataB[i] * blendRatio;
                g = dataA[i + 1] * (1 - blendRatio) + dataB[i + 1] * blendRatio;
                b = dataA[i + 2] * (1 - blendRatio) + dataB[i + 2] * blendRatio;
                a = Math.max(dataA[i + 3], dataB[i + 3]);
            } else if (alphaA > 0) {
                r = dataA[i]; g = dataA[i + 1]; b = dataA[i + 2]; a = dataA[i + 3];
            } else {
                r = dataB[i]; g = dataB[i + 1]; b = dataB[i + 2]; a = dataB[i + 3];
            }

            dataOut[i] = Math.round(r);
            dataOut[i + 1] = Math.round(g);
            dataOut[i + 2] = Math.round(b);
            dataOut[i + 3] = Math.round(a);
        }

        oCtx.putImageData(outData, 0, 0);
        offspring.isLoaded = true;
        offspring.previewUrl = offspring.faceCanvas.toDataURL();
        return offspring;
    }

    drawFace(ctx, x, y, radius, angle = 0, animState = {}) {
        if (!this.isLoaded) return;

        const size = radius * 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.drawImage(this.faceCanvas, -radius, -radius, size, size);

        // Optional cute baby cheek blush
        if (animState.isBaby) {
            ctx.fillStyle = 'rgba(255, 120, 150, 0.4)';
            ctx.beginPath();
            ctx.ellipse(-radius * 0.35, radius * 0.15, radius * 0.15, radius * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(radius * 0.35, radius * 0.15, radius * 0.15, radius * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mouth opening animation
        const talkAmount = animState.talkAmount || 0;
        if (talkAmount > 0.05) {
            const mouthYOffset = radius * 0.35;
            const mouthH = radius * 0.28 * talkAmount;
            
            ctx.fillStyle = '#1c0808';
            ctx.beginPath();
            ctx.ellipse(0, mouthYOffset, radius * 0.22, mouthH, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#8f2d3d';
            ctx.beginPath();
            ctx.ellipse(0, mouthYOffset + mouthH * 0.3, radius * 0.14, mouthH * 0.3, 0, 0, Math.PI);
            ctx.fill();
        }

        // Eyelid blinking animation
        const blinkAmount = animState.blinkAmount || 0;
        if (blinkAmount > 0.1) {
            ctx.fillStyle = 'rgba(215, 175, 150, 0.9)';
            ctx.beginPath();
            ctx.ellipse(-radius * 0.25, -radius * 0.1, radius * 0.18, radius * 0.12 * blinkAmount, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(radius * 0.22, -radius * 0.1, radius * 0.18, radius * 0.12 * blinkAmount, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

window.FaceProcessor = FaceProcessor;
