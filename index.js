const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("f");
});

let timerOn = false;
let interval = null;
let secondsOnTimer = 25 * 60;
let sessionType = "Pomodoro";

let toggleTimer = (socket) => {
  timerOn = !timerOn;
  io.emit("timer-toggle", timerOn);
  timerOn
    ? (interval = setInterval(() => {
        console.log(--secondsOnTimer);
        io.emit("timer-tick", secondsOnTimer);
      }, 1000))
    : clearInterval(interval);
};

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("outie");
  });
  socket.on("toggle-button-press", () => {
    toggleTimer(socket);
  });
  socket.on("decrement-button-press", () => {});
  socket.on("increment-button-press", () => {});
  socket.on("session-type-switch", () => {});
});

server.listen(3001, () => {
  console.log("listening on *:3001");
});
