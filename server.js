const axios = require("axios");
const crypto = require("crypto");
const express = require("express");
const qs = require("qs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const CLIENT_ID = "<your_client_id>";
const CLIENT_SECRET = "<your_client_secret>";
const AUTH_HEADER =
  "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"); // "CLIENT_ID + ":" + CLIENT_SECRET, "utf8").toString("base64");

const SPOTIFY_ACCOUNTS_ENDPOINT = "https://accounts.spotify.com";
const CLIENT_CALLBACK_URL = "expo-spotify-sdk-example://authenticate";
const ENCRYPTION_SECRET = "<your_encryption_secret>";

app.post("/swap", async (req, res) => {
  console.log("WE'VE BEEN HIT!");

  const auth_code = req.body.code;

  try {
    const response = await axios.post(
      `${SPOTIFY_ACCOUNTS_ENDPOINT}/api/token`,
      qs.stringify({
        grant_type: "authorization_code",
        redirect_uri: CLIENT_CALLBACK_URL,
        code: auth_code,
      }),
      {
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (response.status === 200) {
      const token_data = response.data;
      const refresh_token = token_data.refresh_token;
      const cipher = crypto.createCipher("aes-256-cbc", ENCRYPTION_SECRET);
      let encrypted_token = cipher.update(refresh_token, "utf8", "hex");
      encrypted_token += cipher.final("hex");
      token_data.refresh_token = encrypted_token;

      console.log({ token_data });

      res.status(response.status).json(token_data);
    } else {
      res.status(response.status).send(response.data);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/refresh", async (req, res) => {
  const encrypted_token = req.body.refresh_token;
  const decipher = crypto.createDecipher("aes-256-cbc", ENCRYPTION_SECRET);
  let refresh_token = decipher.update(encrypted_token, "hex", "utf8");
  refresh_token += decipher.final("utf8");

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

    console.log({ data: response.data });

    res.status(response.status).send(response.data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
