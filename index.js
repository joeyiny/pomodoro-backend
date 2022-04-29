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
let connectedUsers = 0;

let reset = (type) => {
  let minutesToCountdown;
  switch (type) {
    case "Pomodoro":
      minutesToCountdown = 25;
      break;
    case "Short Break":
      minutesToCountdown = 5;
      break;
    case "Long Break":
      minutesToCountdown = 15;
      break;
  }
  timerOn = false;
  secondsOnTimer = minutesToCountdown * 60;
  io.emit("timer-toggle", timerOn);
  io.emit("timer-tick", secondsOnTimer);
};

let setSessionType = (type) => {
  sessionType = type;
  reset(sessionType);
  io.emit("set-session-type", sessionType);
};

let decrement = () => {
  if (timerOn) return;
  if (secondsOnTimer >= 60) secondsOnTimer -= 60;
  else secondsOnTimer = 0;
  io.emit("timer-tick", secondsOnTimer);
};

let increment = () => {
  if (timerOn) return;
  secondsOnTimer += 60;
  io.emit("timer-tick", secondsOnTimer);
};

let toggleTimer = (socket) => {
  timerOn = !timerOn;
  io.emit("timer-toggle", timerOn);
  if (timerOn) {
    if (secondsOnTimer <= 0) {
      timerOn = false;
      io.emit("timer-toggle", timerOn);
      io.emit("timer-tick", secondsOnTimer);
      if (sessionType === "Pomodoro") {
        io.emit("completed-pomo");
        setSessionType("Short Break");
      } else {
        setSessionType("Pomodoro");
      }
      io.emit("timer-complete");
      clearInterval(interval);
      return;
    }
    interval = setInterval(() => {
      secondsOnTimer--;
      io.emit("timer-tick", secondsOnTimer);
    }, 1000);
    if (secondsOnTimer <= 0) {
      timerOn = false;
      io.emit("timer-toggle", timerOn);
      io.emit("timer-tick", secondsOnTimer);
      if (sessionType === "Pomodoro") {
        io.emit("completed-pomo");
        setSessionType("Short Break");
      } else {
        setSessionType("Pomodoro");
      }
      io.emit("timer-complete");
      clearInterval(interval);
      return;
    }
  } else clearInterval(interval);
};

io.on("connection", (socket) => {
  console.log("a user connected");
  connectedUsers++;
  io.emit("timer-toggle", timerOn);
  io.emit("timer-tick", secondsOnTimer);
  io.emit("set-session-type", sessionType);
  io.emit("connected-users", connectedUsers);
  socket.on("disconnect", () => {
    console.log("a user disconnected");
    connectedUsers--;
    io.emit("connected-users", connectedUsers);
  });
  socket.on("toggle-button-press", () => {
    toggleTimer(socket);
  });
  socket.on("decrement-button-press", () => {
    decrement();
  });
  socket.on("increment-button-press", () => {
    increment();
  });
  socket.on("session-type-switch", (data) => {
    setSessionType(data);
  });
});

server.listen(3001, () => {
  console.log("listening on *:3001");
});
