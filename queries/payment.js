const paymentDataQuery = `
  SELECT 
    sc_ln_no AS loan_no,
    COUNT(CASE WHEN sc_status = 'On time' THEN 1 END) AS on_time_payments,
    COUNT(CASE WHEN sc_status LIKE 'Past due%' THEN 1 END) AS past_due_payments,
    COUNT(CASE WHEN sc_status = 'Future' THEN 1 END) AS future_payments
FROM 
    schedule
WHERE 
    sc_ln_no = ?;
`;

const recentPaymentsQuery = `
      SELECT
    p.pm_ln_no AS loan_no,
    DATE_FORMAT(s.sc_date, '%m/%d/%Y') AS ScheduledDate,
    s.sc_amount AS scheduledPaidAmount,
    DATE_FORMAT(p.pm_date, '%m/%d/%Y') AS ActualDate,
    p.pm_paid AS PaidAmount,
    ps.ps_value AS Status
FROM 
    schedule s
JOIN 
    payment p ON s.sc_id = p.pm_sc_id
JOIN 
    payment_status ps ON ps.ps_category_id = 2 AND ps.lk_id = p.pm_status
WHERE 
    s.sc_ln_no = ? AND
    p.pm_date <= ?
ORDER BY 
    p.pm_date DESC;
`;



module.exports = { paymentDataQuery, recentPaymentsQuery };
