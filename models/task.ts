const mongoose = require("mongoose");

const taskSchema = mongoose.Schema({
  title: { type: String, required: true },
  pomodorosCompleted: { type: Number, required: false },
  pomodoroGoal: { type: Number, required: true },
  isCompleted: { type: Boolean, required: true },
  note: { type: String, required: false },
});

export const Task = mongoose.model("Task", taskSchema);
