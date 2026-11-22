import readline from 'node:readline';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const statusFile = join(dirname(fileURLToPath(import.meta.url)), '.startup-status.json');
function status(stage) {
  try { writeFileSync(statusFile, JSON.stringify({stage, updatedAt:new Date().toISOString()}), {mode:0o600}); }
  catch { /* Diagnostics must not stop the server. */ }
}
status('starting');

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  status('interactive_terminal_required');
  console.error('대화형 터미널에서 실행해 주세요.');
  process.exit(1);
}
async function readCredentials() {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const values = [];
    let value = '';
    status('awaiting_app_key');
    process.stdout.write('APP KEY: ');
    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    const done = () => { input.off('keypress', onKey); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    function onKey(text, key) {
      if (key?.ctrl && key.name === 'c') { done(); reject(new Error('입력이 취소되었습니다.')); }
      else if (key?.name === 'return' || key?.name === 'enter') {
        values.push(value); value = '';
        if (values.length === 2) { done(); resolve(values); }
        else { status('awaiting_app_secret'); process.stdout.write('\nAPP Secret: '); }
      } else if (key?.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key?.ctrl && !key?.meta && !key?.name?.startsWith('escape')) value += text;
    }
    input.on('keypress', onKey); input.resume();
  });
}
try {
  console.log('나무 PLUG의 인증키를 입력하세요. 입력 내용은 표시되지 않습니다.');
  const [key, secretValue] = await readCredentials();
  status('credentials_entered');
  if (!key || !secretValue) throw new Error('APP KEY와 APP Secret이 모두 필요합니다.');
  process.env.NHPLUG_APP_KEY = key;
  process.env.NHPLUG_APP_SECRET = secretValue;
  await import('./server.mjs');
  status('server_start_requested');
  console.log('브라우저에서 http://127.0.0.1:8766/ 을 열어주세요. 종료: Ctrl+C');
} catch (err) {
  status('startup_failed');
  console.error(err.message);
  process.exitCode = 1;
}
