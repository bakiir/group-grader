const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Group = require("../models/Group");
const Team = require("../models/Team");
const Criterion = require("../models/Criterion");
const EvaluationPeriod = require("../models/EvaluationPeriod");
const TeamHistory = require("../models/TeamHistory");
const Evaluation = require("../models/Evaluation");
const router = express.Router();

// Главная страница админа
router.get("/dashboard", async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true }).populate("students");
    const activePeriods = await EvaluationPeriod.find({ isActive: true });
    const totalStudents = await User.countDocuments({ role: "student", isActive: true });
    
    res.render("admin/dashboard", {
      title: "Панель администратора",
      groups: groups,
      activePeriods: activePeriods,
      totalStudents: totalStudents,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки дашборда:", error);
    res.render("admin/dashboard", {
      title: "Панель администратора",
      error: "Ошибка загрузки данных"
    });
  }
});


// Управление группами
router.get("/groups", async (req, res) => {
  try {
    const groups = await Group.find({}).populate("createdBy", "name").sort({ createdAt: -1 });
    res.render("admin/groups", {
      title: "Управление группами",
      groups: groups,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки групп:", error);
    res.render("admin/groups", {
      title: "Управление группами",
      error: "Ошибка загрузки групп"
    });
  }
});

// Создание группы
router.post("/groups", [
  body("name").trim().isLength({ min: 2, max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("maxStudents").isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const groups = await Group.find({}).populate("createdBy", "name");
      return res.render("admin/groups", {
        title: "Управление группами",
        groups: groups,
        error: "Некорректные данные",
        errors: errors.array()
      });
    }

    const { name, description, maxStudents } = req.body;
    
    const group = new Group({
      name,
      description,
      maxStudents: parseInt(maxStudents),
      createdBy: req.session.userId
    });

    await group.save();
    res.redirect("/admin/groups?success=Группа создана успешно");
  } catch (error) {
    console.error("Ошибка создания группы:", error);
    res.redirect("/admin/groups?error=Ошибка создания группы");
  }
});

// Студенты группы
router.get("/groups/:id/students", async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).send("Группа не найдена");
    }

    const students = await User.find({ group: req.params.id, isActive: true })
      .populate("currentTeam", "name")
      .sort({ name: 1 });

    res.render("admin/group-students", {
      title: `Студенты группы ${group.name}`,
      group: group,
      students: students,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки студентов:", error);
    res.status(500).send("Ошибка загрузки студентов");
  }
});

// Удаление группы
router.delete("/groups/:id", async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    // Нельзя удалить группу, если в ней есть студенты
    if (group.currentStudents > 0) {
      return res.status(400).json({ error: "Нельзя удалить группу, в которой есть студенты. Сначала переместите или удалите студентов." });
    }

    // Удаление связанных команд
    await Team.deleteMany({ group: groupId });

    // Удаление самой группы
    await Group.findByIdAndDelete(groupId);

    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка удаления группы:", error);
    res.status(500).json({ error: "Ошибка удаления группы" });
  }
});

// Обновление группы
router.put("/groups/:id", [
  body("name").trim().isLength({ min: 2, max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("maxStudents").isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Некорректные данные", errors: errors.array() });
    }

    const { name, description, maxStudents } = req.body;
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    // Нельзя уменьшать максимальное количество студентов, если текущее количество больше нового значения
    if (parseInt(maxStudents) < group.currentStudents) {
      return res.status(400).json({ error: `Нельзя установить максимальное количество студентов меньше, чем текущее количество (${group.currentStudents})` });
    }

    group.name = name;
    group.description = description;
    group.maxStudents = parseInt(maxStudents);

    await group.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обновления группы:", error);
    res.status(500).json({ error: "Ошибка обновления группы" });
  }
});

