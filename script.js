let targetAltitude = 37; // Default to 37° if location unavailable
let azimuthOffset = 0;   // Calibration offset for azimuth
let altitudeOffset = 0;  // Calibration offset for altitude
let isCalibrated = false;

// Request geolocation and update target altitude
function getLocation(callback) {
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
                    `Status: Location set to ${latitude.toFixed(2)}°.`;
                if (callback) callback(true);
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
                if (callback) callback(false);
            }
        );
    } else {
        document.getElementById('status').textContent =
            'Status: Geolocation not supported. Using default 37°.';
        document.getElementById('instructions').textContent =
            'Place your phone flat on the telescope. (Default: 37°)';
        if (callback) callback(false);
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

// Calibration function (fetches location if needed, then calibrates)
function calibrate(event) {
    if (event && event.alpha !== null && event.beta !== null) {
        if (targetAltitude === 37 && document.getElementById('instructions').textContent.includes('Default')) {
            getLocation((success) => {
                if (success) {
                    azimuthOffset = event.alpha;
                    altitudeOffset = event.beta;
                    isCalibrated = true;
                    showCalibrationConfirm();
                    document.getElementById('status').textContent =
                        'Status: Calibrated! Now align your telescope.';
                } else {
                    azimuthOffset = event.alpha;
                    altitudeOffset = event.beta;
                    isCalibrated = true;
                    showCalibrationConfirm();
                    document.getElementById('status').textContent =
                        'Status: Calibrated with default 37°! Now align your telescope.';
                }
            });
        } else {
            azimuthOffset = event.alpha;
            altitudeOffset = event.beta;
            isCalibrated = true;
            showCalibrationConfirm();
            document.getElementById('status').textContent =
                'Status: Calibrated! Now align your telescope.';
        }
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
        const zoomThreshold = 3; // Zoom when within 3°
        const maxOffset = 75;    // Max pixels from center
        const azScale = 2;       // Pixels per degree for azimuth (horizontal)
        const altScale = 3;      // Pixels per degree for altitude (vertical)
        let status = '';
        const targetCrosshair = document.getElementById('target-crosshair');
        const reticle = document.getElementById('reticle');

        // Calculate position offsets based on error
        let azimuthError = azimuth;
        let altitudeError = altitude - targetAltitude;

        // Move target crosshair with separate scaling
        let xOffset = azimuthError * azScale;   // Horizontal movement
        let yOffset = altitudeError * altScale; // Vertical movement

        // Cap offsets
        xOffset = Math.max(-maxOffset, Math.min(maxOffset, xOffset));
        yOffset = Math.max(-maxOffset, Math.min(maxOffset, yOffset));

        targetCrosshair.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

        // Zoom logic: Scale reticle when within 3° on both axes
        if (Math.abs(azimuth) <= zoomThreshold && Math.abs(altitude - targetAltitude) <= zoomThreshold) {
            reticle.style.transform = 'scale(1.5)';
        } else {
            reticle.style.transform = 'scale(1)';
        }

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
                    document.getElementById('location-btn').addEventListener('click', () => {
                        getLocation();
                    });
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
    document.getElementById('location-btn').addEventListener('click', () => {
        getLocation();
    });
}
