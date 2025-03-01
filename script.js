let targetAltitude = 37; // Default to 37° if location unavailable
let targetLongitude = 0; // Default longitude for declination
let azimuthOffset = 0;   // Calibration offset for azimuth (compass North)
let altitudeOffset = 0;  // Calibration offset for altitude
let isCalibrated = false;
let sensorsEnabled = false; // Track sensor permission state
let compassSamples = [];    // Store compass readings for averaging
let latestOrientation = null; // Store latest sensor data

// Request geolocation and update target altitude and longitude
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const latitude = position.coords.latitude;
                targetLongitude = position.coords.longitude; // Store longitude for declination
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
                    `Status: Location set to ${latitude.toFixed(2)}°, ${targetLongitude.toFixed(2)}°.`;
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

// Simple declination approximation based on longitude (2025 estimate)
function getMagneticDeclination(longitude) {
    if (longitude > -30 && longitude < 30) return 0; // Near Greenwich, ~0°
    if (longitude >= 30 && longitude < 90) return 5; // Eastern Europe/Asia, ~5°E
    if (longitude >= 90 && longitude < 180) return 10; // Far East, ~10°E
    if (longitude <= -30 && longitude > -90) return -10; // Eastern US, ~10°W
    if (longitude <= -90 && longitude > -180) return -15; // Western US, ~15°W
    return 0; // Default if longitude unavailable
}

// Show calibration confirmation
function showCalibrationConfirm() {
    const confirmOverlay = document.getElementById('calibration-confirm');
    if (confirmOverlay) {
        confirmOverlay.style.display = 'block';
        setTimeout(() => {
            confirmOverlay.style.display = 'none';
        }, 2000);
    } else {
        console.error('Calibration confirm overlay not found.');
    }
}

// Calibration function (averages compass readings)
function calibrate() {
    console.log('Calibrate button clicked. Sensors enabled:', sensorsEnabled);

    // Request permission if needed
    if (!sensorsEnabled && typeof DeviceOrientationEvent.requestPermission === 'function') {
        console.log('Requesting sensor permission...');
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                console.log('Permission response:', response);
                if (response === 'granted') {
                    sensorsEnabled = true;
                    console.log('Sensors enabled. Adding deviceorientation listener...');
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('status').textContent =
                        'Status: Sensors enabled. Point phone North and hold steady to calibrate.';
                    startCalibration();
                } else {
                    alert('Sensor permission denied. Please enable motion access in your browser settings and try again.');
                    document.getElementById('status').textContent =
                        'Status: Sensor permission denied. Please enable sensors and try again.';
                }
            })
            .catch(error => {
                console.error('Permission request error:', error);
                alert('Error enabling sensors. Please ensure motion access is enabled in your browser settings and try again.');
                document.getElementById('status').textContent =
                    'Status: Error enabling sensors. Please try again.';
            });
    } else {
        // For non-iOS or if sensors are already enabled
        console.log('No permission required or sensors already enabled. Starting calibration...');
        startCalibration();
    }
}

