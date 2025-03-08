// const DD = console.log
const DD = () => {}
module.exports = db => {
    return {
        select: (query) => new Promise((accept, reject) => {
            DD('---- START SELECT ----')
            DD(`Executing query: ${query}`)
            db.query(query, (err, results) => {
                if (err) {
                    DD('Error occured', err)
                    DD('---- END SELECT ----')
                    reject({ error: err.message })
                    return
                }
                DD('Results: ', results)
                DD('---- END SELECT ----')
                accept({ data: results })
                
            })
        })
    }
}