// Управление командами
router.get("/teams/:groupId", async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).send("Группа не найдена");
    }

    const teams = await Team.find({ group: req.params.groupId, isActive: true })
      .populate("members", "name email")
      .sort({ name: 1 });

    res.render("admin/teams", {
      title: `Команды группы ${group.name}`,
      group: group,
      teams: teams,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки команд:", error);
    res.status(500).send("Ошибка загрузки команд");
  }
});

// Перераспределение команд
router.post("/teams/:groupId/redistribute", async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).send("Группа не найдена");
    }

    const students = await User.find({ group: req.params.groupId, isActive: true });
    
    if (students.length === 0) {
      return res.redirect(`/admin/teams/${req.params.groupId}?error=В группе нет студентов`);
    }

    // Деактивация существующих команд
    await Team.updateMany({ group: req.params.groupId }, { isActive: false });

    // Создание новых команд
    const teamSize = 5; // Размер команды
    const shuffledStudents = students.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffledStudents.length; i += teamSize) {
      const teamStudents = shuffledStudents.slice(i, i + teamSize);
      const teamNumber = Math.floor(i / teamSize) + 1;
      
      const team = new Team({
        name: `Команда ${teamNumber}`,
        group: req.params.groupId,
        members: teamStudents.map(s => s._id),
        createdBy: req.session.userId
      });

      await team.save();

      // Обновление currentTeam у студентов
      for (const student of teamStudents) {
        student.currentTeam = team._id;
        await student.save();
      }
    }

    res.redirect(`/admin/teams/${req.params.groupId}?success=Команды перераспределены успешно`);
  } catch (error) {
    console.error("Ошибка перераспределения команд:", error);
    res.redirect(`/admin/teams/${req.params.groupId}?error=Ошибка перераспределения команд`);
  }
});

// Обновление команды
router.put("/teams/:id", [
  body("name").trim().isLength({ min: 2, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Некорректные данные", errors: errors.array() });
    }

    const { name } = req.body;
    const teamId = req.params.id;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Команда не найдена" });
    }

    team.name = name;

    await team.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обновления команды:", error);
    res.status(500).json({ error: "Ошибка обновления команды" });
  }
});

