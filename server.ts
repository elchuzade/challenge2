const pgPromise = require('pg-promise');
const R = require('ramda');
const request = require('request-promise');
const readline = require('readline');

// Limit the amount of debugging of SQL expressions
const trimLogsSize: number = 200;

// Database interface
interface DBOptions {
  host: string;
  database: string;
  user?: string;
  password?: string;
  port?: number;
}

// Actual database options
const options: DBOptions = {
  user: 'kamranelchuzade',
  password: 'postgres',
  host: 'localhost',
  database: 'mydb'
};

console.info(
  'Connecting to the database:',
  `${options.user}@${options.host}:${options.port}/${options.database}`
);

const pgpDefaultConfig = {
  promiseLib: require('bluebird'),
  // Log all queries
  query(query) {
    console.log('[SQL   ]', R.take(trimLogsSize, query.query));
  },
  // On error, please show me the SQL
  error(err, e) {
    if (e.query) {
      console.error('[SQL   ]', R.take(trimLogsSize, e.query), err);
    }
  }
};

interface GithubUsers {
  id: number;
  location: string;
  name: string;
  company: string;
  login: string;
  public_repos: number;
}

const pgp = pgPromise(pgpDefaultConfig);
const db = pgp(options);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const initialMessage =
  'Please type a github username to add to our db or use menu to read our db: 1 - lisbon, 2 - stats : ';
rl.question(`Hello there! ${initialMessage}`, answer => {
  let msg = answerCheck(answer);
  userReplay(msg);
});
rl.on('close', () => {
  console.log('Have a nice day! :)');
});

const answerCheck = answer => {
  let msg = '';
  if (answer.trim().length > 39) {
    // Github does not accept usernames longer than 39 characters
    console.log('username must be between 1 and 39 characters');
  } else if (answer.length === 0) {
    console.log(
      'empty username definitely does not exist on github, try again'
    );
  } else if (answer === '1') {
    console.log('lisbon stuff');
    msg = 'you are checking a lisbon stuff ';
  } else if (answer === '2') {
    console.log('table stuff');
    msg = 'you are checking a table stuff ';
  } else {
    console.log('add a user to db');

    db.none(
      'CREATE TABLE IF NOT EXISTS github_users (id BIGSERIAL, login TEXT, name TEXT, company TEXT, public_repos INTEGER, location TEXT)'
    ).then(() => {
      db.query('SELECT * FROM github_users where login = $1', [
        answer.trim()
      ]).then(result => {
        if (result.length > 0) {
          console.log('this name already exists');
          // process.exit(0);
          msg = 'This github user name already exists, try another one! ';
          console.log(
            `This github user name already exists, try another one! ${initialMessage}`
          );
          return;
        } else {
          return request({
            uri: `https://api.github.com/users/${answer}`,
            headers: {
              'User-Agent': 'Request-Promise'
            },
            json: true
          })
            .then((data: GithubUsers) =>
              db.one(
                'INSERT INTO github_users (login, name, company, public_repos, location) VALUES ($[login], $[name], $[company], $[public_repos], $[location]) RETURNING id',
                data
              )
            )
            .then(({ id }) => {
              msg = `Great, you have added a new user number ${id} and you can add more users! `;
              console.log(
                `Great, you have added a new user number ${id} and you can add more users! ${initialMessage}`
              );
            });
        }
      });
    });
  }
  return msg;
};

const userReplay = msg => {
  rl.setPrompt(`${msg} ${initialMessage}`);
  rl.prompt();
  rl.on('line', answer => {
    let msg = answerCheck(answer);
    rl.setPrompt(`${msg}${initialMessage}`);
    rl.prompt();
  });
};
