const mongoose = require("mongoose");

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
  },
  { timeStamps: true }
);

export const User = mongoose.model("User", userSchema);
