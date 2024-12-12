const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
// require("dotenv").config();
const schedule = require("node-schedule"); // Импортируем node-schedule
const mongoose = require("mongoose");
const User = require("./models/User");
const messages = require("./localization");

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
const REQUEST_LIMIT_TIME = 10000; // 10 секунд
// const REQUEST_LIMIT_TIME = 600000; // 600 секунд

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
  { command: "/language", description: "RU/EN" },
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
      "Повторные выполнения команды /start разрешены не чаще 1 раза в 10 минут. Подождите."
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
      botLanguage: "ru",
    });
    await user.save();
    console.log(`User ${userId} created with default tracking pairs.`);
  } else {
    // Если пользователь найден, и блокировка включена - снимаем флаг блокировки
    if (user.isBlocked) {
      await User.updateOne({ chatId }, { isBlocked: false });
      console.log(
        `Флаг блокировки снят для пользователя ${firstName} (${chatId}).`
      );
    } else {
      console.log(`Пользователь ${firstName} (${chatId}) уже активен.`);
    }
    console.log(`User ${userId} found and updated.`);
  }

  // Используем массив отслеживаемых пар из базы данных
  const trackedPairs = user.trackedPairs;

  // Приветственное сообщение
  const fName = msg.chat.first_name || "Пользователь";
  const lName = msg.chat.last_name || "";
  await bot.sendMessage(
    chatId,
    user.botLanguage === "ru"
      ? "Привет, " + fName + " " + (lName ? lName : "")
      : "Hello, " + fName + " " + (lName ? lName : "")
  );
  await bot.sendMessage(
    chatId,
    user.botLanguage === "ru"
      ? messages.botDescription.ru
      : messages.botDescription.en
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
    user.botLanguage === "ru"
      ? "Нажмите на кнопку ниже для выбора криптовалют:"
      : "Click the button below to select cryptocurrencies:",
    options
  );
});

// Функция для проверки изменений цен
async function checkPriceChanges() {
  console.log("Проверяем изменения цен...");

  try {
    const users = await getAllUsers();

    if (users.length === 0) {
      console.log("Нет пользователей для проверки.");
      return;
    }

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

    await updateDefaultPairsPrices(defaultPairs);

    const currentPrices = defaultPairs.reduce((acc, pair) => {
      acc[pair.pair] = { usd: pair.price };
      return acc;
    }, {});
    console.log("\n Актуальные цены:", currentPrices);

    const sendMessages = [];

    for (const user of users) {
      for (const pair of user.trackedPairs.filter((p) => p.isTracked)) {
        const currentPrice = defaultPairs.find(
          (p) => p.pair === pair.pair
        )?.price;

        if (currentPrice) {
          const priceChange =
            Math.round(((currentPrice - pair.price) / pair.price) * 100 * 100) /
            100;

          const formattedAbbreviation = pair.abbreviation.toUpperCase();

          if (Math.abs(priceChange) >= 1) {
            const message =
              user.botLanguage === "ru"
                ? messages.priceChangeNotification.ru(
                    formattedAbbreviation,
                    priceChange,
                    pair.price,
                    currentPrice
                  )
                : messages.priceChangeNotification.en(
                    formattedAbbreviation,
                    priceChange,
                    pair.price,
                    currentPrice
                  );

            console.log(
              `${priceChange > 0 ? "🟢" : "🔴"} Пользователь ${
                user.firstName
              }: Цена пары ${formattedAbbreviation}/USD изменилась на ${priceChange}%`
            );

            sendMessages.push(
              bot
                .sendMessage(user.chatId, message)
                .then(() => {
                  pair.price = currentPrice;
                })
                .catch(async (error) => {
                  if (
                    error.response &&
                    error.response.body.error_code === 403
                  ) {
                    console.log(
                      `❌ Пользователь ${user.firstName} (${user.chatId}) заблокировал бота.`
                    );
                    // Обновляем флаг isBlocked
                    await User.updateOne(
                      { userId: user.userId },
                      { isBlocked: true }
                    );
                  } else {
                    console.error(
                      `Ошибка при отправке сообщения пользователю с chatId ${user.chatId}:`,
                      error.message
                    );
                  }
                })
            );
          }
        }
      }
    }

    if (sendMessages.length > 0) {
      const results = await Promise.allSettled(sendMessages);

      const successCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const failureCount = results.length - successCount;

      console.log(
        `Сообщения отправлены: ${successCount}, Ошибки отправки: ${failureCount}`
      );
    } else {
      console.log("Нет сообщений для отправки.");
    }

    const updatedUsers = users.filter((user) =>
      user.trackedPairs.some((pair) => pairsToTrack.includes(pair.pair))
    );

    await Promise.all(
      updatedUsers.map((user) =>
        User.updateOne(
          { userId: user.userId },
          { trackedPairs: user.trackedPairs }
        )
      )
    );

    console.log("Проверка завершена успешно.");
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
      "Повторные выполнения команды /pairs разрешены не чаще 1 раза в 10 минут. Подождите.\n\n" +
        "Repeated executions of the /pairs command are allowed no more than once every 10 minutes. Please wait."
    );
    return;
  }

  try {
    // Находим пользователя в базе данных
    const user = await User.findOne({ userId });

    if (!user) {
      bot.sendMessage(
        chatId,
        "Пользователь не найден.\n\n" + "User not found."
      );
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
      user.botLanguage === "ru"
        ? "Выберите пару / пары для отслеживания:"
        : "Select pair(s) to track:",
      options
    );
  } catch (error) {
    console.error("Ошибка при обработке команды /pairs:", error);
    bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса\n\n." +
        "An error occurred while processing your request."
    );
  }
});

