const express = require('express')
const app = express()
const port = 3000
const getEmbedTokenRoute = require('./routes/getEmbedTokenRoute')
app.use(express.json())
app.use('/getEmbedToken', getEmbedTokenRoute )

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})