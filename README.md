# UApply AI Assistant

A conversational AI assistant built with `assistant-ui` and Next.js, designed to guide students through a university application process. The assistant collects user information and stores it in MongoDB.

## Features

- Conversational AI powered by OpenAI GPT-4o
- Guided university application flow (one question at a time)
- Stores user responses in MongoDB using Mongoose
- Modern UI using `@assistant-ui/react`
- Customizable prompt and assistant behavior

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/uapply-ai-assistant.git
cd uapply-ai-assistant
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add environment variables

Create a `.env.local` file:

```env
OPENAI_API_KEY=your-openai-api-key
MONGODB_URL=your-mongodb-connection-url
```

### 4. Run the development server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the assistant.

## 🛠️ File Structure

- `/app/page.tsx` – Main assistant UI
- `/app/api/chat/route.ts` – API route handling the chat and MongoDB storage
- `/lib/database/mongodb.ts` – MongoDB connection helper
- `/lib/database/models/Application.ts` – Mongoose model for applications

## 📦 Application Fields Collected

- Full Name
- Date of Birth
- Email Address
- Phone Number
- Previous School
- Desired Program

After collecting all fields, the application is saved to MongoDB.

## 📄 License

MIT
