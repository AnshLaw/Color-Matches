const socket = io();

window.onload = function() {
    const canvas = document.getElementById('colorWheel');
    const ctx = canvas.getContext('2d');
    const colorCode = document.getElementById('colorCode');
    const boundingCircle = document.getElementById('boundingCircle');
    const matchButton = document.getElementById('matchButton');
    const matchResult = document.getElementById('matchResult');
    const overlay = document.getElementById('overlay');
    const nameInput = document.getElementById('nameInput');
    const nameSubmitButton = document.getElementById('nameSubmitButton');
    const profileName = document.getElementById('profileName');
    const profile = document.getElementById('profile');
    const chatContainer = document.getElementById('chat-container');
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    const width = canvas.width;
    const height = canvas.height;

    let fixedPosition = null;
    let selectedColor = null;
    let userName = '';

    nameSubmitButton.addEventListener('click', function() {
        userName = nameInput.value.trim();
        if (userName) {
            profileName.textContent = userName;
            overlay.style.display = 'none';
            profile.style.display = 'flex';
        }
    });

    // Create an off-screen canvas for the color wheel
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    function drawColorWheel(ctx) {
        const radius = width / 2;
        const cx = radius;
        const cy = radius;

        const image = ctx.createImageData(width, height);
        const data = image.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius) {
                    const angle = Math.atan2(dy, dx);
                    const hue = (angle * 180 / Math.PI + 360) % 360;
                    const saturation = distance / radius;
                    const [r, g, b] = hsvToRgb(hue, saturation, 1);

                    const index = (y * width + x) * 4;
                    data[index] = r;
                    data[index + 1] = g;
                    data[index + 2] = b;
                    data[index + 3] = 255; // alpha
                }
            }
        }

        ctx.putImageData(image, 0, 0);
    }

    function applyBlurEffect() {
        // Draw the color wheel to the off-screen canvas
        drawColorWheel(offscreenCtx);

        // Apply the blur filter to the off-screen canvas
        ctx.filter = 'blur(8px)'; // Adjust the blur radius as needed
        ctx.drawImage(offscreenCanvas, 0, 0);

        // Reset the filter to avoid blurring other drawings
        ctx.filter = 'none';
    }

    function hsvToRgb(h, s, v) {
        let r, g, b;

        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i) {
            case 0:
                r = v, g = t, b = p;
                break;
            case 1:
                r = q, g = v, b = p;
                break;
            case 2:
                r = p, g = v, b = t;
                break;
            case 3:
                r = p, g = q, b = v;
                break;
            case 4:
                r = t, g = p, b = v;
                break;
            default:
                r = v, g = p, b = q;
        }

        return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
    }

    function updateColorCode(x, y) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        colorCode.textContent = `R: ${r} G: ${g} B: ${b}`;
        selectedColor = { r, g, b, x, y, userName };
    }

    applyBlurEffect();

    canvas.addEventListener('mousemove', function(event) {
        if (fixedPosition) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        updateColorCode(x, y);

        boundingCircle.style.left = `${event.clientX}px`;
        boundingCircle.style.top = `${event.clientY}px`;
        boundingCircle.style.display = 'flex';
        boundingCircle.textContent = '😳';
    });

    canvas.addEventListener('click', function(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        fixedPosition = { x, y };

        updateColorCode(x, y);

        boundingCircle.style.left = `${event.clientX}px`;
        boundingCircle.style.top = `${event.clientY}px`;
        boundingCircle.style.display = 'flex';
        boundingCircle.textContent = '😊';
        boundingCircle.classList.add('clicked');
    });

    matchButton.addEventListener('click', function() {
        // Save the selected color when the match button is pressed
        if (selectedColor) {
            socket.emit('selectColor', selectedColor);
            selectedColor = null; // Clear selected color to prevent changes after match is pressed
        }
        socket.emit('match');
    });

    socket.on('matchResult', function(result) {
        matchResult.textContent = result;
        if (result.startsWith('Matched')) {
            chatContainer.classList.remove('hidden');
        }
    });

    sendButton.addEventListener('click', function() {
        const message = messageInput.value;
        if (message.trim()) {
            const messageElement = document.createElement('div');
            messageElement.textContent = `You: ${message}`;
            chatWindow.appendChild(messageElement);
            messageInput.value = '';
            chatWindow.scrollTop = chatWindow.scrollHeight;

            // Send the message to the server
            socket.emit('chatMessage', message);
        }
    });

    socket.on('chatMessage', function(message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chatWindow.appendChild(messageElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
}
