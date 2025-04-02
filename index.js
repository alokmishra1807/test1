


import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));


const messageSchema = new mongoose.Schema({
    senderId: String,
    receiverId: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);


const users = {};


io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

   
    socket.on("join", (userId) => {
        users[userId] = socket.id;
        io.emit("updateUsers", Object.keys(users)); 
    });

   
    socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
        const newMessage = new Message({ senderId, receiverId, message });
        await newMessage.save();

        const receiverSocketId = users[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receiveMessage", { senderId, message });
        }
    });

 
    socket.on("disconnect", () => {
        console.log(`User Disconnected: ${socket.id}`);
        for (let userId in users) {
            if (users[userId] === socket.id) {
                delete users[userId];
                io.emit("updateUsers", Object.keys(users));
                break;
            }
        }
    });
});


app.get("/messages/:userId", async (req, res) => {
    const { userId } = req.params;
    const messages = await Message.find({
        $or: [{ senderId: userId }, { receiverId: userId }]
    });
    res.json(messages);
});

// Start Server
server.listen(PORT, () => console.log(`Server running on port ${PORT} `));
