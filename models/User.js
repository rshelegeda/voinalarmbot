const mongoose = require("mongoose");

// Схема для пользователей
const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  chatId: { type: Number, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  dateFirstLogin: { type: String },
  language: { type: String, default: "ru" },
  trackedPairs: [
    {
      pair: { type: String, required: true },
      abbreviation: { type: String, required: true },
      isTracked: { type: Boolean, default: false },
      price: { type: Number, default: null },
    },
  ],
  isBlocked: { type: Boolean, default: false }, // Новое поле
});

module.exports = mongoose.model("User", userSchema);