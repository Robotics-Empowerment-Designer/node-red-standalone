import express, { json } from "express"
import { exec } from "child_process"
import path, { dirname } from "path"
import { fileURLToPath } from "url"
import fs from "node:fs"

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = "/home/team/git/RED-Platform/"
const shell = "/bin/bash"

app.use(json())

app.use(express.static(path.join(__dirname, "public")))

app.post("/status", (req, res) => {
  exec('"/usr/bin/systemctl" status node-red.service', { cwd, shell }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      console.error(error)
      console.error(stderr)
      // res.status(500).send(`Error: ${error.message}\n${stderr}`)
      // return
    }
    console.log(stdout)
    res.send(`${stdout}`)
  })
})

app.post("/start", (req, res) => {
  exec('"/usr/bin/systemctl" start node-red.service && systemctl status node-red.service', { cwd, shell }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      console.error(stderr)
      console.error(error)
      // res.status(500).send(`Error: ${error.message}\n${stderr}`)
      // return
    }
    console.log(stdout)
    res.send(`${stdout}`)
  })
})

app.post("/stop", (req, res) => {
  exec('"/usr/bin/systemctl" stop node-red.service && systemctl status node-red.service', { cwd, shell }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      console.error(stderr)
      console.error(error)
      // res.status(500).send(`Error: ${error.message}\n${stderr}`)
      // return
    }
    console.log(stdout)
    res.send(`${stdout}`)
  })
})

app.post("/restart", (req, res) => {
  exec('"/usr/bin/systemctl" restart node-red.service && systemctl status node-red.service', { cwd, shell }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      console.error(stderr)
      console.error(error)
      // res.status(500).send(`Error: ${error.message}\n${stderr}`)
      // return
    }
    console.log(stdout)
    res.send(`${stdout}`)
  })
})

app.post("/pepper", (req, res) => {
  exec('/bin/bash ./bash/pepper.sh', { shell }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      console.error(stderr)
      console.error(error)
      // res.status(500).send(`Error: ${error.message}\n${stderr}`)
      // return
    }
    console.log(stdout)
    res.send(`${stdout}`)
  })
})

app.post("/salt", (req, res) => {
  exec('/bin/bash ./bash/salt.sh', { shell }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      console.error(stderr)
      console.error(error)
      // res.status(500).send(`Error: ${error.message}\n${stderr}`)
      // return
    }
    console.log(stdout)
    res.send(`${stdout}`)
  })
})

app.get("/current", (req, res) => {
  fs.readFile('current.txt', { encoding: "utf8" }, (err, data) => {
    if (err) {
      res.status(500).json({ error: "Error reading file" })
      return
    }
    res.json(data)
  })
})

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})
