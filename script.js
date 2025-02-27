let targetAltitude = 90; // Default until location is fetched
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
            },
            error => {
                console.error('Geolocation error:', error);
                document.getElementById('status').textContent =
                    'Status: Location unavailable. Using default 90° altitude.';
            }
        );
    } else {
        document.getElementById('status').textContent =
            'Status: Geolocation not supported by your browser.';
    }
}

// Calibration function
function calibrate(event) {
    if (event && event.alpha !== null && event.beta !== null) {
        azimuthOffset = event.alpha;  // Set current azimuth as zero point
        altitudeOffset = event.beta;  // Set current altitude as zero point
        isCalibrated = true;
        document.getElementById('status').textContent =
            'Status: Calibrated! Now align your telescope.';
        document.getElementById('calibrate-btn').disabled = true; // Disable button after calibration
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

    // Apply calibration offsets
    let azimuth = alpha - azimuthOffset;
    let altitude = beta - altitudeOffset;

    // Normalize azimuth to stay within -180° to 180°
    if (azimuth > 180) azimuth -= 360;
    if (azimuth < -180) azimuth += 360;

    // Update display
    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(1)}°`;
    document.getElementById('altitude').textContent = `Altitude: ${altitude.toFixed(1)}°`;

    // Alignment logic (only if calibrated)
    if (isCalibrated) {
        const azimuthTolerance = 5;
        const altitudeTolerance = 5;
        let status = '';
        const arrows = {
            up: document.getElementById('arrow-up'),
            down: document.getElementById('arrow-down'),
            left: document.getElementById('arrow-left'),
            right: document.getElementById('arrow-right')
        };

        // Reset arrow visibility
        arrows.up.style.display = 'none';
        arrows.down.style.display = 'none';
        arrows.left.style.display = 'none';
        arrows.right.style.display = 'none';

        if (Math.abs(azimuth) < azimuthTolerance && Math.abs(altitude - targetAltitude) < altitudeTolerance) {
            status = `Aligned! Pointing near ${(targetAltitude > 0) ? 'Polaris' : 'Southern pole'}.`;
        } else {
            status = 'Adjust telescope: ';
            if (azimuth > azimuthTolerance) {
                status += 'Turn left ';
                arrows.left.style.display = 'block';
            }
            if (azimuth < -azimuthTolerance) {
                status += 'Turn right ';
                arrows.right.style.display = 'block';
            }
            if (altitude < targetAltitude - altitudeTolerance) {
                status += 'Tilt up ';
                arrows.up.style.display = 'block';
            }
            if (altitude > targetAltitude + altitudeTolerance) {
                status += 'Tilt down ';
                arrows.down.style.display = 'block';
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
