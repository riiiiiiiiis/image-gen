# SDXL Emoji Pipeline

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/sdxl-emoji-pipeline)

## tech

Next.js / Gemini AI / Replicate SDXL-emoji / Vercel Postgres / Vercel Blob

## Environment Variables for Vercel Deployment

Make sure to set these environment variables in your Vercel project settings:

| Variable                | Description                               | Example Value                      |
|-------------------------|-------------------------------------------|------------------------------------|
| `DATABASE_URL`          | Vercel Postgres Connection String         | `postgres://...`                   |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Read/Write Token            | `vercel_blob_rw_...`               |
| `GEMINI_API_KEY`        | Google Gemini API Key                     | `your_google_gemini_key`           |
| `REPLICATE_API_TOKEN`   | Replicate API Token                       | `your_replicate_token`             |
| `OPENROUTER_API_KEY`    | OpenRouter API Key (optional, has default) | `sk-or-v1...`                      |

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

## Database Migration for Vercel

After setting up your Vercel Postgres database:

1. Get your `DATABASE_URL` from the Vercel dashboard
2. Run database migrations: `npx kysely migrate up --url "$DATABASE_URL"`

## Backup Recommendations (Vercel)

- **Vercel Postgres:** It is highly recommended to enable daily snapshots for your Postgres instance through the Vercel dashboard.
- **Vercel Blob:** For critical data in Vercel Blob, consider implementing a script or strategy for periodic backups. Refer to Vercel's documentation for available options and best practices.