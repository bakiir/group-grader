const mongoose = require("mongoose");

const CriterionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Название критерия обязательно"],
    trim: true,
    maxlength: [100, "Название критерия не может быть длиннее 100 символов"]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Описание не может быть длиннее 500 символов"]
  },
  weight: {
    type: Number,
    required: [true, "Вес критерия обязателен"],
    min: [0, "Вес критерия не может быть отрицательным"],
    max: [100, "Вес критерия не может быть больше 100"]
  },
  maxScore: {
    type: Number,
    default: 100,
    min: [1, "Максимальный балл должен быть больше 0"]
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

// Валидация: сумма весов всех активных критериев не должна превышать 100
CriterionSchema.pre("save", async function(next) {
  if (this.isActive) {
    const Criterion = mongoose.model("Criterion");
    const activeCriteria = await Criterion.find({ 
      isActive: true, 
      _id: { $ne: this._id } 
    });
    
    const totalWeight = activeCriteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    
    if (totalWeight + this.weight > 100) {
      const error = new Error("Сумма весов всех критериев не может превышать 100%");
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Criterion", CriterionSchema);
