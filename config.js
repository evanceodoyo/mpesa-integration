require('dotenv').config();


module.exports = {
    CONSUMER_KEY: process.env.CONSUMER_KEY,
    CONSUMER_SECRET: process.env.CONSUMER_SECRET,
    PASSKEY: process.env.PASSKEY,
    SHORTCODE: process.env.SHORTCODE,
    B2C_SHORTCODE: process.env.B2C_SHORTCODE,
    INITIATOR_NAME: process.env.INITIATOR_NAME,
    INITIATOR_PASSWORD: process.env.INITIATOR_PASSWORD,
    BASE_URL: process.env.BASE_URL,
    BASE_API_URL: process.env.BASE_API_URL,
    SECURITY_CERT_PATH: process.env.SECURITY_CERT_PATH,
};
