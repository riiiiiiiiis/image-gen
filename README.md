# SDXL Emoji Pipeline

## tech

Next.js / Gemini AI / Replicate SDXL-emoji

### Как запустить проект

1. **Установите зависимости:**
```bash
npm install
```

2. **Создайте файл `.env.local` с API ключами:**
```env
GEMINI_API_KEY=ваш_ключ_google_gemini
REPLICATE_API_TOKEN=ваш_токен_replicate
```

3. **Запустите проект:**
```bash
npm run dev
```

4. **Откройте в браузере:** [http://localhost:3000](http://localhost:3000)

### Как это работает

1. **Загрузка данных**: Загрузите JSON файл со словами (формат: original_text, translation_text, transcription)
2. **Категоризация**: Нажмите "Categorize All Uncategorized" - AI определит тип слова для оптимальной генерации
3. **Генерация промптов**: Нажмите "Generate All Prompts" - AI создаст описания сцен в стиле эмодзи
4. **Создание изображений**: Нажмите "Generate Image" - SDXL-emoji создаст уникальные картинки
5. **Галерея**: Просмотрите результаты, оцените качество (✅/❌)
6. **Экспорт**: Скачайте улучшенный датасет с промптами и картинками

**Важно**: Все промпты автоматически начинаются с "TOK emoji of" - это активирует стиль эмодзи!

### Экономия ресурсов

Для тестирования используйте пакетную обработку по N записей вместо полной загрузки:
- **Категоризация**: обрабатывает по 10 слов за раз
- **Генерация промптов**: можно запускать для выбранного количества записей

### Настройки

**Модель Gemini**: `lib/gemini.ts` - строка с `model: 'gemini-2.5-flash-preview-05-20'`

**Промпт категоризации**: `app/api/categorize-vocabulary/route.ts` - промпт с категориями CONCRETE-VISUAL, ABSTRACT-SYMBOLIC и т.д.

**Шаблон промпта для изображений**: `lib/gemini.ts` - функция `generatePrompt()`, правила генерации объектов

**Настройки SDXL-emoji**: `lib/replicateConfig.ts`
- Модель: `fofr/sdxl-emoji`
- Префикс промпта: `A TOK emoji of` (обязательно!)
- Параметры: lora_scale: 0.6, guidance_scale: 7.5, num_inference_steps: 50