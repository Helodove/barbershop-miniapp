import { Bot } from 'grammy';

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('BOT_TOKEN environment variable is required');
  process.exit(1);
}

const bot = new Bot(token);

bot.command('start', (ctx) => ctx.reply('Барбершоп — бот запущен!'));

bot.start();
console.log('Bot started successfully');
