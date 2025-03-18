const express = require("express");
const router = express.Router();
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const ipWhitelist = require("./middleware/whitelist");
const config = require("./config");
const db = require("./firebase");
const {
  generateToken,
  generateSecurityCredential,
  formatPhoneNumber,
  saveUpdateUser,
  getUserDetails,
  updateTransaction,
  processMpesaResponse,
} = require("./helpers");


router.post("/pay", async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
      return res
        .status(400)
        .json({ error: "Phone number and amount are required." });
    }

    if (isNaN(amount) && amount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a number greater than 0." });
    }

    const result = formatPhoneNumber(phoneNumber);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const phone = result.formattedPhone;
    const token = await generateToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.T]/g, "")
      .slice(0, 14);
    const stkPassword = Buffer.from(
      `${config.SHORTCODE}${config.PASSKEY}${timestamp}`
    ).toString("base64");

    const requestBody = {
      BusinessShortCode: config.SHORTCODE,
      Password: stkPassword,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: config.SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `${config.API_BASE_URL}/callback`,
      AccountReference: "Account",
      TransactionDesc: "Deposit",
    };

    const response = await fetch(
      `${config.BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Safaricom API Error: ${data.errorMessage || response.status}`
      );
    }

    // Persist info to db
    const merchantRequestID = data?.MerchantRequestID;
    await saveUpdateUser(phone, merchantRequestID);
    await db.collection("deposits").doc(merchantRequestID).set({
      phone,
      merchantRequestID,
      status: "pending",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // return res.json(data);
    return res.json({
      ResponseCode: data.ResponseCode,
      ResponseDescription: data.ResponseDescription,
    });
  } catch (error) {
    console.error("STK Push Error:", error.message);
    return res.status(500).json({ error: "Payment initiation failed." });
  }
});


// Should be confidential to avoid target by hackers,
// in prod, use `ipWhitelist` middleware
router.post("/callback", async (req, res) => {
  try {
    const { stkCallback } = req.body.Body;

    if (!stkCallback) {
      throw new Error("Invalid callback data");
    }

    const {
      ResultCode: resultCode,
      ResultDesc: resultDesc,
      MerchantRequestID: merchantRequestID,
      CallbackMetadata = {},
    } = stkCallback;

    console.log("STK Callback Response:", { resultCode, resultDesc });

    // safely extract transaction details
    const metadata = CallbackMetadata?.Item || [];
    const getValue = (name) =>
      metadata.find((obj) => obj.Name === name)?.Value || "N/A";

    const amount = Number(getValue("Amount") || 0);
    const mpesaCode = getValue("MpesaReceiptNumber");
    const transactionDate = getValue("TransactionDate");

    // process failed or cancelled transaction
    if (resultCode !== 0) {
      console.log("Transaction Failed or Cancelled:", resultDesc);
      await updateTransaction(
        merchantRequestID,
        "failed",
        amount,
        mpesaCode,
        transactionDate
      );
      return res.json({ ResultCode: resultCode, ResultDesc: resultDesc });
    }

    console.log("Successful STK Callback Data:", {
      amount,
      mpesaCode,
      transactionDate,
    });

    // process successful transaction
    await updateTransaction(
      merchantRequestID,
      "completed",
      amount,
      mpesaCode,
      transactionDate
    );
    const userQuery = db
      .collection("users")
      .where("merchantRequestID", "==", merchantRequestID)
      .limit(1);
    const snapshot = await userQuery.get();

    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      await docRef.update({ balance: FieldValue.increment(amount) });
      console.log(
        `Balance updated successfully for user with merchantRequestID: ${merchantRequestID}`
      );
    }

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Callback Processing Error:", error.message);
  }
});


// HANDLING OFFLINE PAYMENTS
// validation endpoint
router.post("/validation", ipWhitelist, async (req, res) => {
  // No logic required (if no validation required)
});


