const comingUpQuery = `
  SELECT 
      loan_no,
      balance,
      DATE_FORMAT(s.schedule_date, '%m/%d/%Y') AS due_date,
      amount AS amount_due
  FROM 
      schedule s
  WHERE 
      s.loan_no = ? AND
      s.schedule_date > ?
      AND is_active = 1;
`;

const loanStateQuery = `
SELECT 
    loan_no,
    SUM(due_amount) OVER (PARTITION BY loan_no) AS total_due_amount,
    balance,
    schedule_date
FROM 
    schedule
WHERE 
    loan_no = ? -- Replace with loan number
    AND schedule_date <= ?
    AND is_active = 1
ORDER BY 
    schedule_date DESC
LIMIT 1;
`;

module.exports = { comingUpQuery, loanStateQuery };
