const paymentDataQuery = `
  SELECT 
    loan_no,
    COUNT(CASE WHEN status = 'On time' THEN 1 END) AS on_time_payments,
      COUNT(CASE WHEN status LIKE 'Past due%' THEN 1 END) AS past_due_payments,
      COUNT(CASE WHEN status = 'Future' THEN 1 END) AS future_payments
  FROM 
      schedule
  WHERE 
      loan_no = ?;
`;

const recentPaymentsQuery = `
  SELECT
        p.loan_no,
      DATE_FORMAT(s.schedule_date, '%m/%d/%Y') AS ScheduledDate,
      s.amount AS scheduledPaidAmount,
      DATE_FORMAT(p.payment_date, '%m/%d/%Y') AS ActualDate,
      p.paid_amount AS PaidAmount,
      p.status AS Status
  FROM 
      schedule s
  JOIN 
      payment p ON s.id = p.schedule_id
  WHERE 
        s.loan_no = ? AND
        s.schedule_date <= ?
  ORDER BY 
      p.payment_date DESC;
`;

module.exports = { paymentDataQuery, recentPaymentsQuery };
