const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
// require("dotenv").config();
const schedule = require("node-schedule"); // Импортируем node-schedule
const mongoose = require("mongoose");
const User = require("./models/User");

const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot is running"));

const defaultPairs = require("./defaultPairs"); // Импортируем массив из файла
const {
  generateButtons,
  getUsefulData,
  getPrices,
  updateDefaultPairsPrices,
  getAllUsers,
} = require("./utils");

const userRequestTimestamps = {};
const REQUEST_LIMIT_TIME = 120000; // 120 секунд

// Функция проверки, разрешен ли запрос
function isRequestAllowed(userId) {
  const now = Date.now();
  const lastRequestTime = userRequestTimestamps[userId];

  if (lastRequestTime && now - lastRequestTime < REQUEST_LIMIT_TIME) {
    return false; // Запрещаем запрос, если он был сделан слишком недавно
  }

  userRequestTimestamps[userId] = now; // Обновляем время последнего запроса Проверка
  return true;
}

// Подключение к MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.log("Error connecting to MongoDB:", err));

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Обновляем цены при старте бота
updateDefaultPairsPrices(defaultPairs);

bot.setMyCommands([
  { command: "/pairs", description: "Выбор пар" },
  { command: "/start", description: "Перезапуск" },
]);

bot.onText(/\/start/, async (msg) => {
  const formattedDate = await getUsefulData();
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name || "";
  const language = msg.from.language_code || "ru";
  const dateFirstLogin = formattedDate;

  const allowed = isRequestAllowed(userId);
  if (!allowed) {
    bot.sendMessage(
      msg.chat.id,
      "Повторные выполнения команд /start и /pairs разрешены не чаще 1 раза в минуту. Подождите."
    );
    return;
  }

  // Проверяем, есть ли пользователь в базе
  let user = await User.findOne({ userId });

  if (!user) {
    // Если пользователя нет, создаем нового с массивом отслеживаемых пар по умолчанию
    user = new User({
      userId,
      chatId,
      firstName,
      lastName,
      dateFirstLogin,
      language,
      trackedPairs: defaultPairs, // Массив отслеживаемых пар по умолчанию
    });
    await user.save();
    console.log(`User ${userId} created with default tracking pairs.`);
  } else {
    // Если пользователь найден, просто обновляем его chatId (если это нужно)
    console.log(`User ${userId} found and updated.`);
  }

  // Используем массив отслеживаемых пар из базы данных
  const trackedPairs = user.trackedPairs;

  // Приветственное сообщение
  const fName = msg.chat.first_name || "Пользователь";
  const lName = msg.chat.last_name || "";
  await bot.sendMessage(
    chatId,
    "Привет, " + fName + " " + (lName ? lName : "")
  );
  await bot.sendMessage(
    chatId,
    "Этот бот создан для отслеживания изменения курса основных криптовалют к доллару США в реальном времени.\n\n" +
      "Бот проверяет изменение цен один раз в минуту. \n\n" +
      "Данные о курсах криптовалют предоставлены CoinGecko. Подробнее: https://www.coingecko.com/\n\n" +
      "Вы можете выбрать валюты, которые будут отслеживаться. В случае изменения цены криптовалюты более чем на 1%, Вы получите уведомление от бота. " +
      "Вы можете включить или отключить отслеживание, нажав на соответствующую кнопку с названием пары.\n\n" +
      "Кнопки для перезапуска бота и показа списка пар находятся ниже в Меню.\n\n" +
      "Бот работает в тестовом режиме и совершенствуется. Пожалуйста, используйте информацию только как ориентир и проверяйте актуальные курсы на платформах, которыми вы пользуетесь."
  );
  // Получаем актуальные цены из defaultPairs
  // Отправляем цены без запроса к API
  const options = {
    reply_markup: {
      inline_keyboard: generateButtons(defaultPairs), // используем обновленные цены из defaultPairs
    },
  };

  bot.sendMessage(
    chatId,
    "Нажмите на кнопку ниже для выбора криптовалют:",
    options
  );
});

