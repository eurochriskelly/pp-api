const log = (level, msg) => {
  //const remainingArgs = Array.prototype.slice.call(arguments, 2)
  console.log(new Date().toISOString(), level, msg);
};

module.exports = {
  II: (msg) => log('II', msg),
  DD: (msg) => log('DD', msg),
  EE: (msg) => log('EE', msg),
};
