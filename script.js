let targetAltitude = 90; // Default until location is fetched

// Request geolocation permission and set target altitude
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const latitude = position.coords.latitude;
                // For Northern Hemisphere, Polaris altitude ≈ latitude
                // For Southern Hemisphere, we'll need a different target (e.g., Sigma Octantis)
                if (latitude >= 0) {
                    targetAltitude = latitude; // Northern Hemisphere
                } else {
                    targetAltitude = -latitude; // Southern Hemisphere (placeholder, refine later)
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

// Handle device orientation
function handleOrientation(event) {
    const alpha = event.alpha; // Compass direction (0° = North)
    const beta = event.beta;   // Front-back tilt (-90° to 90°)
    const gamma = event.gamma; // Left-right tilt (-90° to 90°)

    // Assuming phone is flat on telescope, facing up
    let altitude = beta;
    let azimuth = alpha;

    // Display current orientation
    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(1)}°`;
    document.getElementById('altitude').textContent = `Altitude: ${altitude.toFixed(1)}°`;

    // Alignment logic based on location
    let status = '';
    const azimuthTolerance = 5; // Degrees
    const altitudeTolerance = 5; // Degrees
    if (Math.abs(azimuth) < azimuthTolerance && Math.abs(altitude - targetAltitude) < altitudeTolerance) {
        status = `Aligned! Pointing near ${(targetAltitude > 0) ? 'Polaris' : 'Southern pole'}.`;
    } else {
        status = 'Adjust telescope: ';
        if (azimuth > azimuthTolerance) status += 'Turn left ';
        if (azimuth < -azimuthTolerance) status += 'Turn right ';
        if (altitude < targetAltitude - altitudeTolerance) status += 'Tilt up ';
        if (altitude > targetAltitude + altitudeTolerance) status += 'Tilt down ';
    }
    document.getElementById('status').textContent = `Status: ${status}`;
}

// Request sensor permission for iOS
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', function() {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    getLocation(); // Fetch location after sensor permission
                } else {
                    alert('Sensor permission denied.');
                }
            })
            .catch(console.error);
    }, { once: true });
} else {
    // Non-iOS: Add orientation listener and get location immediately
    window.addEventListener('deviceorientation', handleOrientation);
    getLocation();
}
