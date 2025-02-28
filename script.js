let targetAltitude = 37; // Default to 37° if location unavailable
let azimuthOffset = 0;   // Calibration offset for azimuth
let altitudeOffset = 0;  // Calibration offset for altitude
let isCalibrated = false;

// Request geolocation permission and set target altitude
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const latitude = position.coords.latitude;
                if (latitude >= 0) {
                    targetAltitude = latitude; // Northern Hemisphere
                } else {
                    targetAltitude = -latitude; // Southern Hemisphere (placeholder)
                    document.getElementById('instructions').textContent +=
                        ' Note: Southern Hemisphere alignment needs refinement.';
                }
                document.getElementById('instructions').textContent =
                    `Place your phone flat on the telescope. (Latitude: ${latitude.toFixed(2)}°)`;
                document.getElementById('status').textContent =
                    `Status: Location set to ${latitude.toFixed(2)}°. Calibrate to proceed.`;
            },
            error => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Status: Location unavailable. ';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Permission denied. Using default 37°.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Position unavailable. Using default 37°.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Request timed out. Using default 37°.';
                        break;
                    default:
                        errorMessage += 'Unknown error. Using default 37°.';
                }
                document.getElementById('status').textContent = errorMessage;
                document.getElementById('instructions').textContent =
                    'Place your phone flat on the telescope. (Default: 37°)';
            }
        );
    } else {
        document.getElementById('status').textContent =
            'Status: Geolocation not supported. Using default 37°.';
        document.getElementById('instructions').textContent =
            'Place your phone flat on the telescope. (Default: 37°)';
    }
}

// Show calibration confirmation
function showCalibrationConfirm() {
    const confirmOverlay = document.getElementById('calibration-confirm');
    confirmOverlay.style.display = 'block';
    setTimeout(() => {
        confirmOverlay.style.display = 'none';
    }, 2000);
}

// Calibration function
function calibrate(event) {
    if (event && event.alpha !== null && event.beta !== null) {
        azimuthOffset = event.alpha;
        altitudeOffset = event.beta;
        isCalibrated = true;
        showCalibrationConfirm();
        document.getElementById('status').textContent =
            'Status: Calibrated! Now align your telescope.';
        document.getElementById('calibrate-btn').disabled = true;
    } else {
        document.getElementById('status').textContent =
            'Status: Calibration failed. No sensor data available.';
    }
}

// Handle device orientation
function handleOrientation(event) {
    const alpha = event.alpha; // Compass direction (0° = North)
    const beta = event.beta;   // Front-back tilt (-90° to 90°)
    const gamma = event.gamma; // Left-right tilt (-90° to 90°)

    if (alpha === null || beta === null) {
        document.getElementById('status').textContent = 'Status: No sensor data.';
        return;
    }

    // Apply calibration offsets
    let azimuth = alpha - azimuthOffset;
    let altitude = beta - altitudeOffset;

    // Normalize azimuth to -180° to 180°
    if (azimuth > 180) azimuth -= 360;
    if (azimuth < -180) azimuth += 360;

    // Update display
    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(1)}°`;
    document.getElementById('altitude').textContent = `Altitude: ${altitude.toFixed(1)}°`;

    // Alignment logic (only if calibrated)
    if (isCalibrated) {
        const azimuthTolerance = 5;
        const altitudeTolerance = 5;
        const maxOffset = 75; // Max pixels from center (half of reticle size)
        let status = '';
        const targetCrosshair = document.getElementById('target-crosshair');

        // Calculate position offsets based on error
        let azimuthError = azimuth; // Degrees deviation
        let altitudeError = altitude - targetAltitude;

        // Move target crosshair
        let xOffset = azimuthError * 2; // 2px per degree
        let yOffset = altitudeError * 2;

        // Cap offsets to stay within reticle
        xOffset = Math.max(-maxOffset, Math.min(maxOffset, xOffset));
        yOffset = Math.max(-maxOffset, Math.min(maxOffset, yOffset));

        targetCrosshair.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

        // Check alignment
        if (Math.abs(azimuth) < azimuthTolerance && Math.abs(altitude - targetAltitude) < altitudeTolerance) {
            status = `Aligned! Pointing near ${(targetAltitude > 0) ? 'Polaris' : 'Southern pole'}.`;
        } else {
            status = 'Adjust telescope: ';
            if (azimuth > azimuthTolerance) {
                status += 'Turn right ';
            }
            if (azimuth < -azimuthTolerance) {
                status += 'Turn left ';
            }
            if (altitude < targetAltitude - altitudeTolerance) {
                status += 'Tilt up ';
            }
            if (altitude > targetAltitude + altitudeTolerance) {
                status += 'Tilt down ';
            }
        }
        document.getElementById('status').textContent = `Status: ${status}`;
    }
}

// Setup event listeners
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', function() {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('calibrate-btn').addEventListener('click', () => {
                        window.addEventListener('deviceorientation', calibrate, { once: true });
                    });
                    getLocation();
                } else {
                    alert('Sensor permission denied.');
                }
            })
            .catch(console.error);
    }, { once: true });
} else {
    window.addEventListener('deviceorientation', handleOrientation);
    document.getElementById('calibrate-btn').addEventListener('click', () => {
        window.addEventListener('deviceorientation', calibrate, { once: true });
    });
    getLocation();
}
