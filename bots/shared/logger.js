// Shared logging utility

export function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

export function createLogger(botName) {
  return function(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, bot: botName, message, ...data };
    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  };
}

export default { log, createLogger };
