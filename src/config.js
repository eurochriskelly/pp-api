// Only enforce database environment variables if not in mock mode (inferred from PP_DBN)
if (process.env['PP_DBN'] !== 'MockTourno') {
  if (
    !process.env['SMTP_HOST'] ||
    !process.env['SMTP_USER'] ||
    !process.env['SMTP_PASS']
  ) {
    console.log(
      'SMTP env vars (SMTP_HOST, SMTP_USER, SMTP_PASS) required for non-mock. Exiting.'
    );
    process.exit(1);
  }
  if (!process.env['PP_HST']) {
    console.log(
      `Env PP_HST is not defined for non-mock DB [${process.env['PP_DBN']}] .. exiting.`
    );
    process.exit(1);
  }
  if (!process.env['PP_USR']) {
    console.log(
      `Env PP_USR is not defined for non-mock DB [${process.env['PP_DBN']}] .. exiting.`
    );
    process.exit(1);
  }
  if (!process.env['PP_PWD']) {
    console.log(
      `Env PP_PWD is not defined for non-mock DB [${process.env['PP_DBN']}] .. exiting.`
    );
    process.exit(1);
  }
}

module.exports = {
  dbConf: {
    host: process.env['PP_HST'], // Will be undefined in mock mode if not set via pp_env.sh, but server.js shouldn't use it.
    user: process.env['PP_USR'], // Same as above.
    password: process.env['PP_PWD'], // Same as above.
    database: process.env['PP_DBN'], // This will be 'MockTourno' in mock mode from Makefile.
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