// Обработчик команды /language
bot.onText(/\/language/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Проверка на частоту запросов
  const allowed = isRequestAllowed(userId);
  if (!allowed) {
    bot.sendMessage(
      chatId,
      "Повторные выполнения команды /pairs разрешены не чаще 1 раза в 10 минут. Подождите.\n\n" +
        "Repeated executions of the /pairs command are allowed no more than once every 10 minutes. Please wait."
    );
    return;
  }

  try {
    // Находим пользователя в базе данных
    const user = await User.findOne({ userId });

    if (!user) {
      bot.sendMessage(
        chatId,
        "Пользователь не найден.\n\n" + "User not found."
      );
      return;
    }
    user.botLanguage === "ru"
      ? await User.updateOne({ userId }, { $set: { botLanguage: "en" } })
      : await User.updateOne({ userId }, { $set: { botLanguage: "ru" } });

    // Отправляем новое сообщение
    await bot.sendMessage(
      chatId,
      user.botLanguage === "en"
        ? "Теперь бот использует русский язык."
        : "Now the bot is using English."
    );
  } catch (error) {
    console.error("Ошибка при обработке команды /language:", error);
    bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке смены языка\n\n." +
        "An error occurred while processing language change."
    );
  }
});

// Запускаем задачу раз в 60 секунд
// schedule.scheduleJob("*/60 * * * * *", checkPriceChanges); // Каждую минуту
// schedule.scheduleJob("*/10 * * * *", checkPriceChanges); // Каждые 10 минут
schedule.scheduleJob("*/6 * * * *", checkPriceChanges); // Каждые 6 минут

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
    console.log(
      "Вызов из bot.on(callback_query, async (query) => {... if (data === select_pair)"
    );

    if (pricesUpdated) {
      const options = {
        reply_markup: {
          inline_keyboard: generateButtons(trackedPairs),
        },
      };

      bot.editMessageText(
        user.botLanguage === "ru"
          ? "Выберите пару для отслеживания:"
          : "Select pair(s) to track:",
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: options.reply_markup,
        }
      );
    } else {
      bot.answerCallbackQuery(query.id, {
        text:
          user.botLanguage === "ru"
            ? "Не удалось обновить цены!"
            : "Failed to update prices!",
      });
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
