import { User } from "../models/user";

const { v4: uuidV4 } = require("uuid");

enum SessionType {
  POMODORO = "Pomodoro",
  SHORTBREAK = "Short Break",
  LONGBREAK = "Long Break",
}

interface IUser {
  displayName: string;
  roomCode: string;
  databaseId: string;
  completedPomodoros?: [{ date: Date; minutes: number }];
}

interface Users {
  [key: string]: IUser;
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

module.exports = function (io) {
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

  let updateUserPomodoros = async (roomCode: string) => {
    let room: Room = rooms[roomCode];
    let users: Users = room.connectedUsers;

    const update = {
      $push: {
        completedPomodoros: { date: new Date() },
      },
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    for (let i in users) {
      User.findByIdAndUpdate(
        users[i].databaseId,
        update,
        options,
        (err, docs) => {
          if (err) {
            console.log(err);
          } else {
            console.log("Updated user: " + docs.displayName + " " + docs.email);
          }
        }
      );
    }
  };

  let toggleTimer = (roomCode: string, socket) => {
    let room = rooms[roomCode];

    room.timerOn = !room.timerOn;
    io.to(roomCode).emit("timer-toggle", room.timerOn);

    if (room.timerOn) {
      room.interval = setInterval(() => {
        room.secondsOnTimer--;
        io.to(roomCode).emit("timer-tick", room.secondsOnTimer);
        if (room.secondsOnTimer <= 0) {
          room.timerOn = false;
          if (room.sessionType === SessionType.POMODORO) {
            io.to(roomCode).emit("completed-pomo");
            updateUserPomodoros(roomCode);

            setSessionType(roomCode, SessionType.SHORTBREAK);
          } else {
            setSessionType(roomCode, SessionType.POMODORO);
          }
          io.to(roomCode).emit("timer-complete");
          io.to(roomCode).emit("timer-toggle", room.timerOn);
          clearInterval(room.interval);
          reset(roomCode, room.sessionType);
          return;
        }
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
      io.to(roomCode).emit("user-disconnected", socket.id);
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
    socket.on("video-ready", (roomCode: string) => {
      console.log("video ready: " + socket.id + ". room code: " + roomCode);
      io.to(roomCode).emit(
        "connected-users",
        rooms[roomCode]["connectedUsers"]
      );
      io.to(roomCode).emit("new-user-joined-video", socket.id);
    });
    socket.on(
      "session-type-switch",
      (roomCode: string, sessionType: SessionType) => {
        setSessionType(roomCode, sessionType);
      }
    );
    socket.on(
      "create-room",
      (displayName: string, databaseId: string, cb: (arg0: string) => {}) => {
        let roomCode = uuidV4();
        let user = { roomCode, displayName, databaseId };
        allConnectedUsers[socket.id] = user;
        rooms[roomCode] = {
          interval: null,
          timerOn: false,
          secondsOnTimer: 25 * 60,
          sessionType: SessionType.POMODORO,
          connectedUsers: {},
        };
        cb(roomCode);
      }
    );
    socket.on("join-room", ({ roomCode, displayName, databaseId }, cb) => {
      if (!(roomCode in rooms)) {
        cb(false);
        return;
      }
      let user = { roomCode, displayName, databaseId };
      allConnectedUsers[socket.id] = user;

      let room = rooms[roomCode];
      room["connectedUsers"][socket.id] = user;

      socket.join(roomCode);
      io.to(roomCode).emit("connected-users", room["connectedUsers"]);
      socket.broadcast.to(roomCode).emit("new-user-connected", socket.id);
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
    socket.on("update-tasks", async (user, tasks) => {
      console.log(user, tasks);
      const doc = await User.findOneAndUpdate(
        { email: user.email },
        { tasks: tasks }
      );
    });
    socket.on(
      "chat",
      (args: { roomCode: string; user: any; message: string }, cb) => {
        delete args.user.password;
        delete args.user.email;
        delete args.user.completedPomodoros;
        io.to(args.roomCode).emit("chat", {
          user: args.user,
          message: args.message,
        });
      }
    );
  });
};
