const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Название команды обязательно"],
    trim: true,
    maxlength: [100, "Название команды не может быть длиннее 100 символов"]
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
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

// Виртуальное поле для количества участников
TeamSchema.virtual("memberCount").get(function() {
  return this.members.length;
});

// Виртуальное поле для среднего рейтинга команды
TeamSchema.virtual("averageRating", {
  ref: "Evaluation",
  localField: "_id",
  foreignField: "evaluatedTeam"
});

// Метод для добавления участника
TeamSchema.methods.addMember = async function(userId) {
  if (!this.members.includes(userId)) {
    this.members.push(userId);
    await this.save();
    return true;
  }
  return false;
};

// Метод для удаления участника
TeamSchema.methods.removeMember = async function(userId) {
  const index = this.members.indexOf(userId);
  if (index > -1) {
    this.members.splice(index, 1);
    await this.save();
    return true;
  }
  return false;
};

// Метод для проверки, является ли пользователь участником команды
TeamSchema.methods.hasMember = function(userId) {
  return this.members.includes(userId);
};

module.exports = mongoose.model("Team", TeamSchema);
