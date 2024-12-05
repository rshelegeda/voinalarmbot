// Генерация кнопок с парами и ценами
function generateButtons(trackingPairs) {
    return trackingPairs.map(pair => {
      const symbol = pair.isTracked ? "✅" : ""; // Добавляем или убираем символ
      return [
        {
          text: `${pair.pair.toUpperCase()} ${symbol} - $${pair.price || 'Загрузка...'}`,
          callback_data: pair.pair,
        },
      ];
    });
  }
  

module.exports = generateButtons;  // Экспортируем функцию
