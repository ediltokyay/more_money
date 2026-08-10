#!/usr/bin/env node
/**
 * Sahte Cursor CLI — gercek binary olmadan cursor saglayicisini test etmek icin.
 * `agent -p [bayraklar] --model X --output-format text <prompt>` cagrisini taklit eder
 * ve gordugu model/prompt bilgisini JSON olarak geri yazar.
 */
const argv = process.argv.slice(2);
const model = argv[argv.indexOf('--model') + 1] || null;
const tireTire = argv.indexOf('--');
const promptArgv =
  tireTire >= 0
    ? argv.slice(tireTire + 1)
    : argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--model' && argv[i - 1] !== '--output-format');

function yaz(mod, prompt) {
  process.stdout.write(
    'Calisiyor...\n' +
      JSON.stringify({
        ok: true,
        model,
        mod,
        promptUzunluk: prompt.length,
        bayraklar: argv.filter((a) => a.startsWith('-') && a !== '--')
      }) +
      '\n'
  );
}

if (promptArgv.length) {
  yaz('argv', promptArgv.join(' '));
} else {
  let veri = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (veri += d));
  process.stdin.on('end', () => yaz('stdin', veri));
}
