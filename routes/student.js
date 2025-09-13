const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Team = require("../models/Team");
const Group = require("../models/Group");
const Criterion = require("../models/Criterion");
const Evaluation = require("../models/Evaluation");
const EvaluationPeriod = require("../models/EvaluationPeriod");
const TeamHistory = require("../models/TeamHistory");
const router = express.Router();

// Главная страница студента
router.get("/dashboard", async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate("group", "name")
      .populate("currentTeam", "name members");

    if (!user) {
      return res.redirect("/auth/login");
    }

    // Получение активного периода оценивания
    const activePeriod = await EvaluationPeriod.findOne({ isActive: true });
    
    // Получение команд для оценивания (исключая свою команду)
    let teamsToEvaluate = [];
    if (activePeriod && user.currentTeam) {
      const allTeams = await Team.find({ 
        group: { $ne: user.group },
        isActive: true 
      }).populate("group", "name").populate("members", "name");

      // Проверяем, какие команды студент уже оценил
      const evaluatedTeams = await Evaluation.find({
        evaluator: req.session.userId,
        period: activePeriod._id
      }).select("evaluatedTeam");

      const evaluatedTeamIds = evaluatedTeams.map(e => e.evaluatedTeam.toString());
      teamsToEvaluate = allTeams.filter(team => 
        !evaluatedTeamIds.includes(team._id.toString())
      );
    }

    // История команд студента
    const teamHistory = await TeamHistory.getUserHistory(req.session.userId);

    res.render("student/dashboard", {
      title: "Личный кабинет",
      user: user,
      activePeriod: activePeriod,
      teamsToEvaluate: teamsToEvaluate,
      teamHistory: teamHistory
    });
  } catch (error) {
    console.error("Ошибка загрузки дашборда студента:", error);
    res.render("student/dashboard", {
      title: "Личный кабинет",
      error: "Ошибка загрузки данных"
    });
  }
});

// Страница команды студента
router.get("/team", async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate("group", "name")
      .populate("currentTeam", "name members");

    if (!user || !user.currentTeam) {
      return res.render("student/team", {
        title: "Моя команда",
        user: user,
        team: null,
        error: "У вас нет активной команды"
      });
    }

    // Получение участников команды
    const team = await Team.findById(user.currentTeam)
      .populate("members", "name email")
      .populate("group", "name");

    res.render("student/team", {
      title: "Моя команда",
      user: user,
      team: team
    });
  } catch (error) {
    console.error("Ошибка загрузки команды:", error);
    res.render("student/team", {
      title: "Моя команда",
      error: "Ошибка загрузки команды"
    });
  }
});

// Страница оценивания
router.get("/evaluation", async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user || !user.currentTeam) {
      return res.redirect("/student/dashboard?error=У вас нет активной команды");
    }

    const activePeriod = await EvaluationPeriod.findOne({ isActive: true });
    if (!activePeriod) {
      return res.render("student/evaluation", {
        title: "Оценивание команд",
        error: "Нет активного периода оценивания"
      });
    }

    // Получение команд для оценивания
    const teamsToEvaluate = await Team.find({ 
      group: { $ne: user.group },
      isActive: true 
    }).populate("group", "name").populate("members", "name");

    // Получение критериев оценивания
    const criteria = await Criterion.find({ isActive: true }).sort({ weight: -1 });

    // Проверяем, какие команды уже оценены
    const evaluatedTeams = await Evaluation.find({
      evaluator: req.session.userId,
      period: activePeriod._id
    }).select("evaluatedTeam");

    const evaluatedTeamIds = evaluatedTeams.map(e => e.evaluatedTeam.toString());
    const availableTeams = teamsToEvaluate.filter(team => 
      !evaluatedTeamIds.includes(team._id.toString())
    );

    res.render("student/evaluation", {
      title: "Оценивание команд",
      activePeriod: activePeriod,
      teamsToEvaluate: availableTeams,
      criteria: criteria
    });
  } catch (error) {
    console.error("Ошибка загрузки страницы оценивания:", error);
    res.render("student/evaluation", {
      title: "Оценивание команд",
      error: "Ошибка загрузки данных"
    });
  }
});

// Обработка отправки оценки
router.post("/evaluation", [
  body("teamId").isMongoId(),
  body("criteria").isArray({ min: 1 }),
  body("criteria.*.criterionId").isMongoId(),
  body("criteria.*.score").isInt({ min: 0, max: 100 }),
  body("comments").optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect("/student/evaluation?error=Некорректные данные");
    }

    const { teamId, criteria, comments } = req.body;
    const userId = req.session.userId;

    // Проверка активного периода
    const activePeriod = await EvaluationPeriod.findOne({ isActive: true });
    if (!activePeriod) {
      return res.redirect("/student/evaluation?error=Нет активного периода оценивания");
    }

    // Проверка, что студент не оценивает свою команду
    const user = await User.findById(userId);
    const team = await Team.findById(teamId);
    
    if (user.currentTeam && user.currentTeam.toString() === teamId) {
      return res.redirect("/student/evaluation?error=Вы не можете оценивать свою команду");
    }

    // Проверка, что команда не из той же группы
    if (user.group.toString() === team.group.toString()) {
      return res.redirect("/student/evaluation?error=Вы не можете оценивать команды из своей группы");
    }

    // Проверка, что оценка еще не была отправлена
    const existingEvaluation = await Evaluation.findOne({
      evaluator: userId,
      evaluatedTeam: teamId,
      period: activePeriod._id
    });

    if (existingEvaluation) {
      return res.redirect("/student/evaluation?error=Вы уже оценили эту команду");
    }

    // Валидация критериев
    const validCriteria = await Criterion.find({ 
      _id: { $in: criteria.map(c => c.criterionId) },
      isActive: true 
    });

    if (validCriteria.length !== criteria.length) {
      return res.redirect("/student/evaluation?error=Некорректные критерии");
    }

    // Расчет общей оценки
    let totalScore = 0;
    const criteriaData = criteria.map(c => {
      const criterion = validCriteria.find(cr => cr._id.toString() === c.criterionId);
      const score = parseInt(c.score);
      totalScore += (score * criterion.weight / 100);
      
      return {
        criterion: c.criterionId,
        score: score
      };
    });

    // Создание оценки
    const evaluation = new Evaluation({
      evaluator: userId,
      evaluatedTeam: teamId,
      criteria: criteriaData,
      totalScore: Math.round(totalScore * 100) / 100, // Округление до 2 знаков
      period: activePeriod._id,
      comments: comments || "",
      isSubmitted: true
    });

    await evaluation.save();

    res.redirect("/student/dashboard?success=Оценка отправлена успешно");
  } catch (error) {
    console.error("Ошибка отправки оценки:", error);
    res.redirect("/student/evaluation?error=Ошибка отправки оценки");
  }
});

// История команд студента
router.get("/history", async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate("group", "name");
    const teamHistory = await TeamHistory.getUserHistory(req.session.userId);

    res.render("student/history", {
      title: "История команд",
      user: user,
      teamHistory: teamHistory
    });
  } catch (error) {
    console.error("Ошибка загрузки истории:", error);
    res.render("student/history", {
      title: "История команд",
      error: "Ошибка загрузки истории"
    });
  }
});

module.exports = router;
