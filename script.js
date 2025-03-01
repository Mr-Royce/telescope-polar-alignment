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
                drawPolarReticle(); // Update reticle with new location
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
                drawPolarReticle(); // Draw with default values
            }
        );
    } else {
        document.getElementById('status').textContent =
            'Status: Geolocation not supported. Using default 37°.';
        document.getElementById('instructions').textContent =
            'Place your phone flat on the telescope. (Default: 37°)';
        drawPolarReticle(); // Draw with default values
    }
}

// Simple declination approximation based on longitude (2025 estimate)
function getMagneticDeclination(longitude) {
    if (longitude > -30 && longitude < 30) return 0;
    if (longitude >= 30 && longitude < 90) return 5;
    if (longitude >= 90 && longitude < 180) return 10;
    if (longitude <= -30 && longitude > -90) return -10;
    if (longitude <= -90 && longitude > -180) return -15;
    return 0;
}

// Draw polar reticle based on location and time (simplified)
function drawPolarReticle() {
    console.log('Drawing polar reticle...');
    const canvas = document.getElementById('polar-reticle');
    if (!canvas) {
        console.error('Canvas element not found.');
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Failed to get 2D context for canvas.');
        return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw a simple circle to test rendering
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw concentric circles (36°, 40°, 44° from NCP)
    const degreeToRadius = (deg) => (deg / 44) * radius;
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
                    console.log('Sensors enabled. Waiting for deviceorientation event...');
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('status').textContent =
                        'Status: Sensors enabled. Point phone North and hold steady to calibrate.';
                    // Start calibration immediately
                    startCalibration();
                } else {
                    alert('Sensor permission denied.');
                    document.getElementById('status').textContent =
                        'Status: Sensor permission denied. Please enable sensors to proceed.';
                }
            })
            .catch(error => {
                console.error('Permission request error:', error);
                document.getElementById('status').textContent =
                    'Status: Error enabling sensors. Please try again.';
            });
    } else {
        // For non-iOS or if sensors are already enabled
        startCalibration();
    }
}

// Start the calibration process
function startCalibration() {
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
                // Retry after 5 seconds if no data
                setTimeout(() => {
                    if (!isCalibrated) {
                        document.getElementById('status').textContent =
                            'Status: Retrying calibration... Please move the phone.';
                        startCalibration();
                    }
                }, 5000);
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
    drawPolarReticle();
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
