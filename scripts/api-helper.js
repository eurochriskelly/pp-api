const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const apis = [
  { name: 'nextup', description: 'Get next matches for a tournament' },
];

console.log('Select an API to call:');
apis.forEach((api, index) => {
  console.log(`${index + 1}. ${api.name} - ${api.description}`);
});

rl.question('Enter your choice (number): ', (answer) => {
  const choice = parseInt(answer);
  if (choice > 0 && choice <= apis.length) {
    console.log(apis[choice - 1].name);
  } else {
    console.error('Invalid choice');
    process.exit(1);
  }
  rl.close();
});
