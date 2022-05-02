const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { v4: uuidV4 } = require("uuid");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("f");
});

enum SessionType {
  POMODORO = "Pomodoro",
  SHORTBREAK = "Short Break",
  LONGBREAK = "Long Break",
}

type User = {
  userName: string;
  roomCode: string;
};

interface Users {
  [key: string]: User;
}

type Room = {
  interval: NodeJS.Timer;
  timerOn: boolean;
  secondsOnTimer: number;
  sessionType: SessionType;
  connectedUsers: Users;
};

let rooms = <Array<Room>>{};
let allConnectedUsers: Users = {};

let reset = (roomCode: string, sessionType: SessionType) => {
  let minutesToCountdown: number;
  let room = rooms[roomCode];
  switch (room.sessionType) {
    case SessionType.POMODORO:
      minutesToCountdown = 25;
      break;
    case SessionType.SHORTBREAK:
      minutesToCountdown = 5;
      break;
    case SessionType.LONGBREAK:
      minutesToCountdown = 15;
      break;
  }

  room.timerOn = false;
  room.secondsOnTimer = minutesToCountdown * 60;
  io.to(roomCode).emit("timer-toggle", room.timerOn);
  io.to(roomCode).emit("timer-tick", room.secondsOnTimer);
};

let setSessionType = (roomCode: string, sessionType: SessionType) => {
  let room = rooms[roomCode];
  if (room.timerOn) return;
  room.sessionType = sessionType;
  reset(roomCode, sessionType);
  io.to(roomCode).emit("set-session-type", sessionType);
};

let decrement = (roomCode: string) => {
  let room = rooms[roomCode];
  if (room.timerOn) return;
  if (room.secondsOnTimer >= 60) room.secondsOnTimer -= 60;
  else room.secondsOnTimer = 0;
  io.emit("timer-tick", room.secondsOnTimer);
};

let increment = (roomCode: string) => {
  let room = rooms[roomCode];
  if (room.timerOn) return;
  room.secondsOnTimer += 60;
  io.emit("timer-tick", room.secondsOnTimer);
};

let toggleTimer = (roomCode: string, socket) => {
  let room = rooms[roomCode];

  room.timerOn = !room.timerOn;
  io.to(roomCode).emit("timer-toggle", room.timerOn);
  if (room.timerOn) {
    if (room.secondsOnTimer <= 0) {
      room.timerOn = false;
      io.to(roomCode).emit("timer-toggle", room.timerOn);
      io.to(roomCode).emit("timer-tick", room.secondsOnTimer);
      if (room.sessionType === SessionType.POMODORO) {
        io.to(roomCode).emit("completed-pomo");
        setSessionType(roomCode, SessionType.SHORTBREAK);
      } else {
        setSessionType(roomCode, SessionType.POMODORO);
      }
      io.to(roomCode).emit("timer-complete");
      clearInterval(room.interval);
      return;
    }
    room.interval = setInterval(() => {
      room.secondsOnTimer--;
      io.to(roomCode).emit("timer-tick", room.secondsOnTimer);
    }, 1000);
  } else clearInterval(room.interval);
};

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    if (!allConnectedUsers[socket.id]) return;
    let roomCode = allConnectedUsers[socket.id].roomCode;
    let room = rooms[roomCode];
    delete allConnectedUsers[socket.id];
    delete rooms[roomCode]["connectedUsers"][socket.id];
    io.to(roomCode).emit("connected-users", room["connectedUsers"]);
    console.log(`User ${socket.id} has disconnected`);
  });
  socket.on("toggle-button-press", (roomCode: string) => {
    toggleTimer(roomCode, socket);
  });
  socket.on("decrement-button-press", (roomCode: string) => {
    decrement(roomCode);
  });
  socket.on("increment-button-press", (roomCode: string) => {
    increment(roomCode);
  });
  socket.on(
    "session-type-switch",
    (roomCode: string, sessionType: SessionType) => {
      setSessionType(roomCode, sessionType);
    }
  );
  socket.on("create-room", (userName: string, cb: (arg0: string) => {}) => {
    let roomCode = uuidV4();
    let user = { roomCode, userName };
    allConnectedUsers[socket.id] = user;
    rooms[roomCode] = {
      interval: null,
      timerOn: false,
      secondsOnTimer: 25 * 60,
      sessionType: SessionType.POMODORO,
      connectedUsers: {},
    };
    cb(roomCode);
  });
  socket.on("join-room", ({ roomCode, userName }, cb) => {
    if (!(roomCode in rooms)) {
      cb(false);
      return;
    }
    let user = { roomCode, userName };
    allConnectedUsers[socket.id] = user;

    let room = rooms[roomCode];
    room["connectedUsers"][socket.id] = user;

    socket.join(roomCode);
    io.to(roomCode).emit("connected-users", room["connectedUsers"]);
    socket.broadcast.to(roomCode).emit("new-user-connected");
    socket.emit("joined-room", roomCode);

    io.to(roomCode).emit("timer-toggle", room.timerOn);
    io.to(roomCode).emit("timer-tick", room.secondsOnTimer);
    io.to(roomCode).emit("set-session-type", room.sessionType);
    cb(true);
  });
  socket.on("check-if-room-exists", (roomCode, cb) => {
    if (roomCode in rooms) cb({ roomCode: roomCode, exists: true });
    else cb({ roomCode: roomCode, exists: false });
  });
});

server.listen(3001, () => {
  console.log("listening on *:3001");
});
