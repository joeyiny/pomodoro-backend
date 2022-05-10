const express = require("express");
const app = express();
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
  res.send("f");
  const kitty = new User({
    email: "joeyainy@gmail.com",
    displayName: "Joey Iny",
    password: "123",
  });
  kitty.save().then(() => console.log("meow"));
});

app.post("/register", async (req, res) => {
  const user = req.body;
  const takenEmail = await User.findOne({ username: user.username });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
