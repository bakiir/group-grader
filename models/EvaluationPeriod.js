const mongoose = require("mongoose");

const EvaluationPeriodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Название периода обязательно"],
    trim: true,
    maxlength: [100, "Название периода не может быть длиннее 100 символов"]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Описание не может быть длиннее 500 символов"]
  },
  startDate: {
    type: Date,
    required: [true, "Дата начала обязательна"]
  },
  endDate: {
    type: Date,
    required: [true, "Дата окончания обязательна"]
  },
  isActive: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ["draft", "active", "completed", "cancelled"],
    default: "draft"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group"
  }]
}, {
  timestamps: true
});

// Валидация: дата окончания должна быть после даты начала
EvaluationPeriodSchema.pre("save", function(next) {
  if (this.endDate <= this.startDate) {
    const error = new Error("Дата окончания должна быть после даты начала");
    return next(error);
  }
  next();
});

// Виртуальное поле для проверки, активен ли период сейчас
EvaluationPeriodSchema.virtual("isCurrentlyActive").get(function() {
  const now = new Date();
  return this.isActive && this.startDate <= now && this.endDate >= now;
});

// Виртуальное поле для проверки, завершен ли период
EvaluationPeriodSchema.virtual("isCompleted").get(function() {
  const now = new Date();
  return this.endDate < now;
});

// Метод для активации периода
EvaluationPeriodSchema.methods.activate = async function() {
  this.isActive = true;
  this.status = "active";
  await this.save();
  return this;
};

// Метод для деактивации периода
EvaluationPeriodSchema.methods.deactivate = async function() {
  this.isActive = false;
  this.status = "completed";
  await this.save();
  return this;
};

module.exports = mongoose.model("EvaluationPeriod", EvaluationPeriodSchema);
