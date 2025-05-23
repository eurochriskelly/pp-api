const processArgs = (args) => {
    const ARGS = {}

    args.forEach(arg => {
        console.log("Processing option: ", arg)
        if (arg.startsWith('--')) {
            const [key, value] = arg.split('=')
            ARGS[key.replace('--', '')] = value
        }
    })

    if (ARGS['sync-from-master']) {
        return ARGS
    }

    if (ARGS['use-mock'] === 'true') {
      ARGS.mock = true
    }

    if (!ARGS.port) {
        throw new Error('Missing --port argument')
    }

    if (!ARGS.app) {
        throw new Error('Missing --app argument')
    } else {
      ARGS.staticPath = `/gcp/dist/${ARGS.environment}/${ARGS.app}/`
    }

    return ARGS
}

module.exports = {
    processArgs,
}
