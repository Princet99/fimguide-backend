const paymentconfirmation = `SELECT * FROM PaymentVerification WHERE luid = ?;`;
module.exports = { paymentconfirmation };