require('dotenv').config();
const axios = require('axios');
const url = require('node:url')
const express = require('express')
const app = express()
const port = 9000 

CLIENT_SECRET = process.env.CLIENT_SECRET
CLIENT_ID = process.env.CLIENT_ID

const getUserAccessToken = async (code) => {
  const queryParams = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
  }

  // // https://github.com/login/oauth/access_token
  const apiUrl = url.format({
    protocol: 'https',
    host: 'github.com',
    pathname: '/login/oauth/access_token',
    query: queryParams, 
  });
  
  const response = await axios({
    method: 'post',
    url: apiUrl,
    headers: {"Accept": "application/json"}
  });
  console.log("response.data: ", response.data)

  return response.data.access_token
}

const getGithubUsername = async (userAccessToken) => {
  const apiUrl = 'https://api.github.com/user';

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAccessToken}`,
      }
    });

    return response.data.login;
  } catch (error) {
    console.log(error.response.status);
    const errorMessage = `could not get github user name:`;
    console.error(errorMessage)
    return errorMessage;
  }
}

app.get('/login', (req, res) => {
  res.send(`<a href="https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}">Login with GitHub</a>`)
})

app.get('/oauth/github/callback', (req, res) => {
  console.log('WOOOO CALLBACK!!!');
  const { code } = req.query
  console.log(code);

  return res.status(302).header("Location", "http://localhost:9000/popup").end()
})

app.get("/popup", (request, reply) => {
  return reply.sendFile(`${__dirname}/popup.html`);
});

// callback URL, after github login
app.get('/', async (req, res) => {
  const code = req.query.code
  const userAccessToken = await getUserAccessToken(code)
  const githubUsername = await getGithubUsername(userAccessToken)
  // console.log("userToken", userToken)
  res.send(`code: ${githubUsername}\n`)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
