// @ts-nocheck
module.exports = {
  dbConf: {
    host: process.env['PP_HST'], // Fallbacks for dev
    user: process.env['PP_USR'], // Same as above.
    password: process.env['PP_PWD'], // Same as above.
    database: process.env.PP_DATABASE || 'EuroTourno',
  },
  clubEventsDbConf: {
    host: process.env['PP_HST'],
    user: process.env['PP_USR'],
    password: process.env['PP_PWD'],
    database: 'PPClubEvents',
  },
  sections: [
    {
      title: 'live competitation status',
      name: 'competitions',
      action: () => {},
    },
    {
      title: 'field coordination',
      name: 'pitches',
      action: () => {},
    },
  ],
};
