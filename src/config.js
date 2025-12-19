// Only enforce database environment variables if not in mock mode (inferred from PP_DATABASE)
if (process.env.PP_DATABASE !== 'MockTourno') {
  if (
    !process.env['SMTP_HOST'] ||
    !process.env['SMTP_USER'] ||
    !process.env['SMTP_PASS']
  ) {
    throw new Error(
      'SMTP env vars (SMTP_HOST, SMTP_USER, SMTP_PASS) required for non-mock.'
    );
  }
  if (!process.env['PP_HST']) {
    throw new Error(
      `Env PP_HST is not defined for non-mock DB [${process.env.PP_DATABASE}].`
    );
  }
  if (!process.env['PP_USR']) {
    throw new Error(
      `Env PP_USR is not defined for non-mock DB [${process.env.PP_DATABASE}].`
    );
  }
  if (!process.env['PP_PWD']) {
    throw new Error(
      `Env PP_PWD is not defined for non-mock DB [${process.env.PP_DATABASE}].`
    );
  }
}

module.exports = {
  dbConf: {
    host: process.env['PP_HST'], // Fallbacks for dev
    user: process.env['PP_USR'], // Same as above.
    password: process.env['PP_PWD'], // Same as above.
    database: process.env.PP_DATABASE || 'EuroTourno',
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
