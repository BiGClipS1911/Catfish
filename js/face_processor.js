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
            this.originalImage.crossOrigin = 'anonymous';
            this.originalImage.onload = () => {
                this.isLoaded = true;
                this.processFace();
                resolve();
            };
            this.originalImage.onerror = () => {
                this.createFallbackFace();
                this.isLoaded = true;
                resolve();
            };
            this.originalImage.src = src;
        });
    }

    createFallbackFace() {
        const size = 320;
        this.faceCanvas.width = size;
        this.faceCanvas.height = size;
        const ctx = this.faceCtx;
        
        ctx.fillStyle = '#e8b896';
        ctx.beginPath();
        ctx.ellipse(size / 2, size / 2, size * 0.38, size * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#222';
        ctx.fillRect(size * 0.3, size * 0.4, size * 0.15, size * 0.1);
        ctx.fillRect(size * 0.55, size * 0.4, size * 0.15, size * 0.1);

        ctx.fillStyle = '#943838';
        ctx.beginPath();
        ctx.arc(size / 2, size * 0.65, size * 0.15, 0, Math.PI);
        ctx.fill();
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
