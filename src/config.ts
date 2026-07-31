interface DbConfig {
  host: string | undefined;
  user: string | undefined;
  password: string | undefined;
  database: string;
  charset?: string;
}

interface Config {
  dbConf: DbConfig;
  clubEventsDbConf: DbConfig;
}

const config: Config = {
  dbConf: {
    host: process.env['PP_HST'],
    user: process.env['PP_USR'],
    password: process.env['PP_PWD'],
    database: process.env.PP_DATABASE || 'EuroTourno',
    charset: 'utf8mb4',
  },
  clubEventsDbConf: {
    host: process.env['PP_HST'],
    user: process.env['PP_USR'],
    password: process.env['PP_PWD'],
    database: 'PPClubEvents',
    charset: 'utf8mb4',
  },
};

export = config;
