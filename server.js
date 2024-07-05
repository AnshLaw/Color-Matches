const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

// Use the environment variable for MongoDB connection string
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the application if the connection fails
  });

const userSchema = new mongoose.Schema({
  id: String,
  userName: String,
  r: Number,
  g: Number,
  b: Number,
  x: Number,
  y: Number,
  matchedWith: String
});

const User = mongoose.model('User', userSchema);

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('selectColor', async (color) => {
        try {
            let user = await User.findOne({ id: socket.id });
            if (user) {
                user.r = color.r;
                user.g = color.g;
                user.b = color.b;
                user.x = color.x;
                user.y = color.y;
                user.userName = color.userName;
            } else {
                user = new User({ ...color, id: socket.id });
            }
            await user.save();
            socket.color = color;
            console.log('Color selected:', color);
        } catch (err) {
            console.error('Error selecting color:', err);
        }
    });

    socket.on('match', async () => {
        try {
            const user = await User.findOne({ id: socket.id });
            if (!user) return;

            if (user.matchedWith) {
                const partner = await User.findOne({ id: user.matchedWith });
                if (partner) {
                    partner.matchedWith = null;
                    await partner.save();
                }
                user.matchedWith = null;
                await user.save();
            }

            const users = await User.find({ matchedWith: null, id: { $ne: socket.id } });
            if (users.length < 1) {
                io.to(socket.id).emit('matchResult', 'No match found. Waiting for another user.');
                return;
            }

            let closestUser = null;
            let shortestDistance = Infinity;

            for (const potentialMatch of users) {
                const distance = calculateDistance(user, potentialMatch);
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    closestUser = potentialMatch;
                }
            }

            if (closestUser) {
                user.matchedWith = closestUser.id;
                closestUser.matchedWith = user.id;
                await user.save();
                await closestUser.save();
                io.to(socket.id).emit('matchResult', `Matched with ${closestUser.userName} at R${closestUser.r}, G${closestUser.g}, B${closestUser.b}`);
                io.to(closestUser.id).emit('matchResult', `Matched with ${user.userName} at R${user.r}, G${user.g}, B${user.b}`);

                // Notify both users to open the chat
                io.to(socket.id).emit('openChat');
                io.to(closestUser.id).emit('openChat');
            } else {
                io.to(socket.id).emit('matchResult', 'No match found.');
            }
        } catch (err) {
            console.error('Error during match:', err);
        }
    });

    socket.on('chatMessage', async (message) => {
        try {
            const user = await User.findOne({ id: socket.id });
            if (user && user.matchedWith) {
                io.to(user.matchedWith).emit('chatMessage', `${user.userName}: ${message}`);
            }
        } catch (err) {
            console.error('Error sending chat message:', err);
        }
    });

    socket.on('disconnect', async () => {
        try {
            const user = await User.findOneAndDelete({ id: socket.id });
            if (user && user.matchedWith) {
                const partner = await User.findOne({ id: user.matchedWith });
                if (partner) {
                    partner.matchedWith = null;
                    await partner.save();
                }
            }
            console.log('Client disconnected');
        } catch (err) {
            console.error('Error during disconnect:', err);
        }
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
