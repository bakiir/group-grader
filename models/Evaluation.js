const mongoose = require("mongoose");

const EvaluationSchema = new mongoose.Schema({
  evaluator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  evaluatedTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true
  },
  criteria: [{
    criterion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Criterion",
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: [0, "Оценка не может быть отрицательной"],
      max: [100, "Оценка не может быть больше 100"]
    }
  }],
  totalScore: {
    type: Number,
    required: true,
    min: [0, "Общая оценка не может быть отрицательной"],
    max: [100, "Общая оценка не может быть больше 100"]
  },
  period: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EvaluationPeriod",
    required: true
  },
  comments: {
    type: String,
    trim: true,
    maxlength: [1000, "Комментарий не может быть длиннее 1000 символов"]
  },
  isSubmitted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Индекс для предотвращения повторного оценивания
EvaluationSchema.index({ 
  evaluator: 1, 
  evaluatedTeam: 1, 
  period: 1 
}, { 
  unique: true 
});

// Валидация: проверка, что студент не оценивает свою команду
EvaluationSchema.pre("save", async function(next) {
  const User = mongoose.model("User");
  const Team = mongoose.model("Team");
  
  const evaluator = await User.findById(this.evaluator);
  const team = await Team.findById(this.evaluatedTeam);
  
  if (evaluator && team && evaluator.currentTeam && evaluator.currentTeam.toString() === this.evaluatedTeam.toString()) {
    const error = new Error("Студент не может оценивать свою команду");
    return next(error);
  }
  
  next();
});

// Метод для расчета общей оценки
EvaluationSchema.methods.calculateTotalScore = function() {
  const Criterion = mongoose.model("Criterion");
  
  return this.criteria.reduce((total, criterionData) => {
    const weight = criterionData.criterion.weight || 0;
    const score = criterionData.score || 0;
    return total + (score * weight / 100);
  }, 0);
};

module.exports = mongoose.model("Evaluation", EvaluationSchema);
