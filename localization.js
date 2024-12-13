// Объект с фразами на двух языках
const messages = {
    startLimit: {
      en: "Repeated executions of the /start /pairs /language command are allowed no more than once every 10 minutes. Please wait.",
      ru: "Повторные выполнения команды /start разрешены не чаще 1 раза в 10 минут. Подождите.",
    },
    user: {
      en: "User",
      ru: "Пользователь",
    },
    botDescription: {
      en: "This bot is designed to track changes in the exchange rates of major cryptocurrencies against the US dollar in real-time.\n\n" +
          "The bot checks price changes once a minute.\n\n" +
          "Cryptocurrency rates are provided by CoinGecko. More details: https://www.coingecko.com/\n\n" +
          "You can select currencies to track. If the cryptocurrency price changes by more than 1%, you will receive a notification from the bot. " +
          "You can enable or disable tracking by clicking on the respective button with the pair name.\n\n" +
          "Buttons to restart the bot and display the list of pairs are located below in the Menu.\n\n" +
          "The bot is in testing mode and is being improved. Please use the information as a guide and verify current rates on the platforms you use.",
      ru: "Этот бот создан для отслеживания изменения курса основных криптовалют к доллару США в реальном времени.\n\n" +
          "Бот проверяет изменение цен один раз в минуту. \n\n" +
          "Данные о курсах криптовалют предоставлены CoinGecko. Подробнее: https://www.coingecko.com/\n\n" +
          "Вы можете выбрать валюты, которые будут отслеживаться. В случае изменения цены криптовалюты более чем на 1%, Вы получите уведомление от бота. " +
          "Вы можете включить или отключить отслеживание, нажав на соответствующую кнопку с названием пары.\n\n" +
          "Кнопки для перезапуска бота и показа списка пар находятся ниже в Меню.\n\n" +
          "Бот работает в тестовом режиме и совершенствуется. Пожалуйста, используйте информацию только как ориентир и проверяйте актуальные курсы на платформах, которыми вы пользуетесь.",
    },
    selectCurrency: {
      en: "Click the button below to select cryptocurrencies:",
      ru: "Нажмите на кнопку ниже для выбора криптовалют:",
    },
    priceChangeNotification: {
      en: (formattedAbbreviation, priceChange, pairPrice, currentPrice) =>
        `${priceChange > 0 ? "🟢" : "🔴"} The price of ${formattedAbbreviation}/USD ${
          priceChange > 0 ? "increased" : "decreased"
        } by more than ${priceChange}%!\nOld price: ${pairPrice}\nNew price: ${currentPrice}`,
      ru: (formattedAbbreviation, priceChange, pairPrice, currentPrice) =>
        `${priceChange > 0 ? "🟢" : "🔴"} Цена пары ${formattedAbbreviation}/USD ${
          priceChange > 0 ? "выросла" : "снизилась"
        } более чем на ${priceChange}%!\nСтарая цена: ${pairPrice}\nНовая цена: ${currentPrice}`,
    },
    pairsLimit: {
      en: "Repeated executions of the /pairs command are allowed no more than once every 10 minutes. Please wait.",
      ru: "Повторные выполнения команды /pairs разрешены не чаще 1 раза в 10 минут. Подождите.",
    },
    userNotFound: {
      en: "User not found.",
      ru: "Пользователь не найден.",
    },
    selectPairs: {
      en: "Select pair(s) to track:",
      ru: "Выберите пару / пары для отслеживания:",
    },
    priceUpdateError: {
      en: "Failed to update prices!",
      ru: "Не удалось обновить цены!",
    },
    commandDescriptions: {
      ru: [
        { command: "/pairs", description: "Выбор пар" },
        { command: "/start", description: "Перезапуск" },
        { command: "/language", description: "RU/EN" },
      ],
      en: [
        { command: "/pairs", description: "Choose pairs" },
        { command: "/start", description: "Restart" },
        { command: "/language", description: "RU/EN" },
      ],
    }
  };
  
  module.exports = messages;