// General loan details such as loan number , loan amount , loan interest rate , loan status and score
const loansQuery = `
  SELECT
      l.ln_no AS loan_no, 
      l.ln_amount AS loan_amount, 
      l.ln_rate AS interest_rate, 
      l.ln_status AS status, 
      l.ln_score AS score, 
      DATE_FORMAT(l.ln_date, '%m/%d/%Y') AS contract_date, 
      DATE_FORMAT(MAX(s.sc_date), '%m/%d/%Y') AS end_date 
  FROM 
      loan l
  JOIN 
      schedule s ON l.ln_no = s.sc_ln_no 
  WHERE 
      l.ln_no = ? 
  GROUP BY 
      l.ln_amount, l.ln_rate, l.ln_date;

`;

module.exports = { loansQuery };