// confirmation endpoint
router.post("/confirmation", async (req, res) => {
  try {
    const data = req.body;
    console.log("Confirmation Data:", data);

    // persist transaction info to db
    await db.collection("offline_payments").add(data);

    return res.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (error) {
    console.log("Confirmation webhook error", error.message);
  }
});


// B2C TRANSACTIONS
router.post("/withdraw", async (req, res) => {
  // phone number of user in session will be pulled from db in prod
  const { amount, phoneNumber } = req.body;

  if (!phoneNumber || !amount) {
    return res
      .status(400)
      .json({ error: "Phone number and amount are required." });
  }

  const amountInt = parseInt(amount, 10);
  if (!Number.isInteger(amountInt) || amountInt < 10) {
    return res
      .status(400)
      .json({ error: "Minimum withdrawal amount is KES 10." });
  }

  const result = formatPhoneNumber(phoneNumber);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const phone = result.formattedPhone;

  const userData = await getUserDetails(phone);
  if (!userData) {
    return res.status(404).json({ error: "User not found" });
  }

  // logic varies depending on who bears transaction cost
  if (amountInt > Number(userData.balance)) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const securityCredential = generateSecurityCredential(
    config.INITIATOR_PASSWORD,
    config.SECURITY_CERT_PATH
  );
  const token = await generateToken();

  const b2cRequestBody = {
    OriginatorConversationID: `$txn_${Date.now()}`,
    InitiatorName: config.INITIATOR_NAME,
    SecurityCredential: securityCredential,
    CommandID: "BusinessPayment",
    Amount: amountInt,
    PartyA: config.B2C_SHORTCODE,
    PartyB: phone,
    Remarks: "Withdrawal",
    QueueTimeOutURL: `${config.API_BASE_URL}/timeout`,
    ResultURL: `${config.API_BASE_URL}/withdraw/results`,
    Occassion: "User withdrawal",
  };

  try {
    const response = await fetch(
      `${config.BASE_URL}/mpesa/b2c/v3/paymentrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(b2cRequestBody),
      }
    );

    const data = await response.json();

    if (data?.ResponseCode !== "0") {
      console.error("B2C API Error:", data);
      return res
        .status(400)
        .json({ error: "Withdrawal failed. Please try again." });
    }

    // persist transcation to db
    const conversationID = data.ConversationID;

    await db.collection("transactions").doc(conversationID).set({
      phone,
      amount,
      conversationID,
      originatorConversationID: data.OriginatorConversationID,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await db.collection("users").doc(phone).update({
      conversationID,
      updatedAt: Timestamp.now(),
    });

    // return res.json(data);
    return res.json({
      ResponseCode: data.ResponseCode,
      ResponseDescription: data.ResponseDescription,
    });
  } catch (error) {
    console.error("Error processing Withdrawal:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// Can be used by the organization if there's need for reversal
router.post("/reversal", async (req, res) => {
  const { transactionID, amount } = req.body;

  if (!transactionID || !amount) {
    return res.status(400).json({ error: "Missing transaction ID or amount" });
  }

  if (isNaN(amount)) {
    return res.status(400).json({ error: "Amount must be a number" });
  }

  const securityCredential = generateSecurityCredential(
    config.INITIATOR_PASSWORD,
    config.SECURITY_CERT_PATH
  );
  const token = await generateToken();

  const requestBody = {
    Initiator: config.INITIATOR_NAME,
    SecurityCredential: securityCredential,
    CommandID: "TransactionReversal",
    TransactionID: transactionID,
    Amount: amount,
    ReceiverParty: config.SHORTCODE,
    RecieverIdentifierType: "11",
    ResultURL: `${config.API_BASE_URL}/reversal/results`,
    QueueTimeOutURL: `${config.API_BASE_URL}/timeout`,
    Remarks: "Reverse transaction",
    Occassion: "work",
  };

  try {
    const response = await fetch(
      `${config.BASE_URL}/mpesa/reversal/v1/request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    console.log(data);
    if (data?.ResponseCode !== 0) {
      return res.status(400).json({ error: "Service request failed" });
    }

    return res.json(data);
  } catch (error) {
    console.error("Error requesting reversal:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// For checking transaction status
router.post("/transaction-status", async (req, res) => {
  const { transactionID } = req.body;

  if (!transactionID) {
    return res.status(400).json({ error: "Transaction ID required" });
  }

  const securityCredential = generateSecurityCredential(
    config.INITIATOR_PASSWORD,
    config.SECURITY_CERT_PATH
  );
  const token = generateToken();

  const requestBody = {
    Initiator: config.INITIATOR_NAME,
    SecurityCredential: securityCredential,
    CommandID: "TransactionStatusQuery",
    TransactionID: transactionID,
    PartyA: config.SHORTCODE,
    IdentifierType: "1",
    ResultURL: `${config.API_BASE_URL}/transaction-status/results`,
    QueueTimeOutURL: `${config.API_BASE_URL}/timeout`,
    Remarks: "Transaction status check",
    Occassion: "",
  };

  try {
    const response = await fetch(
      `${config.BASE_URL}/mpesa/transactionstatus/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    console.log(data);

    if (data?.ResponseCode !== 0) {
      return res.status(400).json({ error: "Service request failed" });
    }

    return res.json(data);
  } catch (error) {
    console.error("Transaction Query Error", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});


router.post("/withdraw/results", processMpesaResponse);
router.post("/reversal/results", processMpesaResponse);
router.post("/transaction-status/results", processMpesaResponse);


// Endpoint to handle timeout
router.post("/timeout", async (req, res) => {
  try {
    console.log("TIMEOUT:", req.body);

    const { Result } = req.body;

    if (!Result) {
      throw new Error("Invalid callback data");
    }

    const data = {
      type,
      resultCode: Result.ResultCode,
      description: Result.ResultDesc,
      mpesaCode: Result.TransactionID,
      conversationID: Result.ConversationID,
      originatorConversationID: Result.OriginatorConversationID,
      resultData: Result?.ResultParameters || {},
      updatedAt: Timestamp.now()
    };

    if (!data.conversationID) {
      throw new Error("Missing conversation ID");
    }

    // Update db
    const transactionRef = db.collection("transactions").doc(data.conversationID);
    await transactionRef.update(data);

    console.log(`Transaction ${data.conversationID} marked as timeout`);

    return res.status(200).json({ status: "Timeout" });
  } catch (error) {
    console.error("Error processing B2C timeout callback:", error);
  }
});


router.get("/balance", async (req, res) => {
  const { phoneNumber } = req.query;

  const result = formatPhoneNumber(phoneNumber);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const phone = result.formattedPhone;

  const userData = await getUserDetails(phone);
  if (!userData) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.status(200).json({ balance: userData.balance });
});


module.exports = router;
