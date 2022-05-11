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
  },
  { timeStamps: true }
);

export const User = mongoose.model("User", userSchema);
