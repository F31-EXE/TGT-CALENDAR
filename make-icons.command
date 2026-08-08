#!/bin/bash
# Генерация иконок/сплэша из логотипа средствами macOS (sips).
# 1) Сохрани логотип как  mobile/assets/logo-src.png
# 2) Дважды кликни по этому файлу в Finder (или: bash make-icons.command)
cd "$(dirname "$0")" || exit 1

SRC="assets/logo-src.png"
BG="191c13"   # тёмный фон под эмблему (как в приложении)

if [ ! -f "$SRC" ]; then
  echo "❌ Не найден файл assets/logo-src.png"
  echo "   Сохрани логотип как logo-src.png в папку mobile/assets и запусти снова."
  exit 1
fi

tmp="assets/_src.png"
sips -s format png "$SRC" --out "$tmp" >/dev/null 2>&1

# Иконка приложения (1024×1024): вписываем эмблему и добиваем до квадрата фоном
sips --resampleHeightWidthMax 1000 "$tmp" --out "assets/_i.png" >/dev/null 2>&1
sips --padToHeightWidth 1024 1024 --padColor "$BG" "assets/_i.png" --out "assets/icon.png" >/dev/null 2>&1

# Сплэш — то же изображение
cp "assets/icon.png" "assets/splash-icon.png"

# Android adaptive: больше поля по краям, т.к. система обрезает иконку в круг
sips --resampleHeightWidthMax 760 "$tmp" --out "assets/_a.png" >/dev/null 2>&1
sips --padToHeightWidth 1024 1024 --padColor "$BG" "assets/_a.png" --out "assets/adaptive-icon.png" >/dev/null 2>&1

# Favicon для веба
sips --resampleHeightWidthMax 48 "assets/icon.png" --out "assets/favicon.png" >/dev/null 2>&1

rm -f "$tmp" "assets/_i.png" "assets/_a.png"
echo "✅ Готово! В mobile/assets созданы: icon.png, splash-icon.png, adaptive-icon.png, favicon.png"
echo "   Перезапусти приложение: npx expo start -c"
