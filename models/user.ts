const mongoose = require("mongoose");
import { Task } from "./task";

const userSchema = mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    displayName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    completedPomodoros: [
      {
        date: Date,
        minutes: { type: Number, required: false },
      },
    ],
    tasks: [
      {
        title: { type: String, required: true },
        pomodorosCompleted: { type: Number, required: false },
        pomodoroGoal: { type: Number, required: true },
        completed: { type: Boolean, required: true },
        note: { type: String, required: false },
      },
    ],
  },
  { timeStamps: true }
);

export const User = mongoose.model("User", userSchema);
