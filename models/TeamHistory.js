const mongoose = require("mongoose");

const TeamHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  period: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EvaluationPeriod",
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

TeamHistorySchema.index({ user: 1, period: 1 });
TeamHistorySchema.index({ team: 1, period: 1 });

TeamHistorySchema.methods.endParticipation = async function() {
  this.endDate = new Date();
  this.isActive = false;
  await this.save();
  return this;
};

TeamHistorySchema.statics.getUserHistory = async function(userId, periodId = null) {
  const query = { user: userId };
  if (periodId) {
    query.period = periodId;
  }
  
  return await this.find(query)
    .populate("team", "name")
    .populate("group", "name")
    .populate("period", "name startDate endDate")
    .sort({ startDate: -1 });
};

module.exports = mongoose.model("TeamHistory", TeamHistorySchema);
