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

const initialMessage =
  'Please, type a github username to add to our db or type "-" to see users from Lisbon or "+" to see count of users per location : ';

const pgp = pgPromise(pgpDefaultConfig);
const db = pgp(options);

db.none(
  'CREATE TABLE IF NOT EXISTS github_users (id BIGSERIAL, login TEXT, name TEXT, company TEXT, public_repos INTEGER, location TEXT)'
).then(() => {
  console.log('Github users table exists, you can start using the app');
  rl.question(`Hello there! ${initialMessage}`, answer => {
    answerCheck(answer)
      .then(msg => {
        userReplay(msg);
      })
      .catch(msg => {
        userReplay(msg);
      });
  });
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('close', () => {
  console.log('Have a nice day! :)');
});

const answerCheck = answer => {
  return new Promise((resolve, reject) => {
    let msg = '';
    if (answer.length > 39) {
      // Github does not accept usernames longer than 39 characters
      msg = 'Username must be between 1 and 39 characters! ';
      resolve(msg);
    } else if (answer.length === 0) {
      msg = 'Empty username definitely does not exist on github, try again! ';
      resolve(msg);
    } else if (answer === '-') {
      // Showing all users from Lisbon regardless letter capitalization
      db.query('SELECT * FROM github_users WHERE location in ($1, $2, $3)', [
        'Lisbon',
        'LISBON',
        'lisbon'
      ])
        .then(result => {
          if (result.length > 0) {
            msg = 'Github users from Lisbon! ';
            console.log(result);
            resolve(msg);
          } else {
            msg =
              'Sorry no one in our db is from Lisbon, try adding jcristovao and check it again :) ';
            resolve(msg);
          }
        })
        .catch(err => {
          console.log(err);
          reject(err);
        });
    } else if (answer === '+') {
      db.query('select location, count(*) from github_users group by location')
        .then(result => {
          if (result.length > 0) {
            msg = 'Amount of users per location ';
            console.log(result);
            resolve(msg);
          } else {
            msg =
              'Sorry our db is empty, try adding anyone first and check it again ';
            resolve(msg);
          }
        })
        .catch(err => {
          msg = 'Something went wrong';
          console.log(err);
          reject(msg);
        });
    } else {
      db.query('SELECT * FROM github_users WHERE login = $1', [answer.trim()])
        .then(result => {
          if (result.length > 0) {
            msg = 'This github user name already exists, try another one! ';
            resolve(msg);
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
                resolve(msg);
              })
              .catch(err => {
                msg = `${err.error.message}! `;
                reject(msg);
              });
          }
        })
        .catch(err => {
          msg = 'Something went wrong';
          console.log(err);
          reject(msg);
        });
    }
  });
};

const userReplay = msg => {
  rl.setPrompt(`${msg} ${initialMessage}`);
  rl.prompt();
  rl.on('line', answer => {
    answerCheck(answer)
      .then(msg => {
        rl.setPrompt(`${msg}${initialMessage}`);
        rl.prompt();
      })
      .catch(msg => {
        rl.setPrompt(`${msg}${initialMessage}`);
        rl.prompt();
      });
  });
};
