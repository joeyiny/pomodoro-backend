const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { v4: uuidV4 } = require("uuid");
const { ExpressPeerServer } = require("peer");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

require("./room")(io);
import { User } from "./models/user";

const peerServer = ExpressPeerServer(server, {
  debug: true,
});
// parse requests of content-type - application/json
app.use(bodyParser.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(
  "mongodb+srv://joey:js5mVl3uWj9n6Pfc@pomo.bu0si.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"
);

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
  });
  dbUser.save();
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
        const payload = { id: dbUser._id, displayName: dbUser.displayName };
        jwt.sign(
          payload,
          "i heart pokemon and ethereum",
          { expiresIn: 86400 },
          (err, token) => {
            if (err) return res.json({ message: err });
            return res.json({ message: "Success", token: "Bearer " + token });
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
      req.user = {};
      req.user.id = decoded.is;
      req.user.displayName = decoded.displayName;
      next();
    });
  } else {
    res.json({ message: "Incorrect Token Given", isLoggedIn: false });
  }
};

app.post("/isUserAuth", verifyJWT, (req, res) => {
  res.json({ isLoggedIn: true, displayName: req.user.displayName });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
