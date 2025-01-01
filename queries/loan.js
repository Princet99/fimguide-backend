const loansQuery = `
  SELECT
      l.loan_no as loan_no,
      l.amount AS loan_amount,
      l.rate AS interest_rate,
      l.status As status,
      l.score As score,
      DATE_FORMAT(l.creation_date, '%m/%d/%Y') AS contract_date,
      DATE_FORMAT(MAX(s.schedule_date), '%m/%d/%Y') AS end_date
  FROM 
      loan l
  JOIN 
      schedule s ON l.loan_no = s.loan_no
  WHERE 
      l.loan_no = ?
  GROUP BY 
      l.amount, l.rate, l.creation_date;
`;

module.exports = { loansQuery };
