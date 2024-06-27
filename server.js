const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

let users = [];
let matches = {};

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('selectColor', (color) => {
        // Check if user already exists in the users list and update their color
        const existingUserIndex = users.findIndex(user => user.id === socket.id);
        if (existingUserIndex !== -1) {
            users[existingUserIndex] = { ...color, id: socket.id };
        } else {
            users.push({ ...color, id: socket.id });
        }
        socket.color = color;
        console.log('Color selected:', color);
    });

    socket.on('match', () => {
        // Break existing match if user is already matched
        if (matches[socket.id]) {
            const partnerId = matches[socket.id];
            delete matches[socket.id];
            delete matches[partnerId];
        }

        if (users.length < 2) {
            io.to(socket.id).emit('matchResult', 'No match found. Waiting for another user.');
            return;
        }

        let closestUser = null;
        let shortestDistance = Infinity;

        for (const user of users) {
            if (user.id !== socket.id && !matches[user.id]) {  // Ensure the user does not match with themselves or a matched user
                const distance = calculateDistance(socket.color, user);
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    closestUser = user;
                }
            }
        }

        if (closestUser) {
            io.to(socket.id).emit('matchResult', `Matched with ${closestUser.userName} at R: ${closestUser.r}, G: ${closestUser.g}, B: ${closestUser.b}`);
            io.to(closestUser.id).emit('matchResult', `Matched with ${socket.color.userName} at R: ${socket.color.r}, G: ${socket.color.g}, B: ${socket.color.b}`);
            matches[socket.id] = closestUser.id;
            matches[closestUser.id] = socket.id;
        } else {
            io.to(socket.id).emit('matchResult', 'No match found.');
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.id !== socket.id);
        const partnerId = matches[socket.id];
        if (partnerId) {
            delete matches[socket.id];
            delete matches[partnerId];
        }
        console.log('Client disconnected');
    });
});

function calculateDistance(color1, color2) {
    return Math.sqrt(
        Math.pow(color1.x - color2.x, 2) +
        Math.pow(color1.y - color2.y, 2)
    );
}

// Serve static files from the public directory
app.use(express.static('public'));

server.listen(port, () => console.log(`Listening on port ${port}`));
