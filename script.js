window.addEventListener('deviceorientation', handleOrientation);

function handleOrientation(event) {
    const alpha = event.alpha; // Compass direction (0° = North)
    const beta = event.beta;   // Front-back tilt (-90° to 90°)
    const gamma = event.gamma; // Left-right tilt (-90° to 90°)

    // Assuming phone is flat on telescope, facing up
    // beta ≈ altitude (tilt up/down), alpha ≈ azimuth (compass direction)
    let altitude = beta;
    let azimuth = alpha;

    // Adjust for Northern Hemisphere (Polaris ~ 90° altitude, 0° azimuth)
    document.getElementById('azimuth').textContent = `Azimuth: ${azimuth.toFixed(1)}°`;
    document.getElementById('altitude').textContent = `Altitude: ${altitude.toFixed(1)}°`;

    // Simple alignment logic (tweak as needed)
    let status = '';
    if (Math.abs(azimuth) < 5 && Math.abs(altitude - 90) < 5) {
        status = 'Aligned! Pointing near Polaris.';
    } else {
        status = 'Adjust telescope: ';
        if (azimuth > 5) status += 'Turn left ';
        if (azimuth < -5) status += 'Turn right ';
        if (altitude < 85) status += 'Tilt up ';
        if (altitude > 95) status += 'Tilt down ';
    }
    document.getElementById('status').textContent = `Status: ${status}`;
}

// Request permission for iOS devices
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', function() {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    alert('Permission denied. Cannot access sensors.');
                }
            })
            .catch(console.error);
    }, { once: true });
}
