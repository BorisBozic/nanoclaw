#!/bin/bash
# Stop hook — scans the agent's final response before sending to Telegram.
# Exit 0 = allow, Exit 2 = block (response not sent).

RESULT=$(node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const input = JSON.parse(data);
    const text = JSON.stringify(input);
    // Credit card pattern
    if (/[0-9]{4}[- ][0-9]{4}[- ][0-9]{4}[- ][0-9]{4}/.test(text)) {
      process.stderr.write('Blocked: response contains credit card pattern');
      process.stdout.write('block');
      return;
    }
    // Australian TFN pattern
    if (/[0-9]{3} [0-9]{3} [0-9]{3}/.test(text)) {
      process.stderr.write('Blocked: response contains TFN pattern');
      process.stdout.write('block');
      return;
    }
    // Medicare number pattern
    if (/[0-9]{4} [0-9]{5} [0-9]/.test(text)) {
      process.stderr.write('Blocked: response contains Medicare number pattern');
      process.stdout.write('block');
      return;
    }
    process.stdout.write('allow');
  });
")

if [ "$RESULT" = "block" ]; then
  exit 2
fi
exit 0
