// Add to script.js
function drawPolarReticle() {
    const canvas = document.getElementById('polar-reticle');
    if (!canvas || !canvas.getContext) {
        console.error('Canvas not found or unsupported.');
        return;
    }
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw concentric circles (36°, 40°, 44° from NCP)
    const degreeToRadius = (deg) => (deg / 44) * radius;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 0.5;
    [36, 40, 44].forEach(deg => {
        const r = degreeToRadius(deg);
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
        ctx.stroke();

        // Label degrees
        ctx.font = '8px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg}°`, centerX + r + 10, centerY);
    });

    // Draw hour markings (0-12)
    ctx.font = '10px Arial';
    ctx.fillStyle = '#ff0000';
    for (let hour = 0; hour < 12; hour++) {
        const angle = (hour * 30 - 90) * Math.PI / 180;
        const x = centerX + (radius + 5) * Math.cos(angle);
        const y = centerY + (radius + 5) * Math.sin(angle);
        ctx.fillText(hour.toString(), x, y);
    });

    // Polaris position (using app's LST: 19.638 hours)
    const lst = 19.638;
    const positionAngle = lst * 15;
    const polarisOffsetDeg = 0.74;
    const polarisRadius = degreeToRadius(polarisOffsetDeg);
    const polarisAngle = (positionAngle - 90) * Math.PI / 180;
    const polarisX = centerX + polarisRadius * Math.cos(polarisAngle);
    const polarisY = centerY + polarisRadius * Math.sin(polarisAngle);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('*', polarisX, polarisY);

    // Draw crosshair at NCP (center)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();
}

// Add to getLocation() calls
// Inside getLocation(), after status updates:
drawPolarReticle();

// At the end of script.js:
document.addEventListener('DOMContentLoaded', () => {
    drawPolarReticle();
});
