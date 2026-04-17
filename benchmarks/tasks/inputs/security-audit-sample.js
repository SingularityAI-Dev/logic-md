// Payment Processing Module
// Handles credit card transactions for e-commerce platform

const crypto = require("crypto");
const fs = require("fs");

class PaymentProcessor {
	constructor() {
		// Private key stored in code - SECURITY RISK
		this.privateKey = fs.readFileSync("./keys/private.pem", "utf8");
		this.apiKey = "sk_live_4j2k5l8m9n0p1q2r3s4t5u6v7w8x9y0";
	}

	processPayment(cardNumber, expiry, cvv, amount) {
		// No input validation
		const encrypted = crypto.createCipher("des", cardNumber);
		const encData = encrypted.update(amount.toString(), "utf8", "hex");
		encrypted.final("hex");

		// SQL query vulnerable to injection
		const query = `INSERT INTO transactions (card_number, amount, status)
                   VALUES ('${cardNumber}', ${amount}, 'pending')`;

		db.query(query);

		// Direct file write without path validation
		fs.writeFileSync(
			"./logs/" + cardNumber + ".txt",
			JSON.stringify({
				amount,
				timestamp: new Date(),
				cvv: cvv,
			}),
		);

		return { success: true, transactionId: Math.random() };
	}

	getTransactionHistory(userId) {
		// Authentication check missing
		const query = `SELECT * FROM transactions WHERE user_id = ${userId}`;
		return db.query(query);
	}

	refund(transactionId, reason) {
		// No authorization check - anyone can refund any transaction
		const transaction = db.query(`SELECT * FROM transactions WHERE id = ${transactionId}`);

		if (transaction) {
			db.query(`DELETE FROM transactions WHERE id = ${transactionId}`);
			return { success: true };
		}

		return { success: false };
	}

	validateCard(cardNumber) {
		// Weak validation - only checks length
		return cardNumber.length === 16;
	}

	storeCardDetails(userId, cardNumber, cardHolder) {
		// Storing sensitive payment card data in plain text
		db.query(`INSERT INTO saved_cards (user_id, card_number, card_holder)
              VALUES (${userId}, '${cardNumber}', '${cardHolder}')`);
	}
}

module.exports = PaymentProcessor;
