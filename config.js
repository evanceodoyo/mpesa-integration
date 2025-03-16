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
    CALLBACK_URL: process.env.CALLBACK_URL,
    VALIDATION_URL: process.env.VALIDATION_URL,
    CONFIRMATION_URL: process.env.CONFIRMATION_URL,
    QUEUE_TIMEOUT_URL: process.env.QUEUE_TIMEOUT_URL,
    RESULT_URL: process.env.RESULT_URL,
    SECURITY_CERT_PATH: process.env.SECURITY_CERT_PATH,
};