// Функция для проверки изменений цен
async function checkPriceChanges() {
  console.log("Проверяем изменения цен...");

  try {
    // Получаем всех пользователей из базы
    const users = await getAllUsers();

    if (users.length === 0) {
      console.log("Нет пользователей для проверки.");
      return;
    }

    // Собираем уникальные пары для запросов
    const pairsToTrack = [
      ...new Set(
        users.flatMap((user) =>
          user.trackedPairs
            .filter((pair) => pair.isTracked)
            .map((pair) => pair.pair)
        )
      ),
    ];

    if (pairsToTrack.length === 0) {
      console.log("Нет отслеживаемых пар.");
      return;
    }

    // Обновляем цены в defaultPairs
    await updateDefaultPairsPrices(defaultPairs);

    // Берем актуальные цены из defaultPairs
    const currentPrices = defaultPairs.reduce((acc, pair) => {
      acc[pair.pair] = { usd: pair.price };
      return acc;
    }, {});
    console.log(currentPrices);

    let pricesUpdated = false; // Флаг, указывающий на изменения

    // 2. Обновляем defaultPairs с новыми ценами
    defaultPairs.forEach((pair) => {
      const newPrice = currentPrices[pair.pair]?.usd || null;
      if (newPrice && pair.price !== newPrice) {
        pair.price = newPrice;
        console.log(
          `Цена пары ${pair.pair} обновлена в defaultPairs: ${newPrice}`
        );
        pricesUpdated = true; // Обновления были
      }
    });

    // 3. Проверяем изменения для каждой пары каждого пользователя
    const updatedUsers = [];
    for (const user of users) {
      let updated = false; // Флаг для отслеживания изменений

      for (const pair of user.trackedPairs.filter((p) => p.isTracked)) {
        const currentPrice = defaultPairs.find(
          (p) => p.pair === pair.pair
        )?.price;

        if (currentPrice) {
          const priceChange =
            Math.round(((currentPrice - pair.price) / pair.price) * 100 * 100) /
            100;

          // Устанавливаем порог в 1%
          if (Math.abs(priceChange) >= 1) {
            const formattedAbbreviation = pair.abbreviation.toUpperCase();
            console.log(
              `${priceChange > 0 ? "🟢" : "🔴"} Пользователь ${
                user.firstName
              }: Цена пары ${formattedAbbreviation}/USD изменилась на ${priceChange}%`
            );

            try {
              // Отслеживание на блокировку перед отправкой
              bot.sendMessage(
                user.chatId,
                `${
                  priceChange > 0 ? "🟢" : "🔴"
                } Цена пары ${formattedAbbreviation}/USD ${
                  priceChange > 0 ? "Выросла" : "Снизилась"
                } более чем на ${priceChange}%!\nСтарая цена: ${
                  pair.price
                }\nНовая цена: ${currentPrice}`
              );
            } catch (error) {
              if (error.code === 403) {
                // Если ошибка 403, значит, пользователь заблокировал бота
                console.log(`Пользователь ${user.firstName} заблокировал бота`);
                // Вы можете добавить дополнительную логику, например, удаление этого пользователя из базы данных
              } else {
                // Обработка других ошибок
                console.error(
                  "Произошла ошибка при отправке сообщения:",
                  error
                );
              }
            }

            pair.price = currentPrice; // Обновляем цену в базе данных
            updated = true; // Отмечаем, что пользователь был обновлен
          }
        }
      }

      if (updated) {
        updatedUsers.push(user);
      }
    }

    // 4. Обновляем всех измененных пользователей в базе
    await Promise.all(
      updatedUsers.map((user) =>
        User.updateOne(
          { userId: user.userId },
          { trackedPairs: user.trackedPairs }
        )
      )
    );
  } catch (error) {
    console.error("Ошибка при проверке изменений цен:", error.message);
  }
}

// Обработчик команды /pairs
bot.onText(/\/pairs/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Проверка на частоту запросов
  const allowed = isRequestAllowed(userId);
  if (!allowed) {
    bot.sendMessage(
      chatId,
      "Повторные выполнения команды /pairs разрешены не чаще 1 раза в 2 минуты. Подождите."
    );
    return;
  }

  try {
    // Находим пользователя в базе данных
    const user = await User.findOne({ userId });

    if (!user) {
      bot.sendMessage(chatId, "Пользователь не найден.");
      return;
    }

    // Используем trackedPairs для генерации кнопок
    const trackedPairs = user.trackedPairs;

    // Генерируем кнопки
    const options = {
      reply_markup: {
        inline_keyboard: generateButtons(trackedPairs),
      },
    };

    // Отправляем новое сообщение
    await bot.sendMessage(
      chatId,
      "Выберите пару / пары для отслеживания:",
      options
    );
  } catch (error) {
    console.error("Ошибка при обработке команды /pairs:", error);
    bot.sendMessage(chatId, "Произошла ошибка при обработке вашего запроса.");
  }
});

// Запускаем задачу раз в 20 секунд
schedule.scheduleJob("*/60 * * * * *", checkPriceChanges);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Обработка кнопки "Выбрать пары"
bot.on("callback_query", async (query) => {
  const { data, message, from } = query;
  const userId = from.id;

  // Находим пользователя в базе
  const user = await User.findOne({ userId });

  if (!user) {
    bot.answerCallbackQuery(query.id, { text: "Пользователь не найден!" });
    return;
  }

  const trackedPairs = user.trackedPairs;

  if (data === "select_pair") {
    // Получаем цены и только потом обновляем клавиатуру
    const pricesUpdated = await getPrices(trackedPairs, userId);

    if (pricesUpdated) {
      const options = {
        reply_markup: {
          inline_keyboard: generateButtons(trackedPairs),
        },
      };

      bot.editMessageText("Выберите пару для отслеживания:", {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: options.reply_markup,
      });
    } else {
      bot.answerCallbackQuery(query.id, { text: "Не удалось обновить цены!" });
    }
  } else {
    // Логика переключения состояния отслеживания
    const pairIndex = trackedPairs.findIndex((pair) => pair.pair === data);
    if (pairIndex !== -1) {
      trackedPairs[pairIndex].isTracked = !trackedPairs[pairIndex].isTracked;

      // Сохраняем обновленные данные в базе
      user.trackedPairs = trackedPairs;
      await user.save();

      const updatedKeyboard = generateButtons(trackedPairs);

      await bot.editMessageReplyMarkup(
        { inline_keyboard: updatedKeyboard },
        { chat_id: message.chat.id, message_id: message.message_id }
      );
    }
  }

  bot.answerCallbackQuery(query.id); // Убираем "часики" на кнопке
});
