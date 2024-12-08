const axios = require("axios");
require('dotenv').config();
const User = require("./models/User"); // Предполагая, что модель пользователя находится в этом пути
const defaultPairs = require('./defaultPairs'); // Импортируем массив из файла

// Генерация кнопок с актуальными ценами
function generateButtons(trackingPairs) {
  const newButtons = [];
  for (let i = 0; i < trackingPairs.length; i += 2) {
    const row = [];
    
    // Первая кнопка
    row.push({
      text: `${trackingPairs[i].isTracked ? "✅" : ""} ${trackingPairs[i].abbreviation} - $${trackingPairs[i].price ? trackingPairs[i].price.toFixed(2) : "Загрузка..."}`,
      callback_data: trackingPairs[i].pair
    });
    
    // Вторая кнопка, если такая есть
    if (i + 1 < trackingPairs.length) {
      row.push({
        text: `${trackingPairs[i + 1].isTracked ? "✅" : ""} ${trackingPairs[i + 1].abbreviation} - $${trackingPairs[i + 1].price ? trackingPairs[i + 1].price.toFixed(2) : "Загрузка..."}`,
        callback_data: trackingPairs[i + 1].pair
      });
    }

    // Добавляем строку в массив кнопок
    newButtons.push(row);
  }
  return newButtons;
}

// Возвращает текущую дату и время в формате русской локали
const getUsefulData = async () => {
  const now = new Date();
  const formattedDate = now.toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return formattedDate;
};

// Функция для получения актуальных цен
// Получаем актуальные цены из массива defaultPairs вместо запроса к API
async function getPrices(trackedPairs, userId) {
  try {
    let pricesChanged = false;
    
    // Проходим по отслеживаемым парам
    trackedPairs.forEach(pair => {
      // Находим цену из defaultPairs
      const defaultPair = defaultPairs.find(dPair => dPair.pair === pair.pair);
      if (defaultPair && defaultPair.price !== pair.price) {
        pair.price = defaultPair.price; // Обновляем цену из defaultPairs
        pricesChanged = true;
      }
    });

    // Если цены обновились, сохраняем их в базе данных
    if (pricesChanged) {
      const user = await User.findOne({ userId });
      if (user) {
        user.trackedPairs = trackedPairs;
        await user.save();
      }
    }

    return pricesChanged; // Возвращаем, были ли обновления
  } catch (error) {
    console.error("Ошибка при обновлении цен из defaultPairs:", error);
    return false;
  }
}


// Обновление по АПИ
// async function getPrices(trackingPairs, userId) {
//   try {
//     console.log("Запрос к АПИ из getPrices");
//     const response = await axios.get(
//         process.env.COINGECKO_API_URL,
//       {
//         params: {
//           ids: trackingPairs.map((pair) => pair.pair).join(","),
//           vs_currencies: "usd",
//         },
//       }
//     );

//     let pricesChanged = false;

//     trackingPairs.forEach((pair) => {
//       const newPrice = response.data[pair.pair]
//         ? response.data[pair.pair].usd
//         : null;
//       if (pair.price !== newPrice) {
//         pair.price = newPrice;
//         pricesChanged = true;
//       }
//     });

//     // Сохраняем обновленные цены в базе
//     if (pricesChanged) {
//       const user = await User.findOne({ userId });
//       if (user) {
//         user.trackedPairs = trackingPairs;
//         await user.save();
//       }
//     }

//     return pricesChanged;
//   } catch (error) {
//     console.error("Ошибка при получении цен:", error);
//     return false;
//   }
// };


// Функция для обновления цен в массиве defaultPairs
async function updateDefaultPairsPrices(defaultPairs) {
  console.log('Запрос async function updateDefaultPairsPrices(defaultPairs)');
  try {
    const response = await axios.get(
        process.env.COINGECKO_API_URL,
      {
        params: {
          ids: defaultPairs.map((pair) => pair.pair).join(","),
          vs_currencies: "usd",
        },
      }
    );

    // Обновляем цены в defaultPairs
    defaultPairs.forEach((pair) => {
      const newPrice = response.data[pair.pair]?.usd || null;
      pair.price = newPrice;
    });

    console.log("Цены обновлены в defaultPairs.");
  } catch (error) {
    console.error("Ошибка при обновлении цен:", error);
  }
};


async function getAllUsers() { // Не берем тех юзеров, у которых включен флаг блокировки
  try {
    // Ищем только тех пользователей, у которых isBlocked не установлен в true
    const users = await User.find({ isBlocked: { $ne: true } });
    return users;
  } catch (error) {
    console.error("Ошибка при получении пользователей:", error.message);
    return [];
  }
};




// // Функция для получения всех пользователей и их данных
// async function getAllUsers() {
//     try {
//       const users = await User.find();
//       return users;
//     } catch (error) {
//       console.error("Error fetching users:", error);
//       return [];
//     }
//   }

module.exports = { generateButtons, getUsefulData, getPrices, updateDefaultPairsPrices, getAllUsers };