// Управление критериями
router.get("/criteria", async (req, res) => {
  try {
    const criteria = await Criterion.find({}).populate("createdBy", "name").sort({ createdAt: -1 });
    res.render("admin/criteria", {
      title: "Критерии оценивания",
      criteria: criteria,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки критериев:", error);
    res.render("admin/criteria", {
      title: "Критерии оценивания",
      error: "Ошибка загрузки критериев"
    });
  }
});

// Создание критерия
router.post("/criteria", [
  body("name").trim().isLength({ min: 2, max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("weight").isInt({ min: 1, max: 100 }),
  body("maxScore").isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const criteria = await Criterion.find({});
      return res.render("admin/criteria", {
        title: "Критерии оценивания",
        criteria: criteria,
        error: "Некорректные данные",
        errors: errors.array()
      });
    }

    const { name, description, weight, maxScore } = req.body;
    
    const criterion = new Criterion({
      name,
      description,
      weight: parseInt(weight),
      maxScore: parseInt(maxScore),
      createdBy: req.session.userId
    });

    await criterion.save();
    res.redirect("/admin/criteria?success=Критерий создан успешно");
  } catch (error) {
    console.error("Ошибка создания критерия:", error);
    res.redirect("/admin/criteria?error=Ошибка создания критерия");
  }
});

// Управление периодами оценивания
router.get("/periods", async (req, res) => {
  try {
    const periods = await EvaluationPeriod.find({})
      .populate("createdBy", "name")
      .populate("groups", "name")
      .sort({ createdAt: -1 });
    
    const groups = await Group.find({ isActive: true });
    
    res.render("admin/periods", {
      title: "Периоды оценивания",
      periods: periods,
      groups: groups,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки периодов:", error);
    res.render("admin/periods", {
      title: "Периоды оценивания",
      periods: [],
      groups: [],
      error: "Ошибка загрузки периодов"
    });
  }
});

// Создание периода оценивания
router.post("/periods", [
  body("name").trim().isLength({ min: 2, max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("startDate").notEmpty().withMessage("Дата начала обязательна"),
  body("endDate").notEmpty().withMessage("Дата окончания обязательна"),
  body("groups").custom((value) => {
    if (!value) {
      throw new Error("Выберите хотя бы одну группу");
    }
    if (Array.isArray(value) && value.length === 0) {
      throw new Error("Выберите хотя бы одну группу");
    }
    if (typeof value === 'string' && value.trim() === '') {
      throw new Error("Выберите хотя бы одну группу");
    }
    return true;
  })
], async (req, res) => {
  try {
    // Отладочная информация
    console.log("Request body:", req.body);
    console.log("Groups:", req.body.groups);
    console.log("Groups type:", typeof req.body.groups);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      const periods = await EvaluationPeriod.find({}).populate("createdBy", "name").populate("groups", "name");
      const groups = await Group.find({ isActive: true });
      return res.render("admin/periods", {
        title: "Периоды оценивания",
        periods: periods,
        groups: groups,
        error: "Некорректные данные",
        errors: errors.array()
      });
    }

    const { name, description, startDate, endDate, groups } = req.body;
    
    // Обработка groups - может быть массивом или строкой
    const groupsArray = Array.isArray(groups) ? groups : [groups];
    
    // Проверка, что дата окончания после даты начала
    if (new Date(endDate) <= new Date(startDate)) {
      const periods = await EvaluationPeriod.find({}).populate("createdBy", "name").populate("groups", "name");
      const groupsList = await Group.find({ isActive: true });
      return res.render("admin/periods", {
        title: "Периоды оценивания",
        periods: periods,
        groups: groupsList,
        error: "Дата окончания должна быть после даты начала"
      });
    }

    const period = new EvaluationPeriod({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      groups: groupsArray,
      createdBy: req.session.userId
    });

    await period.save();
    res.redirect("/admin/periods?success=Период оценивания создан успешно");
  } catch (error) {
    console.error("Ошибка создания периода:", error);
    res.redirect("/admin/periods?error=Ошибка создания периода оценивания");
  }
});

// Активация периода оценивания
router.post("/periods/:id/activate", async (req, res) => {
  try {
    const period = await EvaluationPeriod.findById(req.params.id);
    if (!period) {
      return res.redirect("/admin/periods?error=Период не найден");
    }

    // Деактивируем все другие активные периоды
    await EvaluationPeriod.updateMany({ isActive: true }, { isActive: false, status: "completed" });

    // Активируем выбранный период
    await period.activate();
    
    res.redirect("/admin/periods?success=Период оценивания активирован");
  } catch (error) {
    console.error("Ошибка активации периода:", error);
    res.redirect("/admin/periods?error=Ошибка активации периода");
  }
});

// Деактивация периода оценивания
router.post("/periods/:id/deactivate", async (req, res) => {
  try {
    const period = await EvaluationPeriod.findById(req.params.id);
    if (!period) {
      return res.redirect("/admin/periods?error=Период не найден");
    }

    await period.deactivate();
    res.redirect("/admin/periods?success=Период оценивания деактивирован");
  } catch (error) {
    console.error("Ошибка деактивации периода:", error);
    res.redirect("/admin/periods?error=Ошибка деактивации периода");
  }
});

// Удаление периода оценивания
router.delete("/periods/:id", async (req, res) => {
  try {
    const period = await EvaluationPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ error: "Период не найден" });
    }

    if (period.isActive) {
      return res.status(400).json({ error: "Нельзя удалить активный период" });
    }

    await EvaluationPeriod.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка удаления периода:", error);
    res.status(500).json({ error: "Ошибка удаления периода" });
  }
});

// Отчеты
router.get("/reports", async (req, res) => {
  try {
    const periods = await EvaluationPeriod.find({})
      .populate("groups", "name")
      .sort({ createdAt: -1 });
    
    res.render("admin/reports", {
      title: "Отчеты",
      periods: periods,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки отчетов:", error);
    res.render("admin/reports", {
      title: "Отчеты",
      periods: [],
      error: "Ошибка загрузки отчетов"
    });
  }
});

// Детальный отчет по периоду
router.get("/reports/period/:id", async (req, res) => {
  try {
    const period = await EvaluationPeriod.findById(req.params.id)
      .populate("groups", "name");
    
    if (!period) {
      return res.status(404).send("Период не найден");
    }

    // Получаем все команды из групп этого периода
    const teams = await Team.find({ 
      group: { $in: period.groups.map(g => g._id) },
      isActive: true
    }).populate("group", "name");

    // Получаем все оценки за этот период
    const evaluations = await Evaluation.find({ period: period._id })
      .populate({
        path: "criteria",
        populate: {
          path: "criterion",
          model: "Criterion"
        }
      });

    // Получаем все активные критерии
    const criteria = await Criterion.find({ isActive: true });

    // Группируем отчеты по группам
    const reportsByGroup = {};

    for (const group of period.groups) {
      const groupTeams = teams.filter(t => t.group._id.toString() === group._id.toString());
      
      const teamReportData = groupTeams.map(team => {
        const teamEvaluations = evaluations.filter(e => e.evaluatedTeam.toString() === team._id.toString());
        const totalScoreSum = teamEvaluations.reduce((sum, ev) => {
          const evaluationScore = ev.criteria.reduce((critSum, crit) => critSum + crit.score, 0);
          return sum + evaluationScore;
        }, 0);
        const overallAverage = teamEvaluations.length > 0 ? totalScoreSum / teamEvaluations.length : 0;

        return {
          teamName: team.name,
          teamId: team._id,
          overallAverage: overallAverage
        };
      });

      // Сортируем команды по общему среднему баллу
      teamReportData.sort((a, b) => b.overallAverage - a.overallAverage);
      
      reportsByGroup[group.name] = teamReportData;
    }

    // Статистика
    const allScoresSum = evaluations.reduce((sum, ev) => {
        const evaluationScore = ev.criteria.reduce((critSum, crit) => critSum + crit.score, 0);
        return sum + evaluationScore;
    }, 0);

    const stats = {
      totalTeams: teams.length,
      totalEvaluations: evaluations.length,
      averageScore: evaluations.length > 0 ? (allScoresSum / evaluations.length).toFixed(2) : 0,
    };

    res.render("admin/report-detail", {
      title: `Отчет по периоду: ${period.name}`,
      period: period,
      reportsByGroup: reportsByGroup,
      stats: stats,
      error: null
    });
  } catch (error) {
    console.error("Ошибка загрузки детального отчета:", error);
    res.status(500).send("Ошибка загрузки отчета");
  }
});

// Экспорт отчета в CSV
router.get("/reports/period/:id/export", async (req, res) => {
  try {
    const period = await EvaluationPeriod.findById(req.params.id)
      .populate("groups", "name");
    
    if (!period) {
      return res.status(404).send("Период не найден");
    }

    // Получаем все оценки за этот период
    const evaluations = await Evaluation.find({ period: period._id })
      .populate("evaluator", "name")
      .populate("evaluatedTeam", "name group")
      .populate("evaluatedTeam.group", "name");

    // Формируем CSV
    let csv = "Оценивающий,Оцениваемая команда,Группа,Общая оценка,Дата оценки\n";
    
    evaluations.forEach(eval => {
      const evaluatorName = eval.evaluator.name;
      const teamName = eval.evaluatedTeam.name;
      const groupName = eval.evaluatedTeam.group.name;
      const score = eval.totalScore;
      const date = new Date(eval.createdAt).toLocaleDateString('ru-RU');
      
      csv += `"${evaluatorName}","${teamName}","${groupName}",${score},"${date}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report-${period.name}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Ошибка экспорта отчета:", error);
    res.status(500).send("Ошибка экспорта отчета");
  }
});

module.exports = router;