// Start the calibration process
function startCalibration() {
    console.log('Starting calibration...');
    if (!isCalibrated) {
        compassSamples = [];
        document.getElementById('status').textContent =
            'Status: Calibrating compass... Hold phone steady facing North for 1 second.';
        
        const collectSamples = (event) => {
            console.log('Collecting sample:', event);
            if (event.alpha !== null && event.beta !== null) {
                const compassHeading = event.webkitCompassHeading !== undefined ? event.webkitCompassHeading : event.alpha;
                compassSamples.push(compassHeading);
                compassSamples.push(event.beta);
                latestOrientation = event;
            }
        };

        window.addEventListener('deviceorientation', collectSamples);

        // Stop sampling after 1 second and average
        setTimeout(() => {
            console.log('Samples collected:', compassSamples);
            window.removeEventListener('deviceorientation', collectSamples);
            if (compassSamples.length >= 2) {
                const alphaSamples = compassSamples.filter((_, i) => i % 2 === 0);
                const betaSamples = compassSamples.filter((_, i) => i % 2 === 1);
                azimuthOffset = alphaSamples.reduce((sum, val) => sum + val, 0) / alphaSamples.length;
                altitudeOffset = betaSamples.reduce((sum, val) => sum + val, 0) / betaSamples.length;
                isCalibrated = true;
                showCalibrationConfirm();
                document.getElementById('status').textContent =
                    'Status: Calibrated! Point phone North, then align your telescope.';
                getLocation();
                const declination = getMagneticDeclination(targetLongitude);
                azimuthOffset += declination;
                if (latestOrientation) {
                    handleOrientation(latestOrientation);
                }
            } else {
                document.getElementById('status').textContent =
                    'Status: Not enough data. Hold steady and try again.';
            }
        }, 1000);
    } else {
        // Recalibrate with latest data
        if (latestOrientation && latestOrientation.alpha !== null && latestOrientation.beta !== null) {
            const compassHeading = latestOrientation.webkitCompassHeading !== undefined ? latestOrientation.webkitCompassHeading : latestOrientation.alpha;
            azimuthOffset = compassHeading + getMagneticDeclination(targetLongitude);
            altitudeOffset = latestOrientation.beta;
            showCalibrationConfirm();
            document.getElementById('status').textContent =
                'Status: Recalibrated! Point phone North, then align your telescope.';
            getLocation();
            handleOrientation(latestOrientation);
        }
    }
}

// Handle device orientation
function handleOrientation(event) {
    console.log('DeviceOrientation event:', event);
    latestOrientation = event;

    const alpha = event.alpha;
    const beta = event.beta;
    const gamma = event.gamma;

    if (alpha === null || beta === null) {
        document.getElementById('azimuth').textContent = 'Azimuth: --°';
        document.getElementById('altitude').textContent = 'Altitude remaining: --°';
        return;
    }

    let azimuth = isCalibrated ? alpha - azimuthOffset : alpha;
    if (azimuth > 180) azimuth -= 360;
    if (azimuth < -180) azimuth += 360;

    let altitude = isCalibrated ? beta - altitudeOffset : beta;

    const altitudeRemaining = Math.abs(altitude - targetAltitude);

    const zoomThreshold = 3;
    const precision = (Math.abs(azimuth) <= zoomThreshold && altitudeRemaining <= zoomThreshold) ? 2 : 1;

    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(precision)}°`;
    document.getElementById('altitude').textContent = `Altitude remaining: ${altitudeRemaining.toFixed(precision)}°`;

    if (isCalibrated) {
        const azimuthTolerance = 5;
        const altitudeTolerance = 5;
        const reticleSize = 150;
        const scaleFactor = (Math.abs(azimuth) <= zoomThreshold && altitudeRemaining <= zoomThreshold) ? 5 : 1;
        const maxOffsetBound = reticleSize / 2 - 10;
        const azScale = 2;
        const altScale = 3;
        let status = '';
        const targetCrosshair = document.getElementById('target-crosshair');
        const reticle = document.getElementById('reticle');

        let azimuthError = azimuth;
        let altitudeError = altitude - targetAltitude;

        let xOffset = azimuthError * azScale;
        let yOffset = altitudeError * altScale;

        const scaledMaxOffset = maxOffsetBound / scaleFactor;
        xOffset = Math.max(-scaledMaxOffset, Math.min(scaledMaxOffset, xOffset));
        yOffset = Math.max(-scaledMaxOffset, Math.min(scaledMaxOffset, yOffset));

        targetCrosshair.style.display = 'block';
        targetCrosshair.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

        if (Math.abs(azimuth) <= zoomThreshold && Math.abs(altitude - targetAltitude) <= zoomThreshold) {
            reticle.style.transform = 'scale(5)';
            reticle.classList.add('zoomed');
        } else {
            reticle.style.transform = 'scale(1)';
            reticle.classList.remove('zoomed');
        }

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
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    const calibrateBtn = document.getElementById('calibrate-btn');
    if (calibrateBtn) {
        calibrateBtn.addEventListener('click', calibrate);
    } else {
        console.error('Calibrate button not found.');
    }
});

// Initialize for non-iOS devices
if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
    console.log('No permission required, adding deviceorientation listener...');
    window.addEventListener('deviceorientation', handleOrientation);
}
