
import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema({
 fullName: String,
 dob: String,
  email: String,
  phone: String,
  school: String,
  program: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Application =
  mongoose.models.Application || mongoose.model("Application", ApplicationSchema);
