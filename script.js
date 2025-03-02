let targetAltitude = 37; // Default to 37° if location unavailable
let targetLongitude = 0; // Default longitude for declination
let azimuthOffset = 0;   // Calibration offset for azimuth
let altitudeOffset = 0;  // Calibration offset for altitude
let isCalibrated = false;
let sensorsEnabled = false;
let compassSamples = [];
let latestOrientation = null;

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const latitude = position.coords.latitude;
                targetLongitude = position.coords.longitude;
                targetAltitude = Math.abs(latitude); // Use absolute value for simplicity
                document.getElementById('instructions').textContent =
                    `Place your phone flat on the telescope. (Latitude: ${latitude.toFixed(2)}°)`;
                document.getElementById('status').textContent =
                    `Status: Location set to ${latitude.toFixed(2)}°, ${targetLongitude.toFixed(2)}°.`;
            },
            error => {
                document.getElementById('status').textContent =
                    'Status: Location unavailable. Using default 37°.';
            }
        );
    }
}

function getMagneticDeclination(longitude) {
    if (longitude <= -90 && longitude > -180) return -15; // Western US, ~15°W
    return 0; // Simplified for now
}

function showCalibrationConfirm() {
    const confirmOverlay = document.getElementById('calibration-confirm');
    confirmOverlay.style.display = 'block';
    setTimeout(() => confirmOverlay.style.display = 'none', 2000);
}

function calibrate() {
    if (!sensorsEnabled && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    sensorsEnabled = true;
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('status').textContent =
                        'Status: Sensors enabled. Point phone North to calibrate.';
                } else {
                    document.getElementById('status').textContent =
                        'Status: Sensor permission denied.';
                }
            })
            .catch(error => {
                document.getElementById('status').textContent =
                    'Status: Error enabling sensors.';
            });
        return;
    }

    if (!isCalibrated) {
        compassSamples = [];
        document.getElementById('status').textContent =
            'Status: Calibrating... Hold steady facing North.';
        
        const collectSamples = (event) => {
            if (event.alpha !== null && event.beta !== null) {
                const compassHeading = event.webkitCompassHeading || event.alpha;
                compassSamples.push(compassHeading, event.beta);
            }
        };

        window.addEventListener('deviceorientation', collectSamples);
        setTimeout(() => {
            window.removeEventListener('deviceorientation', collectSamples);
            if (compassSamples.length >= 2) {
                const alphaSamples = compassSamples.filter((_, i) => i % 2 === 0);
                const betaSamples = compassSamples.filter((_, i) => i % 2 === 1);
                azimuthOffset = alphaSamples.reduce((sum, val) => sum + val, 0) / alphaSamples.length;
                altitudeOffset = betaSamples.reduce((sum, val) => sum + val, 0) / betaSamples.length;
                isCalibrated = true;
                showCalibrationConfirm();
                document.getElementById('status').textContent =
                    'Status: Calibrated! Align your telescope.';
                getLocation();
                azimuthOffset += getMagneticDeclination(targetLongitude);
                handleOrientation(latestOrientation || { alpha: azimuthOffset, beta: altitudeOffset });
            }
        }, 1000);
    }
}

function handleOrientation(event) {
    latestOrientation = event;
    const alpha = event.alpha;
    const beta = event.beta;

    if (alpha === null || beta === null) return;

    let azimuth = isCalibrated ? alpha - azimuthOffset : alpha;
    if (azimuth > 180) azimuth -= 360;
    if (azimuth < -180) azimuth += 360;
    let altitude = isCalibrated ? beta - altitudeOffset : beta;
    const altitudeRemaining = Math.abs(altitude - targetAltitude);

    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(1)}°`;
    document.getElementById('altitude').textContent = `Altitude remaining: ${altitudeRemaining.toFixed(1)}°`;

    if (isCalibrated) {
        const reticle = document.getElementById('reticle');
        const targetCrosshair = document.getElementById('target-crosshair');
        const xOffset = Math.min(70, Math.max(-70, azimuth * 2));
        const yOffset = Math.min(70, Math.max(-70, (altitude - targetAltitude) * 3));
        targetCrosshair.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        reticle.style.transform = (Math.abs(azimuth) <= 3 && altitudeRemaining <= 3) ? 'scale(5)' : 'scale(1)';
        document.getElementById('status').textContent =
            (Math.abs(azimuth) < 5 && altitudeRemaining < 5) ? 'Status: Aligned!' : 'Status: Adjust telescope.';
    }
}

if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
} else {
    window.addEventListener('deviceorientation', handleOrientation);
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
}


function drawPolarReticle() {
    const canvas = document.getElementById('polar-reticle');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
    document.addEventListener('DOMContentLoaded', drawPolarReticle);
} else {
    window.addEventListener('deviceorientation', handleOrientation);
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
    document.addEventListener('DOMContentLoaded', drawPolarReticle);
}
