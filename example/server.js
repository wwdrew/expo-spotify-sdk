const axios = require("axios");
const express = require("express");
const { encode } = require("js-base64");
const qs = require("qs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your environment.
// Never commit real credentials to source control.
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set.\n" +
      "Example: SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node server.js",
  );
  process.exit(1);
}

const SPOTIFY_ACCOUNTS_ENDPOINT = "https://accounts.spotify.com";
const CLIENT_CALLBACK_URL = "expo-spotify-sdk-example://authenticate";
const AUTH_SECRET = encode(`${CLIENT_ID}:${CLIENT_SECRET}`);
const AUTH_HEADER = `Basic ${AUTH_SECRET}`;

app.post("/swap", async (req, res) => {
  console.log("=== TOKEN SWAP INITIATED ===");
  const { code } = req.body;

  try {
    const response = await axios.post(
      `${SPOTIFY_ACCOUNTS_ENDPOINT}/api/token`,
      qs.stringify({
        grant_type: "authorization_code",
        redirect_uri: CLIENT_CALLBACK_URL,
        code,
      }),
      {
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (response.status !== 200) {
      console.log("=== TOKEN SWAP FAILED WITH RESPONSE: ", response.data);
      return res.status(response.status).send(response.data);
    }

    console.log("=== TOKEN SWAP SUCCEEDED WITH RESPONSE: ", response.data);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log({ error });
    res.status(500).send(error.message);
  }
});

app.post("/refresh", async (req, res) => {
  console.log("=== TOKEN REFRESH INITIATED ===");
  const { refresh_token } = req.body;

  try {
    const response = await axios.post(
      `${SPOTIFY_ACCOUNTS_ENDPOINT}/api/token`,
      qs.stringify({
        grant_type: "refresh_token",
        refresh_token,
      }),
      {
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (response.status !== 200) {
      console.log("=== TOKEN REFRESH FAILED WITH RESPONSE: ", response.data);
      return res.status(response.status).send(response.data);
    }

    console.log("=== TOKEN REFRESH SUCCEEDED WITH RESPONSE: ", response.data);
    res.status(response.status).send(response.data);
  } catch (error) {
    console.log({ error });
    res.status(500).send(error.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
