const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Название группы обязательно"],
    trim: true,
    unique: true,
    maxlength: [100, "Название группы не может быть длиннее 100 символов"]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Описание не может быть длиннее 500 символов"]
  },
  maxStudents: {
    type: Number,
    default: 30,
    min: [1, "Максимальное количество студентов должно быть больше 0"]
  },
  currentStudents: {
    type: Number,
    default: 0,
    min: [0, "Текущее количество студентов не может быть отрицательным"]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

// Виртуальное поле для количества команд
GroupSchema.virtual("teams", {
  ref: "Team",
  localField: "_id",
  foreignField: "group"
});

// Виртуальное поле для студентов группы
GroupSchema.virtual("students", {
  ref: "User",
  localField: "_id",
  foreignField: "group"
});

// Метод для обновления счетчика студентов
GroupSchema.methods.updateStudentCount = async function() {
  const User = mongoose.model("User");
  const count = await User.countDocuments({ group: this._id, isActive: true });
  this.currentStudents = count;
  await this.save();
  return count;
};

module.exports = mongoose.model("Group", GroupSchema);  