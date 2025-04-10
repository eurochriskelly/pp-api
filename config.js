const { write } = require("xlsx");

if (!process.env['PP_HST']) {
  console.log('Env PP_HST is not defined .. exiting. ')
  process.exit(1)
}
module.exports = {
  dbConf: {
    host: process.env['PP_HST'],
    user: process.env['PP_USR'],
    password: process.env['PP_PWD'],
    database: process.env['PP_DBN']
  },
  sections: [
    {
      title: "live competitation status",
      name: "competitions",
      action: () => {},
    },
    {
      title: "field coordination",
      name: "pitches",
      action: () => {
      },
    },
  ],
};

