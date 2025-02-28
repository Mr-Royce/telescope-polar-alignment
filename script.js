let targetAltitude = 37; // Default to 37° if location unavailable
let azimuthOffset = 0;   // Calibration offset for azimuth
let altitudeOffset = 0;  // Calibration offset for altitude
let isCalibrated = false;
let latestOrientation = null; // Store latest sensor data

// Request geolocation and update target altitude
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
                    `Status: Location set to ${latitude.toFixed(2)}°.`;
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

// Calibration function (one-click with immediate action)
function calibrate() {
    if (latestOrientation && latestOrientation.alpha !== null && latestOrientation.beta !== null) {
        // Immediate calibration with latest data
        azimuthOffset = latestOrientation.alpha;
        altitudeOffset = latestOrientation.beta;
        isCalibrated = true;
        getLocation(); // Fetch location immediately
        showCalibrationConfirm();
        document.getElementById('status').textContent =
            'Status: Calibrated! Now align your telescope.';
    } else {
        document.getElementById('status').textContent =
            'Status: Enabling sensors... Move the phone to calibrate.';
        const waitForData = (event) => {
            if (event.alpha !== null && event.beta !== null) {
                azimuthOffset = event.alpha;
                altitudeOffset = event.beta;
                isCalibrated = true;
                getLocation(); // Fetch location immediately
                showCalibrationConfirm();
                document.getElementById('status').textContent =
                    'Status: Calibrated! Now align your telescope.';
                window.removeEventListener('deviceorientation', waitForData);
                // Force an immediate update
                handleOrientation(event);
            }
        };
        window.addEventListener('deviceorientation', waitForData, { once: true });
    }
}

// Handle device orientation
function handleOrientation(event) {
    latestOrientation = event; // Store latest event data

    const alpha = event.alpha; // Compass direction (0° = North)
    const beta = event.beta;   // Front-back tilt (-90° to 90°)
    const gamma = event.gamma; // Left-right tilt (-90° to 90°)

    if (alpha === null || beta === null) {
        document.getElementById('status').textContent = 'Status: No sensor data.';
        document.getElementById('azimuth').textContent = 'Azimuth: --°';
        document.getElementById('altitude').textContent = 'Altitude remaining: --°';
        return;
    }

    // Apply calibration offsets (only if calibrated)
    let azimuth = isCalibrated ? alpha - azimuthOffset : alpha;
    let altitude = isCalibrated ? beta - altitudeOffset : beta;

    // Normalize azimuth to -180° to 180°
    if (azimuth > 180) azimuth -= 360;
    if (azimuth < -180) azimuth += 360;

    // Calculate altitude countdown
    const altitudeRemaining = Math.abs(altitude - targetAltitude);

    // Determine precision based on zoom state
    const zoomThreshold = 3;
    const precision = (Math.abs(azimuth) <= zoomThreshold && altitudeRemaining <= zoomThreshold) ? 2 : 1;

    // Update display (altitude as countdown)
    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(precision)}°`;
    document.getElementById('altitude').textContent = `Altitude remaining: ${altitudeRemaining.toFixed(precision)}°`;

    // Alignment logic (only if calibrated)
    if (isCalibrated) {
        const azimuthTolerance = 5;
        const altitudeTolerance = 5;
        const reticleSize = 150; // Reticle width/height in pixels
        const scaleFactor = (Math.abs(azimuth) <= zoomThreshold && altitudeRemaining <= zoomThreshold) ? 5 : 1; // Your high zoom (e.g., 5x)
        const maxOffsetBound = reticleSize / 2 - 10; // Fixed max bound (65px)
        const azScale = 2;  // Pixels per degree for azimuth
        const altScale = 3; // Pixels per degree for altitude
        let status = '';
        const targetCrosshair = document.getElementById('target-crosshair');
        const reticle = document.getElementById('reticle');

        // Calculate position offsets based on error
        let azimuthError = azimuth; // Positive moves right, negative moves left
        let altitudeError = altitude - targetAltitude;

        // Move target crosshair with separate scaling
        let xOffset = azimuthError * azScale;
        let yOffset = altitudeError * altScale;

        // Cap offsets to stay within unscaled reticle bounds (65px), adjusted for zoom
        const scaledMaxOffset = maxOffsetBound / scaleFactor; // Adjust for zoom
        xOffset = Math.max(-scaledMaxOffset, Math.min(scaledMaxOffset, xOffset));
        yOffset = Math.max(-scaledMaxOffset, Math.min(scaledMaxOffset, yOffset));

        // Ensure target crosshair is visible and bounded
        targetCrosshair.style.display = 'block';
        targetCrosshair.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

        // Zoom logic: Scale reticle when within 3° on both axes
        if (Math.abs(azimuth) <= zoomThreshold && Math.abs(altitude - targetAltitude) <= zoomThreshold) {
            reticle.style.transform = 'scale(5)'; // Your high zoom (e.g., 5x)
            reticle.classList.add('zoomed'); // Apply thinner lines
        } else {
            reticle.style.transform = 'scale(1)';
            reticle.classList.remove('zoomed'); // Restore normal thickness
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
                    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
                } else {
                    alert('Sensor permission denied.');
                }
            })
            .catch(console.error);
    }, { once: true });
} else {
    window.addEventListener('deviceorientation', handleOrientation);
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
}
