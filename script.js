let targetAltitude = 37; // Default to 37° if location unavailable
let targetLongitude = 0; // Default longitude for declination
let azimuthOffset = 0;   // Calibration offset for azimuth (compass North)
let altitudeOffset = 0;  // Calibration offset for altitude
let isCalibrated = false;
let sensorsEnabled = false; // Track sensor permission state
let compassSamples = [];    // Store compass readings for averaging

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
    if (longitude > -30 && longitude < 30) return 0; // Near Greenwich, ~0°
    if (longitude >= 30 && longitude < 90) return 5; // Eastern Europe/Asia, ~5°E
    if (longitude >= 90 && longitude < 180) return 10; // Far East, ~10°E
    if (longitude <= -30 && longitude > -90) return -10; // Eastern US, ~10°W
    if (longitude <= -90 && longitude > -180) return -15; // Western US, ~15°W
    return 0; // Default if longitude unavailable
}

// Calculate Local Sidereal Time (LST) for given date and longitude
function calculateLST(date, longitude) {
    // Convert to Julian Date
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();

    // Julian Date calculation
    let JD = 2451544.5; // J2000
    JD += (Date.UTC(year, month - 1, day, hours, minutes, seconds) - Date.UTC(2000, 0, 1, 12, 0, 0)) / (1000 * 60 * 60 * 24);
    
    // GMST calculation
    const T = (JD - 2451545.0) / 36525;
    let GMST = 6.697374558 + 2400.051336 * T + 0.000025862 * T * T;
    GMST = GMST % 24;
    GMST += (hours + minutes / 60 + seconds / 3600) * 1.00273790935;

    // Adjust for longitude (degrees to hours)
    GMST = (GMST + (longitude / 15)) % 24;
    if (GMST < 0) GMST += 24;

    return GMST;
}

// Draw polar reticle based on location and time
function drawPolarReticle() {
    const canvas = document.getElementById('polar-reticle');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20; // Leave padding

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw concentric circles (36°, 40°, 44° from NCP)
    const degreeToRadius = (deg) => (deg / 44) * radius; // Scale degrees to canvas radius (44° = max)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    [36, 40, 44].forEach(deg => {
        const r = degreeToRadius(deg);
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
        ctx.stroke();

        // Label degrees
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg}°`, centerX + r + 20, centerY);
    });

    // Draw hour markings (0-12)
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ff0000';
    for (let hour = 0; hour < 12; hour++) {
        const angle = (hour * 30 - 90) * Math.PI / 180; // 30° per hour, 0 at top
        const x = centerX + (radius + 10) * Math.cos(angle);
        const y = centerY + (radius + 10) * Math.sin(angle);
        ctx.fillText(hour.toString(), x, y);
    }

    // Calculate LST for Polaris position
    const date = new Date('2025-03-01T17:02:45Z'); // From your image (UTC)
    const lst = calculateLST(date, targetLongitude);
    const positionAngle = lst * 15; // LST in degrees (1 hour = 15°)

    // Draw crosshair at NCP (center)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    // Draw Polaris (*) at offset (0.74° from NCP)
    const polarisOffsetDeg = 0.74; // Polaris distance from NCP (2025)
    const polarisRadius = degreeToRadius(polarisOffsetDeg);
    const polarisAngle = (positionAngle - 90) * Math.PI / 180; // Align with LST
    const polarisX = centerX + polarisRadius * Math.cos(polarisAngle);
    const polarisY = centerY + polarisRadius * Math.sin(polarisAngle);
    ctx.font = '20px Arial';
    ctx.fillStyle = '#ffcc00'; // Yellow for Polaris
    ctx.fillText('*', polarisX, polarisY);
}

// Calibration function (averages compass readings)
function calibrate() {
    if (!sensorsEnabled && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    sensorsEnabled = true;
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('status').textContent =
                        'Status: Sensors enabled. Point phone North and hold steady to calibrate.';
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
        return;
    }

    // Start compass sampling
    if (!isCalibrated) {
        compassSamples = [];
        document.getElementById('status').textContent =
            'Status: Calibrating compass... Hold phone steady facing North for 1 second.';
        
        const collectSamples = (event) => {
            if (event.alpha !== null && event.beta !== null) {
                const compassHeading = event.webkitCompassHeading !== undefined ? event.webkitCompassHeading : event.alpha;
                compassSamples.push(compassHeading);
                compassSamples.push(event.beta);
            }
        };

        window.addEventListener('deviceorientation', collectSamples);

        // Stop sampling after 1 second and average
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
                    'Status: Calibrated! Point phone North, then align your telescope.';
                getLocation();
                const declination = getMagneticDeclination(targetLongitude);
                azimuthOffset += declination; // Adjust for true North
                handleOrientation(latestOrientation || { alpha: azimuthOffset, beta: altitudeOffset });
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

// Handle device orientation (unchanged)
function handleOrientation(event) {
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

// Setup event listeners (no initial permission request)
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
} else {
    window.addEventListener('deviceorientation', handleOrientation);
    document.getElementById('calibrate-btn').addEventListener('click', calibrate);
}

// Draw reticle on load with default values
drawPolarReticle();
