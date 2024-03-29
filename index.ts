require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Mixpanel = require("mixpanel");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidV4 } = require("uuid");
const { ExpressPeerServer } = require("peer");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);

export const mixpanel = Mixpanel.init(process.env.MIX_PANEL_TOKEN);

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = isProduction
  ? [
      "http://www.pomo.wtf",
      "https://www.pomo.wtf",
      "https://pomowtf-frontend.herokuapp.com",
    ]
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });
require("./room")(io);

import { User } from "./models/user";

const peerServer = ExpressPeerServer(server, { debug: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI);

app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.send("pomo api");
});

app.post("/register", async (req, res) => {
  const user = req.body;
  const takenEmail = await User.findOne({ email: user.email });
  if (takenEmail) {
    res.json({ message: "Email is already in use" });
    return;
  }
  user.password = await bcrypt.hash(req.body.password, 10);

  const dbUser = new User({
    displayName: user.displayName,
    email: user.email,
    password: user.password,
    completedPomodoros: [],
    tasks: [],
  });
  dbUser.save();
  mixpanel.track("Signed Up", {
    distinct_id: dbUser.id,
    username: dbUser.displayName,
  });
  res.json({ message: "Success" });
});

app.post("/login", async (req, res) => {
  const userLoggingIn = req.body;

  User.findOne({ email: userLoggingIn.email }).then((dbUser) => {
    if (!dbUser) {
      return res.json({ message: "No user with this email" });
    }
    bcrypt
      .compare(userLoggingIn.password, dbUser.password)
      .then((isCorrect) => {
        if (!isCorrect) {
          return res.json({
            message: "Invalid email/password",
          });
        }
        const payload = { id: dbUser._id, user: dbUser };
        jwt.sign(
          payload,
          process.env.JWT_SECRET,
          { expiresIn: 86400 },
          (err, token) => {
            if (err) return res.json({ message: err });

            mixpanel.track("Logged In", {
              distinct_id: payload.id,
              username: dbUser.displayName,
            });
            return res.json({
              message: "Success",
              token: "Bearer " + token,
              user: dbUser,
            });
          }
        );
      });
  });
});

let verifyJWT = (req, res, next) => {
  const token = req.headers["x-access-token"]?.split(" ")[1];

  if (token) {
    jwt.verify(token, "i heart pokemon and ethereum", (err, decoded) => {
      if (err)
        return res.json({
          isLoggedIn: false,
          message: "failed to auth",
        });
      req.user = decoded.user;
      delete req.user.password;
      next();
    });
  } else {
    res.json({ message: "Incorrect Token Given", isLoggedIn: false });
  }
};

app.get("/user/:email", async (req, res) => {
  // const user = req.body;
  // res.json();
  const user = await User.findOne(req.params);
  if (user) {
    res.json({
      email: user.email,
      displayName: user.displayName,
      completedPomodoros: user.completedPomodoros,
    });
    return;
  }
  res.sendStatus(404);
});

app.post("/isUserAuth", verifyJWT, (req, res) => {
  res.json({ isLoggedIn: true, user: req.user });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
