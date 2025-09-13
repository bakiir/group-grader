const express = require("express");
const {body, validationResult } = require("express-validator");
const User = require("../models/User");
const Group = require("../models/Group");
const router = express.Router();

// Страница входа
router.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/");
  }
  res.render("auth/login", { 
    title: "Вход в систему",
    error: req.query.error 
  });
});

// Обработка входа
router.post("/login", [
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("auth/login", {
        title: "Вход в систему",
        error: "Некорректные данные",
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email, isActive: true });

    if (!user || !(await user.comparePassword(password))) {
      return res.render("auth/login", {
        title: "Вход в систему",
        error: "Неверный email или пароль"
      });
    }

    // Сохранение данных в сессии
    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.role = user.role;

    // Обновление времени последнего входа
    user.lastLogin = new Date();
    await user.save();

    res.redirect("/");
  } catch (error) {
    console.error("Ошибка входа:", error);
    res.render("auth/login", {
      title: "Вход в систему",
      error: "Произошла ошибка при входе"
    });
  }
});

// Страница регистрации для группы
router.get("/register/:groupId", async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group || !group.isActive) {
      return res.render("auth/register", {
        title: "Регистрация",
        error: "Группа не найдена или неактивна",
        group: null
      });
    }

    res.render("auth/register", {
      title: "Регистрация в группе",
      group: group,
      error: req.query.error
    });
  } catch (error) {
    console.error("Ошибка получения группы:", error);
    res.render("auth/register", {
      title: "Регистрация",
      error: "Ошибка загрузки группы",
      group: null
    });
  }
});

// Обработка регистрации
router.post("/register/:groupId", [
  body("name").trim().isLength({ min: 2, max: 50 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Пароли не совпадают");
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const group = await Group.findById(req.params.groupId);
      return res.render("auth/register", {
        title: "Регистрация в группе",
        group: group,
        error: "Некорректные данные",
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;
    const groupId = req.params.groupId;

    // Проверка существования пользователя
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const group = await Group.findById(groupId);
      return res.render("auth/register", {
        title: "Регистрация в группе",
        group: group,
        error: "Пользователь с таким email уже существует"
      });
    }

    // Проверка группы
    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      return res.render("auth/register", {
        title: "Регистрация",
        error: "Группа не найдена или неактивна",
        group: null
      });
    }

    // Проверка лимита студентов в группе
    if (group.currentStudents >= group.maxStudents) {
      return res.render("auth/register", {
        title: "Регистрация в группе",
        group: group,
        error: "Группа заполнена"
      });
    }

    // Создание пользователя
    const user = new User({
      name,
      email,
      password,
      group: groupId,
      role: "student"
    });

    await user.save();

    // Обновление счетчика студентов в группе
    await group.updateStudentCount();

    res.render("auth/success", {
      title: "Регистрация успешна",
      message: "Вы успешно зарегистрированы в группе! Теперь вы можете войти в систему."
    });

  } catch (error) {
    console.error("Ошибка регистрации:", error);
    const group = await Group.findById(req.params.groupId);
    res.render("auth/register", {
      title: "Регистрация в группе",
      group: group,
      error: "Произошла ошибка при регистрации"
    });
  }
});

// Выход из системы
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Ошибка при выходе:", err);
    }
    res.redirect("/auth/login");
  });
});

module.exports = router;
