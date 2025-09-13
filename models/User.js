const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Имя обязательно"],
    trim: true,
    maxlength: [50, "Имя не может быть длиннее 50 символов"]
  },
  email: {
    type: String,
    required: [true, "Email обязателен"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Некорректный email"]
  },
  password: {
    type: String,
    required: [true, "Пароль обязателен"],
    minlength: [6, "Пароль должен содержать минимум 6 символов"]
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true
  },
  currentTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    default: null
  },
  role: {
    type: String,
    enum: ["student", "admin"],
    default: "student"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Хеширование пароля перед сохранением
UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Метод для проверки пароля
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Метод для получения публичных данных пользователя
UserSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    group: this.group,
    currentTeam: this.currentTeam,
    role: this.role,
    isActive: this.isActive,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model("User", UserSchema);
